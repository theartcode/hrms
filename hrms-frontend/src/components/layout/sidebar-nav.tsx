"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  Users,
  Megaphone,
  FileBarChart,
  FileSpreadsheet,
  History,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { ROLES, Role } from "@/constants/roles";
import { useAuth } from "@/hooks/use-auth";
import { useAdobeLicenseAccess } from "@/hooks/use-adobe-license-access";
import { useItWorkManagementAccess } from "@/hooks/use-it-work-management-access";

const navItems = [
  { label: "Dashboard", href: ROUTES.DASHBOARD, icon: LayoutDashboard },
  { label: "Attendance", href: ROUTES.ATTENDANCE, icon: CalendarCheck },
  { label: "Leave", href: ROUTES.LEAVE, icon: CalendarDays },
  { label: "Tasks", href: ROUTES.TASKS, icon: ClipboardList },
  {
    label: "Employees",
    href: ROUTES.EMPLOYEES,
    icon: Users,
    allow: [ROLES.ADMIN, ROLES.SUPER_ADMIN] as Role[],
  },
  {
    label: "Reports",
    href: ROUTES.REPORTS,
    icon: FileBarChart,
    allow: [ROLES.ADMIN, ROLES.SUPER_ADMIN] as Role[],
  },
  { label: "Announcements", href: ROUTES.ANNOUNCEMENTS, icon: Megaphone },
  {
    label: "Activity Center",
    href: ROUTES.ACTIVITY,
    icon: History,
    allow: [ROLES.ADMIN, ROLES.SUPER_ADMIN] as Role[],
  },
  {
    label: "Administration",
    href: ROUTES.ADMINISTRATION,
    icon: ShieldCheck,
    allow: [ROLES.ADMIN, ROLES.SUPER_ADMIN] as Role[],
  },
  {
    label: "Adobe Licenses",
    href: ROUTES.ADMINISTRATION_ADOBE_LICENSES,
    icon: FileSpreadsheet,
  },
  {
    label: "IT Work Management",
    href: ROUTES.IT_WORK_MANAGEMENT,
    icon: Wrench,
  },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { canAccess: canAccessAdobeLicenses } = useAdobeLicenseAccess();
  const { canAccess: canAccessItWorkManagement } = useItWorkManagementAccess();
  const isAdmin = !!user && (user.role === ROLES.ADMIN || user.role === ROLES.SUPER_ADMIN);

  const visibleItems = navItems.filter((item) => {
    // Admins reach Adobe Licenses through the Administration page, not the
    // navbar — only a granted non-admin employee gets a direct nav entry.
    if (item.href === ROUTES.ADMINISTRATION_ADOBE_LICENSES) {
      return !isAdmin && canAccessAdobeLicenses;
    }
    // Relationship-based (Admin/Super Admin, or the IT department's head) —
    // not expressible via the plain `allow` role list.
    if (item.href === ROUTES.IT_WORK_MANAGEMENT) {
      return canAccessItWorkManagement;
    }
    return !item.allow || (user && item.allow.includes(user.role));
  });

  return (
    <nav className="flex flex-col gap-1 p-3">
      {visibleItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
