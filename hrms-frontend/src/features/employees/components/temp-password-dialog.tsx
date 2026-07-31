"use client";

import { useState } from "react";
import { Check, Copy, TriangleAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TempPasswordDialogProps {
  open: boolean;
  employeeName: string;
  employeeId: string;
  tempPassword: string;
  onClose: () => void;
  title?: string;
  description?: React.ReactNode;
}

export function TempPasswordDialog({
  open,
  employeeName,
  employeeId,
  tempPassword,
  onClose,
  title,
  description,
}: TempPasswordDialogProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title ?? `${employeeName} was created`}</DialogTitle>
          <DialogDescription>
            {description ?? (
              <>
                Employee ID{" "}
                <span className="font-mono font-medium text-foreground">{employeeId}</span> was
                assigned automatically. Share this temporary password with them directly — it will
                not be shown again.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2 font-mono text-sm">
          <span className="flex-1 select-all">{tempPassword}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={handleCopy}
            aria-label="Copy temporary password"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>

        <Alert>
          <TriangleAlert className="h-4 w-4" />
          <AlertDescription>
            The employee will be required to set a new password on their first login.
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
