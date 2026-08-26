"use client";

import {
  Building2,
  Network,
  BriefcaseBusiness,
  MapPin,
  Clock,
  CalendarHeart,
  CalendarDays,
  CalendarPlus,
  Bell,
  Mail,
  ShieldCheck,
  SlidersHorizontal,
  FileSpreadsheet,
} from "lucide-react";
import { RoleGuard } from "@/components/layout/role-guard";
import { ROLES } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import { SettingsCard } from "@/features/administration/components/settings-card";

const CATEGORIES = [
  {
    title: "Company Profile",
    description: "Name, logo, contact details, and timezone.",
    href: ROUTES.ADMINISTRATION_COMPANY_PROFILE,
    icon: Building2,
  },
  {
    title: "Departments",
    description: "Departments employees can be assigned to.",
    href: ROUTES.ADMINISTRATION_DEPARTMENTS,
    icon: Network,
  },
  {
    title: "Designations",
    description: "Job designations employees can be assigned to.",
    href: ROUTES.ADMINISTRATION_DESIGNATIONS,
    icon: BriefcaseBusiness,
  },
  {
    title: "Locations",
    description: "Office locations employees can be assigned to.",
    href: ROUTES.ADMINISTRATION_LOCATIONS,
    icon: MapPin,
  },
  {
    title: "Office Settings",
    description: "Office hours, grace period, working and weekend days.",
    href: ROUTES.ADMINISTRATION_OFFICE_SETTINGS,
    icon: Clock,
  },
  {
    title: "Leave Policy",
    description: "Leave quotas, duration limits, and carry-forward.",
    href: ROUTES.ADMINISTRATION_LEAVE_POLICY,
    icon: CalendarDays,
  },
  {
    title: "Holiday Settings",
    description: "National, company, and optional holidays.",
    href: ROUTES.ADMINISTRATION_HOLIDAYS,
    icon: CalendarHeart,
  },
  {
    title: "Notification Settings",
    description: "In-app and email notification preferences, per event.",
    href: ROUTES.ADMINISTRATION_NOTIFICATION_SETTINGS,
    icon: Bell,
  },
  {
    title: "Email Settings",
    description: "SMTP or AWS SES configuration for outgoing mail.",
    href: ROUTES.ADMINISTRATION_EMAIL_SETTINGS,
    icon: Mail,
  },
  {
    title: "Security Settings",
    description: "Password policy, login lockout, and token lifetimes.",
    href: ROUTES.ADMINISTRATION_SECURITY_SETTINGS,
    icon: ShieldCheck,
  },
  {
    title: "General Settings",
    description: "Date format, time format, currency, and timezone.",
    href: ROUTES.ADMINISTRATION_GENERAL_SETTINGS,
    icon: SlidersHorizontal,
  },
  {
    title: "Adobe Licenses",
    description: "Spreadsheet-style admin data entry for Adobe license tracking.",
    href: ROUTES.ADMINISTRATION_ADOBE_LICENSES,
    icon: FileSpreadsheet,
  },
  {
    title: "Manage Leaves",
    description: "Add or remove leave balances for individual employees.",
    href: ROUTES.ADMINISTRATION_LEAVE_MANAGEMENT,
    icon: CalendarPlus,
  },
];

export default function AdministrationPage() {
  return (
    <RoleGuard allow={[ROLES.ADMIN, ROLES.SUPER_ADMIN]}>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Administration</h1>
          <p className="text-sm text-muted-foreground">
            Company-wide policies and configuration — changes apply immediately, no code changes required.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((category) => (
            <SettingsCard key={category.href} {...category} />
          ))}
        </div>
      </div>
    </RoleGuard>
  );
}
