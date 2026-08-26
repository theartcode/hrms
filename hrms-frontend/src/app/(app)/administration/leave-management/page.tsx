"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarRange, History, Loader2, Minus, Plus, UserRound } from "lucide-react";
import { AdministrationPageShell } from "@/features/administration/components/administration-page-shell";
import { GrantExtraLeaveDialog } from "@/features/leave/components/grant-extra-leave-dialog";
import { EditCompOffDialog } from "@/features/leave/components/edit-comp-off-dialog";
import { DeleteCompOffDialog } from "@/features/leave/components/delete-comp-off-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as leaveService from "@/services/leave.service";
import { LEAVE_TYPE_LABELS } from "@/features/leave/leave-status-meta";
import { useEmployeeOptions } from "@/hooks/use-employee-options";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LEAVE_TYPES, LeaveType } from "@/constants/leave-types";

const managedLeaveTypes: { value: LeaveType; label: string }[] = [
  { value: LEAVE_TYPES.SICK, label: "Sick Leave" },
  { value: LEAVE_TYPES.CASUAL_PAID, label: "Casual Leave" },
  { value: LEAVE_TYPES.ANNUAL, label: "Annual Leave" },
  { value: LEAVE_TYPES.COMP_OFF, label: "Comp Off" },
];

export default function AdministrationLeaveManagementPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["leave-allocations"],
    queryFn: () => leaveService.listLeaveAllocations().then((res) => res.data.allocations),
  });

  return (
    <AdministrationPageShell
      title="Manage Leaves"
      description="Adjust leave balances for individual employees and track every allocation."
    >
      {() => (
        <div className="flex flex-col gap-6">
          <ManageLeaveBalance />

          <div className="flex justify-end gap-2">
            <GrantExtraLeaveDialog />
          </div>

          <div className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
            <div className="flex items-center justify-between border-b bg-muted/20 p-6">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                  <History className="h-4 w-4 text-primary" />
                  Leave Allocation History
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  History of manual leave credits granted by system administrators.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Leave Type</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Days Granted</TableHead>
                    <TableHead>Reason / Remarks</TableHead>
                    <TableHead>Granted By</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-8 w-36" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-12" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                      </TableRow>
                    ))
                  ) : !data || data.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                        No manual leave allocations have been recorded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.map((item) => {
                      const initials = item.employee.fullName
                        ? item.employee.fullName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .substring(0, 2)
                            .toUpperCase()
                        : "EM";

                      const dateStr = new Date(item.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      });

                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8 overflow-hidden rounded-full border border-border">
                                <AvatarImage
                                  src={item.employee.profilePhoto ?? undefined}
                                  alt={item.employee.fullName}
                                  className="object-cover object-center w-full h-full"
                                />
                                <AvatarFallback className="text-xs font-semibold">
                                  {initials}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="font-medium text-sm">{item.employee.fullName}</span>
                                <span className="text-xs text-muted-foreground">
                                  {item.employee.employeeId}
                                </span>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge variant="outline" className="font-medium">
                              {LEAVE_TYPE_LABELS[item.leaveType as keyof typeof LEAVE_TYPE_LABELS] || item.leaveType}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-sm font-medium">
                            {item.year}
                          </TableCell>

                          <TableCell>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              +{item.days} day(s)
                            </span>
                          </TableCell>

                          <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                            {item.reason}
                          </TableCell>

                          <TableCell className="text-xs font-medium">
                            {item.grantedBy}
                          </TableCell>

                          <TableCell className="text-xs text-muted-foreground">
                            {dateStr}
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <EditCompOffDialog item={item} />
                              <DeleteCompOffDialog item={item} />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}
    </AdministrationPageShell>
  );
}

function ManageLeaveBalance() {
  const queryClient = useQueryClient();
  const { data: employees, isLoading: employeesLoading } = useEmployeeOptions();
  const [employeeId, setEmployeeId] = useState("");
  const selectedEmployee = employees?.find((employee) => employee.id === employeeId);
  const [leaveType, setLeaveType] = useState<LeaveType>(LEAVE_TYPES.SICK);
  const [period, setPeriod] = useState("H1");
  const [amount, setAmount] = useState(1);
  const [reason, setReason] = useState("");
  const year = new Date().getFullYear();
  const { data: balanceData, isLoading: balanceLoading } = useQuery({
    queryKey: ["leave-balance", employeeId, year],
    queryFn: () => leaveService.getBalance({ employeeId, year }).then((res) => res.data),
    enabled: !!employeeId,
  });
  const mutation = useMutation({
    mutationFn: (delta: number) => leaveService.adjustLeaveBalance(employeeId, { leaveType, period, year, delta, reason }),
    onSuccess: () => {
      toast.success("Leave balance updated");
      queryClient.invalidateQueries({ queryKey: ["leave-balance", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["leave-allocations"] });
      setReason("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const currentBalance = leaveType === LEAVE_TYPES.SICK
    ? balanceData?.sick[period === "H1" ? "half1" : "half2"]
    : leaveType === LEAVE_TYPES.CASUAL_PAID
      ? balanceData?.casualPaid[period === "H1" ? "half1" : "half2"]
      : leaveType === LEAVE_TYPES.ANNUAL
        ? balanceData?.annual
        : balanceData?.compOff;

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <CalendarRange className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Adjust Employee Leave</h2>
            <p className="mt-1 text-sm text-muted-foreground">Choose an employee, review their balance, and make a direct adjustment.</p>
          </div>
        </div>
      </div>
      <div className="p-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-12">
        <div className="flex flex-col gap-2 lg:col-span-5">
          <Label className="flex items-center gap-2"><UserRound className="h-3.5 w-3.5 text-primary" /> Employee</Label>
          <Select value={employeeId} onValueChange={(value) => setEmployeeId(value ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={employeesLoading ? "Loading employees..." : "Select employee"}>
                {(value: string) => {
                  const employee = employees?.find((item) => item.id === value);
                  return employee ? `${employee.fullName} (${employee.employeeId})` : "Select employee";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {employees?.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.fullName} ({employee.employeeId})</SelectItem>)}
            </SelectContent>
          </Select>
          {selectedEmployee && (
            <p className="text-sm font-medium text-primary">
              Managing leaves for {selectedEmployee.fullName} ({selectedEmployee.employeeId})
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 lg:col-span-3">
          <Label>Leave Type</Label>
          <Select value={leaveType} onValueChange={(value) => { setLeaveType(value as LeaveType); setPeriod(value === LEAVE_TYPES.ANNUAL || value === LEAVE_TYPES.COMP_OFF ? "ANNUAL" : "H1"); }}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{managedLeaveTypes.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2 lg:col-span-2">
          <Label>Period</Label>
          <Select value={period} onValueChange={(value) => setPeriod(value ?? "H1")} disabled={leaveType === LEAVE_TYPES.ANNUAL || leaveType === LEAVE_TYPES.COMP_OFF}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="H1">Jan–Jun</SelectItem><SelectItem value="H2">Jul–Dec</SelectItem><SelectItem value="ANNUAL">Annual</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2 lg:col-span-2">
          <Label htmlFor="manage-leave-amount">Days</Label>
          <Input id="manage-leave-amount" type="number" min="0.5" step="0.5" value={amount} onChange={(event) => setAmount(Number(event.target.value))} />
        </div>
        <div className="flex flex-col gap-2 md:col-span-2 lg:col-span-8">
          <Label htmlFor="manage-leave-reason">Reason / Remarks</Label>
          <Textarea id="manage-leave-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason for this balance change" />
        </div>
        <div className="flex flex-col justify-end gap-2 rounded-lg border bg-muted/30 p-3 lg:col-span-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Selected balance</p>
          <p className="text-sm font-semibold">{balanceLoading ? "Loading..." : `${currentBalance?.remaining ?? 0} day(s) remaining`}</p>
          <div className="flex gap-2">
            <Button className="flex-1" disabled={!employeeId || !reason.trim() || amount <= 0 || mutation.isPending} onClick={() => mutation.mutate(amount)}><Plus /> Add</Button>
            <Button className="flex-1" variant="outline" disabled={!employeeId || !reason.trim() || amount <= 0 || mutation.isPending} onClick={() => mutation.mutate(-amount)}><Minus /> Remove</Button>
          </div>
          {mutation.isPending && <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>
      {employeeId && balanceData && (
        <div className="mt-6 border-t pt-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-medium">{selectedEmployee?.fullName}&apos;s Leave Balance</h3>
              <p className="text-xs text-muted-foreground">Available days for {year}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <BalanceSummary label="Sick Leave" value={`${balanceData.sick.half1.remaining ?? 0} / ${balanceData.sick.half2.remaining ?? 0}`} detail="H1 / H2 days remaining" />
            <BalanceSummary label="Casual Leave" value={`${balanceData.casualPaid.half1.remaining ?? 0} / ${balanceData.casualPaid.half2.remaining ?? 0}`} detail="H1 / H2 days remaining" />
            <BalanceSummary label="Annual Leave" value={balanceData.annual.remaining} />
            <BalanceSummary label="Comp Off" value={balanceData.compOff?.remaining ?? 0} />
            <BalanceSummary label="Unpaid Leave" value="Unlimited" />
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function BalanceSummary({ label, value, detail }: { label: string; value: number | string; detail?: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{typeof value === "number" ? `${value} day(s)` : value}</p>
      {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}
