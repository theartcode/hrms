"use client";

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Upload, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { parseImportFile, splitHeaderAndRows } from "@/lib/parse-import-file";
import { LEAVE_TYPES, LEAVE_IMPORT_STATUS } from "@/constants/leave-types";
import { LEAVE_TYPE_LABELS } from "@/features/leave/leave-status-meta";
import * as leaveService from "@/services/leave.service";
import { LeaveImportBatch } from "@/types/leave.types";

interface ParsedRow {
  index: number;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: string;
  status: string;
  reason: string;
  externalReference: string;
  errors: string[];
}

const VALID_LEAVE_TYPES: string[] = Object.values(LEAVE_TYPES);
const VALID_STATUSES: string[] = Object.values(LEAVE_IMPORT_STATUS);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// DD/MM/YYYY or DD-MM-YYYY — the common Indian export format, alongside ISO.
const DMY_DATE_RE = /^(\d{2})[/-](\d{2})[/-](\d{4})$/;

// Real-world exports (Razorpay's included) use human-readable labels, not
// the raw enum codes — "Annual Leave", "Sick Leave", etc. Match against
// both the codes themselves and their common display variants,
// case/whitespace-insensitively, rather than forcing the admin to hand-edit
// every cell in the source file before it'll import.
const LEAVE_TYPE_ALIASES: Record<string, string> = {
  SICK: LEAVE_TYPES.SICK,
  "SICK LEAVE": LEAVE_TYPES.SICK,
  CASUAL: LEAVE_TYPES.CASUAL_PAID,
  "CASUAL LEAVE": LEAVE_TYPES.CASUAL_PAID,
  "CASUAL PAID": LEAVE_TYPES.CASUAL_PAID,
  "CASUAL PAID LEAVE": LEAVE_TYPES.CASUAL_PAID,
  "CASUAL/PAID LEAVE": LEAVE_TYPES.CASUAL_PAID,
  CASUAL_PAID: LEAVE_TYPES.CASUAL_PAID,
  ANNUAL: LEAVE_TYPES.ANNUAL,
  "ANNUAL LEAVE": LEAVE_TYPES.ANNUAL,
  EARNED: LEAVE_TYPES.ANNUAL,
  "EARNED LEAVE": LEAVE_TYPES.ANNUAL,
  EL: LEAVE_TYPES.ANNUAL,
  UNPAID: LEAVE_TYPES.UNPAID,
  "UNPAID LEAVE": LEAVE_TYPES.UNPAID,
  LWP: LEAVE_TYPES.UNPAID,
  "LEAVE WITHOUT PAY": LEAVE_TYPES.UNPAID,
  "COMP OFF": LEAVE_TYPES.COMP_OFF,
  "COMP OFF LEAVE": LEAVE_TYPES.COMP_OFF,
  COMPOFF: LEAVE_TYPES.COMP_OFF,
  "COMPENSATORY OFF": LEAVE_TYPES.COMP_OFF,
  COMP_OFF: LEAVE_TYPES.COMP_OFF,
};

const STATUS_ALIASES: Record<string, string> = {
  APPROVED: LEAVE_IMPORT_STATUS.APPROVED,
  CONFIRMED: LEAVE_IMPORT_STATUS.APPROVED,
  TAKEN: LEAVE_IMPORT_STATUS.APPROVED,
  REJECTED: LEAVE_IMPORT_STATUS.REJECTED,
  DECLINED: LEAVE_IMPORT_STATUS.REJECTED,
  DENIED: LEAVE_IMPORT_STATUS.REJECTED,
  CANCELLED: LEAVE_IMPORT_STATUS.CANCELLED,
  CANCELED: LEAVE_IMPORT_STATUS.CANCELLED,
  WITHDRAWN: LEAVE_IMPORT_STATUS.CANCELLED,
};

function normalize(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, " ");
}

function normalizeLeaveType(raw: string): string | null {
  const key = normalize(raw);
  if (VALID_LEAVE_TYPES.includes(key)) return key;
  return LEAVE_TYPE_ALIASES[key] ?? null;
}

function normalizeStatus(raw: string): string | null {
  const key = normalize(raw);
  if (VALID_STATUSES.includes(key)) return key;
  return STATUS_ALIASES[key] ?? null;
}

function normalizeDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (ISO_DATE_RE.test(trimmed)) return trimmed;
  const dmy = trimmed.match(DMY_DATE_RE);
  if (dmy) {
    const [, day, month, year] = dmy;
    return `${year}-${month}-${day}`;
  }
  return null;
}

function validateRow(cells: string[], index: number): ParsedRow {
  const [
    rawLeaveType = "",
    rawStartDate = "",
    rawEndDate = "",
    days = "",
    rawStatus = "",
    reason = "",
    externalReference = "",
  ] = cells;
  const errors: string[] = [];

  const leaveType = normalizeLeaveType(rawLeaveType);
  if (!leaveType) errors.push(`Unknown leave type "${rawLeaveType}"`);

  const startDate = normalizeDate(rawStartDate);
  if (!startDate) errors.push(`startDate "${rawStartDate}" must be YYYY-MM-DD or DD/MM/YYYY`);

  const endDate = normalizeDate(rawEndDate);
  if (!endDate) errors.push(`endDate "${rawEndDate}" must be YYYY-MM-DD or DD/MM/YYYY`);

  if (startDate && endDate && endDate < startDate) {
    errors.push("endDate is before startDate");
  }

  const daysNum = Number(days);
  if (!days || Number.isNaN(daysNum) || daysNum <= 0) errors.push("days must be a positive number");

  const status = normalizeStatus(rawStatus);
  if (!status) {
    errors.push(
      `status "${rawStatus}" must be one of ${VALID_STATUSES.join(", ")} (not Pending — resolve open leave before import)`
    );
  }

  return {
    index,
    leaveType: leaveType ?? rawLeaveType,
    startDate: startDate ?? rawStartDate,
    endDate: endDate ?? rawEndDate,
    days,
    status: status ?? rawStatus,
    reason,
    externalReference,
    errors,
  };
}

interface LeaveImportWizardProps {
  employeeId: string;
  importBatches: LeaveImportBatch[];
  onChanged: () => void;
}

export function LeaveImportWizard({ employeeId, importBatches, onChanged }: LeaveImportWizardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [deletingBatch, setDeletingBatch] = useState<LeaveImportBatch | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setIsParsing(true);
    try {
      const table = await parseImportFile(file);
      const { rows } = splitHeaderAndRows(table);
      setParsedRows(rows.map((cells, i) => validateRow(cells, i)));
      setFileName(file.name);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read file");
    } finally {
      setIsParsing(false);
    }
  }

  const importMutation = useMutation({
    mutationFn: () =>
      leaveService.importLeaveHistory(employeeId, {
        source: "RAZORPAY",
        sourceFilename: fileName ?? undefined,
        rows: parsedRows.map((r) => ({
          leaveType: r.leaveType as never,
          startDate: r.startDate,
          endDate: r.endDate,
          days: Number(r.days),
          status: r.status as never,
          reason: r.reason || undefined,
          externalReference: r.externalReference || undefined,
        })),
      }),
    onSuccess: (res) => {
      toast.success(`Imported ${res.data.importedCount} row(s)`);
      setParsedRows([]);
      setFileName(null);
      onChanged();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteBatchMutation = useMutation({
    mutationFn: (batchId: string) => leaveService.deleteImportBatch(employeeId, batchId),
    onSuccess: () => {
      toast.success("Import batch deleted");
      setDeletingBatch(null);
      onChanged();
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setDeletingBatch(null);
    },
  });

  const errorCount = parsedRows.filter((r) => r.errors.length > 0).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isParsing}
          onClick={() => inputRef.current?.click()}
        >
          {isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Upload Razorpay CSV
        </Button>
        <p className="text-xs text-muted-foreground">
          Columns: leaveType, startDate (YYYY-MM-DD), endDate, days, status
          (APPROVED/REJECTED/CANCELLED), reason, externalReference. First row is treated as a
          header.
        </p>
      </div>

      {parsedRows.length > 0 && (
        <div className="flex flex-col gap-3">
          {errorCount > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {errorCount} row(s) have errors — fix the file and re-upload. Nothing is imported
                until every row is valid.
              </AlertDescription>
            </Alert>
          )}
          <div className="max-h-80 overflow-y-auto overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Leave Type</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Errors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedRows.map((r) => (
                  <TableRow key={r.index} className={r.errors.length > 0 ? "bg-destructive/5" : undefined}>
                    <TableCell className="text-xs text-muted-foreground">{r.index + 1}</TableCell>
                    <TableCell className="text-sm">{LEAVE_TYPE_LABELS[r.leaveType] ?? r.leaveType}</TableCell>
                    <TableCell className="text-sm">{r.startDate}</TableCell>
                    <TableCell className="text-sm">{r.endDate}</TableCell>
                    <TableCell className="text-sm">{r.days}</TableCell>
                    <TableCell className="text-sm">{r.status}</TableCell>
                    <TableCell className="text-xs text-destructive">{r.errors.join("; ")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Button
            type="button"
            size="sm"
            className="self-start"
            disabled={errorCount > 0 || importMutation.isPending}
            onClick={() => importMutation.mutate()}
          >
            {importMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Import {parsedRows.length} row(s)
          </Button>
        </div>
      )}

      {importBatches.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Imported batches</p>
          {importBatches.map((batch) => (
            <div key={batch.batchId} className="flex items-center justify-between rounded-lg border p-2 text-sm">
              <span>
                {batch.sourceFilename ?? (batch.source === "MANUAL" ? "Manual entry" : "Untitled file")} —{" "}
                {batch.rowCount} row(s), imported {new Date(batch.importedAt).toLocaleDateString("en-IN")}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => setDeletingBatch(batch)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deletingBatch !== null}
        onOpenChange={(open) => !open && setDeletingBatch(null)}
        title="Delete import batch?"
        description={`This removes ${deletingBatch?.rowCount ?? 0} imported row(s) from "${deletingBatch?.sourceFilename ?? "this file"}". You can re-upload a corrected file afterward.`}
        confirmLabel="Delete"
        destructive
        isLoading={deleteBatchMutation.isPending}
        onConfirm={() => deletingBatch && deleteBatchMutation.mutate(deletingBatch.batchId)}
      />
    </div>
  );
}
