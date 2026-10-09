import { Role } from "@/constants/roles";
import { EmployeeStatus } from "@/constants/employee-status";
import { EmploymentType } from "@/constants/employment-type";

export interface ReferenceData {
  _id: string;
  name: string;
  isActive: boolean;
}

export interface EmergencyContact {
  name: string;
  phone: string;
}

// The minimal shape GET /employees/assignable returns — deliberately not
// the full Employee record (no email/phone/role/status/etc.), and its
// `department` omits `isActive` since that endpoint's populate() only
// selects `name`.
export interface AssignableEmployee {
  id: string;
  employeeId: string;
  fullName: string;
  department: { _id: string; name: string } | null;
}

export interface UpcomingAnniversary {
  employeeId: string;
  fullName: string;
  date: string;
  years: number;
}

// The minimal shape the `manager` populate() selects — not a full Employee.
// Uses `_id` (not `id`), same as `department`/`designation`, since this is
// the raw populated Mongoose subdocument, not run through toId().
export interface ManagerRef {
  _id: string;
  fullName: string;
  employeeId: string;
}

export interface PaymentInfo {
  ifscCode: string;
  accountNumber: string;
  accountHolderName: string;
}

export interface StatutoryInfo {
  pan: string | null;
  pfStatus: string;
  pfUan: string | null;
  professionalTaxStatus: string;
  lwfStatus: string;
  esicStatus: string;
  esicIpNumber: string | null;
}

export interface Employee {
  id: string;
  employeeId: string;
  fullName: string;
  email: string;
  phone: string;
  department: ReferenceData | null;
  designation: ReferenceData | null;
  role: Role;
  status: EmployeeStatus;
  mustChangePassword: boolean;
  joiningDate: string;
  dateOfBirth: string | null;
  profilePhoto: string | null;
  address: string | null;
  emergencyContact: EmergencyContact | null;
  gracePeriodOverrideMinutes: number | null;
  employmentType: EmploymentType;
  permanentSince: string | null;
  probationEndDate: string | null;
  probationEndNotifiedAt: string | null;
  salary?: number | null;
  bloodGroup?: string | null;
  manager: ManagerRef | null;
  location: ReferenceData | null;
  gender: string | null;
  whatsappEnabled: boolean;
  shiftStartTime: string | null;
  shiftEndTime: string | null;
  numberOfBonuses: number | null;
  advanceSalaryBalance: number | null;
  advanceSalaryEmi: number | null;
  paymentInfo: PaymentInfo | null;
  statutoryInfo: StatutoryInfo | null;
  // Set once the employee submits a bank details change of their own —
  // stays populated (status APPROVED/REJECTED) after review so the profile
  // can still show "last change was rejected: ...", not just while pending.
  pendingPaymentInfo: PaymentInfo | null;
  paymentInfoReviewStatus: "PENDING" | "APPROVED" | "REJECTED" | null;
  paymentInfoReviewedAt: string | null;
  paymentInfoReviewComment: string | null;
  createdAt: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface EmployeeListResult {
  employees: Employee[];
  pagination: PaginationInfo;
}
