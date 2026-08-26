"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEmployeeOptions } from "@/hooks/use-employee-options";
import { itReadOnlyAccessService } from "@/services/it-work-management.service";

const ACCESS_QUERY_KEY = ["it-readonly-access-list"];
const UNSET = "";

// Mirrors AdobeLicenseAccessDialog's shape — the established pattern in
// this codebase for "grant a specific non-admin employee access to a
// module without inventing a new role" — simplified because read-only
// visibility has no permission levels to choose, just membership.
export function ItReadOnlyAccessDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [selectedEmployee, setSelectedEmployee] = useState(UNSET);

  const { data: viewers, isLoading } = useQuery({
    queryKey: ACCESS_QUERY_KEY,
    queryFn: () => itReadOnlyAccessService.list(),
    enabled: open,
  });

  const { data: employees } = useEmployeeOptions();
  const grantableEmployees = (employees ?? []).filter(
    (e) => !viewers?.some((v) => v.id === e.id)
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ACCESS_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: ["it-work-management-access-me"] });
  };

  const grantMutation = useMutation({
    mutationFn: (userId: string) => itReadOnlyAccessService.grant(userId),
    onSuccess: () => {
      toast.success("Read-only access granted");
      setSelectedEmployee(UNSET);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revokeMutation = useMutation({
    mutationFn: (userId: string) => itReadOnlyAccessService.revoke(userId),
    onSuccess: () => {
      toast.success("Access revoked");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage read-only access</DialogTitle>
          <DialogDescription>
            Grant an employee (e.g. the CEO) view-only access to IT Work Management — Products,
            Projects, and Work Items. They can never create, edit, assign, or review anything.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={selectedEmployee} onValueChange={(v) => v && setSelectedEmployee(v)}>
            <SelectTrigger className="w-full flex-1" aria-label="Select employee">
              <SelectValue placeholder="Select an employee">
                {(v: string) => {
                  if (v === UNSET) return undefined;
                  const employee = grantableEmployees.find((e) => e.id === v);
                  return employee ? `${employee.fullName} (${employee.employeeId})` : undefined;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {grantableEmployees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.fullName} ({e.employeeId})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            size="sm"
            disabled={!selectedEmployee || grantMutation.isPending}
            onClick={() => selectedEmployee && grantMutation.mutate(selectedEmployee)}
          >
            {grantMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            Grant
          </Button>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Read-only viewers {viewers ? `(${viewers.length})` : ""}
          </p>

          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

          {!isLoading && viewers?.length === 0 && (
            <p className="text-sm text-muted-foreground">No one has read-only access yet.</p>
          )}

          <div className="flex max-h-64 flex-col gap-1 overflow-auto">
            {viewers?.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/50 px-3 py-2"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{v.fullName}</span>
                  <span className="text-xs text-muted-foreground">{v.employeeId}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Revoke access for ${v.fullName}`}
                  disabled={revokeMutation.isPending}
                  onClick={() => revokeMutation.mutate(v.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
