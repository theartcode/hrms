"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, BadgeCheck, Mail, Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RoleGuard } from "@/components/layout/role-guard";
import { useAuth } from "@/hooks/use-auth";
import { ROLES } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import * as employeeService from "@/services/employee.service";
import * as authService from "@/services/auth.service";
import { EmployeeProfileView } from "@/features/employees/components/employee-profile-view";
import { EditEmployeeForm } from "@/features/employees/components/edit-employee-form";
import { TempPasswordDialog } from "@/features/employees/components/temp-password-dialog";

export default function EmployeeDetailPage() {
  return (
    <RoleGuard allow={[ROLES.ADMIN, ROLES.SUPER_ADMIN]}>
      <EmployeeDetailContent />
    </RoleGuard>
  );
}

function EmployeeDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [promoteConfirmOpen, setPromoteConfirmOpen] = useState(false);
  const [resendConfirmOpen, setResendConfirmOpen] = useState(false);
  const [resendTempPassword, setResendTempPassword] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["employee", params.id],
    queryFn: () => employeeService.getEmployee(params.id).then((res) => res.data.employee),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: () =>
      data?.status === "ACTIVE"
        ? employeeService.deactivateEmployee(params.id)
        : employeeService.activateEmployee(params.id),
    onSuccess: () => {
      toast.success(data?.status === "ACTIVE" ? "Employee deactivated" : "Employee activated");
      queryClient.invalidateQueries({ queryKey: ["employee", params.id] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setConfirmOpen(false);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setConfirmOpen(false);
    },
  });

  const promoteMutation = useMutation({
    mutationFn: () => employeeService.promoteToPermanent(params.id),
    onSuccess: () => {
      toast.success(`${data?.fullName} is now a Permanent employee`);
      queryClient.invalidateQueries({ queryKey: ["employee", params.id] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setPromoteConfirmOpen(false);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setPromoteConfirmOpen(false);
    },
  });

  const resendMutation = useMutation({
    mutationFn: () => authService.adminResetPassword(params.id),
    onSuccess: (res) => {
      toast.success(`New login email sent to ${data?.fullName}`);
      setResendTempPassword(res.data.tempPassword);
      setResendConfirmOpen(false);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setResendConfirmOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => employeeService.deleteEmployee(params.id),
    onSuccess: () => {
      toast.success(`${data?.fullName} was deleted`);
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      router.push(ROUTES.EMPLOYEES);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setDeleteConfirmOpen(false);
    },
  });

  // Mirrors the backend's rule: any Admin or Super Admin can delete an
  // Employee or Admin account — never a Super Admin, never their own.
  const canDelete = !!user && !!data && user.id !== data.id && data.role !== ROLES.SUPER_ADMIN;

  // Mirrors adminResetPassword's backend rules (never a Super Admin target,
  // only a Super Admin may reset an Admin's password), plus a UI-only
  // guard against resetting your own — it force-logs-out the target's
  // session, which you don't want to do to yourself by mistake.
  const canResendCredentials =
    !!user &&
    !!data &&
    user.id !== data.id &&
    data.role !== ROLES.SUPER_ADMIN &&
    (data.role !== ROLES.ADMIN || user.role === ROLES.SUPER_ADMIN);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-1 text-center">
        <p className="text-sm font-medium">Employee not found</p>
        <Button variant="link" onClick={() => router.push(ROUTES.EMPLOYEES)}>
          Back to Employees
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit"
          onClick={() => router.push(ROUTES.EMPLOYEES)}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Employees
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          {canResendCredentials && (
            <Button variant="outline" onClick={() => setResendConfirmOpen(true)}>
              <Mail className="h-4 w-4" />
              Resend Login Email
            </Button>
          )}
          {data.employmentType === "PROBATION" && (
            <Button variant="outline" onClick={() => setPromoteConfirmOpen(true)}>
              <BadgeCheck className="h-4 w-4" />
              Mark as Permanent
            </Button>
          )}
          {data.status === "ACTIVE" ? (
            <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
              <PowerOff className="h-4 w-4" />
              Deactivate
            </Button>
          ) : (
            <Button onClick={() => setConfirmOpen(true)}>
              <Power className="h-4 w-4" />
              Activate
            </Button>
          )}
          {canDelete && (
            <Button variant="destructive" onClick={() => setDeleteConfirmOpen(true)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <EmployeeProfileView
        employee={data}
        attendanceHref={`${ROUTES.ATTENDANCE_TEAM}?employeeId=${data.id}`}
      />

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="w-full overflow-y-auto p-6 data-[side=right]:sm:max-w-2xl">
          <SheetHeader className="p-0">
            <SheetTitle>Edit Employee</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <EditEmployeeForm
              employee={data}
              onSaved={() => {
                toast.success("Employee updated");
                queryClient.invalidateQueries({ queryKey: ["employee", params.id] });
                queryClient.invalidateQueries({ queryKey: ["employees"] });
                setEditOpen(false);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={resendConfirmOpen}
        onOpenChange={setResendConfirmOpen}
        title="Resend login email?"
        description={`This generates a new temporary password for ${data.fullName} and emails their sign-in details again. Their current password stops working immediately, and any active session of theirs is signed out.`}
        confirmLabel="Resend"
        isLoading={resendMutation.isPending}
        onConfirm={() => resendMutation.mutate()}
      />

      {resendTempPassword && (
        <TempPasswordDialog
          open
          employeeName={data.fullName}
          employeeId={data.employeeId}
          tempPassword={resendTempPassword}
          title="Login email resent"
          description={
            <>
              A new login email was sent to {data.fullName}. Their old password no longer works.
              Here&apos;s the new temporary password as a backup in case the email doesn&apos;t
              arrive — it will not be shown again.
            </>
          }
          onClose={() => setResendTempPassword(null)}
        />
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={data.status === "ACTIVE" ? "Deactivate employee?" : "Activate employee?"}
        description={
          data.status === "ACTIVE"
            ? `${data.fullName} will no longer be able to log in.`
            : `${data.fullName} will regain access to log in and use the system.`
        }
        confirmLabel={data.status === "ACTIVE" ? "Deactivate" : "Activate"}
        destructive={data.status === "ACTIVE"}
        isLoading={toggleActiveMutation.isPending}
        onConfirm={() => toggleActiveMutation.mutate()}
      />

      <ConfirmDialog
        open={promoteConfirmOpen}
        onOpenChange={setPromoteConfirmOpen}
        title="Mark as Permanent employee?"
        description={`${data.fullName} will be marked as a Permanent employee and start accruing Annual Leave from today. This can't be undone.`}
        confirmLabel="Mark as Permanent"
        isLoading={promoteMutation.isPending}
        onConfirm={() => promoteMutation.mutate()}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete employee?"
        description={`This permanently removes ${data.fullName}'s account and ALL of their attendance, leave, and correction history. This cannot be undone. If you want to keep their history, deactivate them instead.`}
        confirmLabel="Delete"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}
