"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import * as employeeService from "@/services/employee.service";
import { EmployeeProfileView } from "@/features/employees/components/employee-profile-view";
import { EditProfileForm } from "@/features/employees/components/edit-profile-form";
import { ROUTES } from "@/constants/routes";

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => employeeService.getMyProfile().then((res) => res.data.employee),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-sm text-destructive">Couldn&apos;t load your profile.</p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Profile</h1>
          <p className="text-sm text-muted-foreground">
            View your details and update your contact information.
          </p>
        </div>
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4" />
          Edit
        </Button>
      </div>

      <EmployeeProfileView employee={data} attendanceHref={ROUTES.ATTENDANCE} />

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="w-full overflow-y-auto p-6 data-[side=right]:sm:max-w-lg">
          <SheetHeader className="p-0">
            <SheetTitle>Edit Profile</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <EditProfileForm
              employee={data}
              onSaved={() => {
                toast.success("Profile updated");
                queryClient.invalidateQueries({ queryKey: ["my-profile"] });
                setEditOpen(false);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
