import { IT_WORK_TYPE, IT_WORK_ITEM_STATUS, ITWorkType, ITWorkItemStatus } from "../shared/constants/itWorkItemTypes";
import { IT_PROJECT_STATUS, IT_PROJECT_PRIORITY, ITProjectStatus, ITProjectPriority } from "../shared/constants/itProjectTypes";

// Pure data definitions for the IT Work Management sample-data seed —
// shared by seed-it-work-management-sample-data.ts and
// reset-it-work-management-sample-data.ts so both scripts always agree on
// exactly what "sample data" means, with no separate manifest file to keep
// in sync. Every record here is looked up by a stable natural key (email
// for Users, name for Products, {name, product} for Projects, {title,
// product} for Work Items) so both scripts are idempotent by construction.
//
// This file has no side effects — importing it touches no database.

export const SAMPLE_PASSWORD = "ItSample@2026";

export type SampleUserKey = "head" | "jr1" | "jr2" | "jr3" | "exec";

export interface SampleUserSpec {
  key: SampleUserKey;
  employeeId: string;
  email: string;
  fullName: string;
  phone: string;
}

// The IT Head is NOT always synthetic — Part 4 of the brief is explicit:
// "If there are already development/sample users, reuse them" for this
// role, and Part 7 forbids ever overwriting a real Department("IT") head.
// This spec is only used as a fallback, when Department("IT") doesn't
// exist yet or has no head at all — see resolveItHead() in the seed
// script. It is never created if a real head is already in place.
export const SYNTHETIC_HEAD_SPEC: SampleUserSpec = {
  key: "head",
  employeeId: "ITSAMPLE-HEAD",
  email: "it.sample.head@hrms.sample",
  fullName: "IT Sample Head",
  phone: "9000000001",
};

// Clearly synthetic emails/names/employeeIds (Part 5 of the brief) — never
// resembling a real employee, and never routed through the shared EMP-####
// counter real employee onboarding uses, so this can never collide with or
// perturb real employee-id sequencing. Always created (or reused if this
// seed already ran once) — unlike the Head, there's no "real junior" to
// prefer reusing here.
export const SAMPLE_USERS: SampleUserSpec[] = [
  {
    key: "jr1",
    employeeId: "ITSAMPLE-JR1",
    email: "it.sample.junior1@hrms.sample",
    fullName: "IT Sample Junior 1",
    phone: "9000000002",
  },
  {
    key: "jr2",
    employeeId: "ITSAMPLE-JR2",
    email: "it.sample.junior2@hrms.sample",
    fullName: "IT Sample Junior 2",
    phone: "9000000003",
  },
  {
    key: "jr3",
    employeeId: "ITSAMPLE-JR3",
    email: "it.sample.junior3@hrms.sample",
    fullName: "IT Sample Junior 3",
    phone: "9000000004",
  },
  {
    key: "exec",
    employeeId: "ITSAMPLE-EXEC",
    email: "it.sample.executive@hrms.sample",
    fullName: "IT Sample Executive Viewer",
    phone: "9000000005",
  },
];

export const IT_DEPARTMENT_NAME = "IT";

export type SampleProductKey =
  | "hrms"
  | "lms"
  | "treqqo"
  | "treqqoLms"
  | "tac"
  | "ott"
  | "website";

export interface SampleProductSpec {
  key: SampleProductKey;
  name: string;
  description: string;
}

export const SAMPLE_PRODUCTS: SampleProductSpec[] = [
  { key: "hrms", name: "HRMS", description: "Internal HRMS platform for employee, attendance, leave, payroll and HR operations." },
  { key: "lms", name: "LMS", description: "Learning management platform for training and course delivery." },
  { key: "treqqo", name: "Treqqo", description: "Primary Treqqo business/product platform." },
  { key: "treqqoLms", name: "Treqqo LMS", description: "Learning platform associated with the Treqqo ecosystem." },
  { key: "tac", name: "TAC", description: "TAC website and associated digital services." },
  { key: "ott", name: "OTT", description: "OTT platform and supporting digital services." },
  { key: "website", name: "Website", description: "Corporate and public-facing website development and maintenance." },
];

export type SampleProjectKey =
  | "hrmsAttendance"
  | "hrmsEmployeeMgmt"
  | "lmsCourseMgmt"
  | "lmsUiModernization"
  | "treqqoWebsiteRevamp"
  | "treqqoClientSprint"
  | "treqqoLmsFeature"
  | "tacWebsiteDev"
  | "ottMaintenance"
  | "corporateWebsiteRedesign";

export interface SampleProjectSpec {
  key: SampleProjectKey;
  name: string;
  description: string;
  product: SampleProductKey;
  status: ITProjectStatus;
  priority: ITProjectPriority;
  startDate: string;
  targetDate: string;
  owner: SampleUserKey;
  /** If set, the project is created at `status` above then immediately walked to this status via the real changeProjectStatus workflow — used for exactly one project so "today's activity" has a real IT_PROJECT_STATUS_CHANGED event to show. */
  transitionToday?: ITProjectStatus;
}

// Ten projects across all seven products (Part 9), with four deliberately
// built to exercise the Phase 1E-A "At Risk" rule end to end (Part 10):
// hrmsAttendance = overdue Work Items, treqqoClientSprint = blocked Work
// Item, tacWebsiteDev = target date already passed, lmsCourseMgmt = healthy
// control. Status mix intentionally varied (Part 9: not everything ACTIVE).
export const SAMPLE_PROJECTS: SampleProjectSpec[] = [
  {
    key: "hrmsAttendance",
    name: "HRMS Attendance Improvements",
    description: "Improve attendance capture accuracy, correction workflow, and reporting inside the HRMS platform.",
    product: "hrms",
    status: IT_PROJECT_STATUS.ACTIVE,
    priority: IT_PROJECT_PRIORITY.HIGH,
    startDate: "2026-07-01",
    targetDate: "2026-09-15",
    owner: "head",
  },
  {
    key: "hrmsEmployeeMgmt",
    name: "HRMS Employee Management Enhancements",
    description: "Enhancements to employee record management, bulk actions, and profile completeness tracking.",
    product: "hrms",
    status: IT_PROJECT_STATUS.PLANNED,
    priority: IT_PROJECT_PRIORITY.MEDIUM,
    startDate: "2026-09-01",
    targetDate: "2026-10-15",
    owner: "head",
  },
  {
    key: "lmsCourseMgmt",
    name: "LMS Course Management Improvements",
    description: "Improve course authoring, enrollment, and progress tracking in the LMS.",
    product: "lms",
    status: IT_PROJECT_STATUS.ACTIVE,
    priority: IT_PROJECT_PRIORITY.MEDIUM,
    startDate: "2026-06-01",
    targetDate: "2026-09-30",
    owner: "jr1",
  },
  {
    key: "lmsUiModernization",
    name: "LMS UI Modernization",
    description: "Refresh the LMS interface with the updated design system. On hold pending design sign-off.",
    product: "lms",
    status: IT_PROJECT_STATUS.ON_HOLD,
    priority: IT_PROJECT_PRIORITY.LOW,
    startDate: "2026-08-01",
    targetDate: "2026-11-01",
    owner: "head",
  },
  {
    key: "treqqoWebsiteRevamp",
    name: "Treqqo Website Revamp",
    description: "Full revamp of the Treqqo marketing website, including new pages and performance improvements.",
    product: "treqqo",
    status: IT_PROJECT_STATUS.ACTIVE,
    priority: IT_PROJECT_PRIORITY.HIGH,
    startDate: "2026-05-01",
    targetDate: "2026-09-20",
    owner: "head",
  },
  {
    key: "treqqoClientSprint",
    name: "Treqqo Client Request Sprint",
    description: "Focused sprint to deliver a batch of outstanding client-requested changes for Treqqo.",
    product: "treqqo",
    status: IT_PROJECT_STATUS.ACTIVE,
    priority: IT_PROJECT_PRIORITY.URGENT,
    startDate: "2026-07-15",
    targetDate: "2026-09-05",
    owner: "head",
  },
  {
    key: "treqqoLmsFeature",
    name: "Treqqo LMS Feature Development",
    description: "New feature set for the Treqqo LMS learning experience, delivered and closed out.",
    product: "treqqoLms",
    status: IT_PROJECT_STATUS.COMPLETED,
    priority: IT_PROJECT_PRIORITY.MEDIUM,
    startDate: "2026-04-01",
    targetDate: "2026-08-10",
    owner: "jr2",
  },
  {
    key: "tacWebsiteDev",
    name: "TAC Website Development",
    description: "Development of the TAC website and its supporting digital services.",
    product: "tac",
    status: IT_PROJECT_STATUS.ACTIVE,
    priority: IT_PROJECT_PRIORITY.HIGH,
    startDate: "2026-04-01",
    targetDate: "2026-08-15", // before "today" (2026-08-25) — target date passed, still ACTIVE
    owner: "head",
  },
  {
    key: "ottMaintenance",
    name: "OTT Maintenance & Improvements",
    description: "Routine OTT platform maintenance stream — cancelled after the platform's roadmap was replaced.",
    product: "ott",
    status: IT_PROJECT_STATUS.CANCELLED,
    priority: IT_PROJECT_PRIORITY.LOW,
    startDate: "2026-03-01",
    targetDate: "2026-07-01",
    owner: "head",
  },
  {
    key: "corporateWebsiteRedesign",
    name: "Corporate Website Redesign",
    description: "Redesign of the corporate public-facing website.",
    product: "website",
    status: IT_PROJECT_STATUS.PLANNED,
    priority: IT_PROJECT_PRIORITY.MEDIUM,
    startDate: "2026-08-25",
    targetDate: "2026-11-30",
    owner: "head",
    transitionToday: IT_PROJECT_STATUS.ACTIVE,
  },
];

// "At Risk" test projects (Part 10) — for the verification report, not
// used by the seed/reset logic directly.
export const RISK_TEST_PROJECT_KEYS = {
  overdue: "hrmsAttendance" as SampleProjectKey,
  blocked: "treqqoClientSprint" as SampleProjectKey,
  targetDatePassed: "tacWebsiteDev" as SampleProjectKey,
  healthy: "lmsCourseMgmt" as SampleProjectKey,
};

type ExtraAction =
  | "none"
  | "review" // submit -> APPROVE -> COMPLETED
  | "reviewRequestChanges" // submit -> REQUEST_CHANGES -> back to IN_PROGRESS, reviewNote set
  | "inReview" // submit only -> stays IN_REVIEW
  | "blocked" // BLOCKED, with blockedReason
  | "cancelled"; // CANCELLED, with cancelReason

export interface SampleWorkItemSpec {
  key: string;
  title: string;
  description: string;
  product: SampleProductKey;
  project: SampleProjectKey | null;
  workType: ITWorkType;
  priority: ITProjectPriority;
  dueDate: string | null;
  assignee: SampleUserKey | null;
  reviewer: SampleUserKey | null;
  /** How far along the generic REQUESTED->ANALYSIS->PLANNED->ASSIGNED->IN_PROGRESS pipeline this item is walked via the real changeWorkItemStatus workflow, before `extra` (if any) is applied. */
  stopAt: ITWorkItemStatus;
  extra: ExtraAction;
  extraReason?: string;
  /** Only for extra: "review" items — backdates completedAt (in days before "today") after the real approval sets it to now, so the dashboards' 7-day "recently completed" window has both fresh and stale examples (Part 17/21). */
  backdateCompletedDays?: number;
}

const T = IT_WORK_TYPE;
const P = IT_PROJECT_PRIORITY;
const S = IT_WORK_ITEM_STATUS;

// 35 Work Items covering every status in the enum at least once (Part 13),
// every work type (Part 11), every priority (Part 14), spread across all 3
// sample team members with intentionally uneven load (Part 15), and the
// specific overdue/blocked/changes-requested/completed scenarios Parts
// 17-22 call for. Every status transition below is driven by the real
// it-work-item.service.ts functions when the seed script runs — this file
// only declares the target shape.
export const SAMPLE_WORK_ITEMS: SampleWorkItemSpec[] = [
  // REQUESTED (3) — unassigned, not yet triaged.
  { key: "R1", title: "New client portal login page", description: "Client has requested a new portal login experience; scoping not yet started.", product: "treqqo", project: null, workType: T.NEW_WEBSITE, priority: P.MEDIUM, dueDate: "2026-09-20", assignee: null, reviewer: null, stopAt: S.REQUESTED, extra: "none" },
  { key: "R2", title: "Investigate LMS certificate export bug", description: "Certificate PDF export occasionally fails; needs investigation.", product: "lms", project: "lmsCourseMgmt", workType: T.BUG_FIX, priority: P.LOW, dueDate: null, assignee: null, reviewer: null, stopAt: S.REQUESTED, extra: "none" },
  { key: "R3", title: "OTT app crash reports triage", description: "Triage recent crash reports from the OTT mobile app before assigning.", product: "ott", project: null, workType: T.INTERNAL_IT_SUPPORT, priority: P.MEDIUM, dueDate: "2026-09-25", assignee: null, reviewer: null, stopAt: S.REQUESTED, extra: "none" },

  // ANALYSIS (3)
  { key: "AN1", title: "HRMS payroll export analysis", description: "Analyze current payroll export format ahead of the enhancement work.", product: "hrms", project: "hrmsEmployeeMgmt", workType: T.RESEARCH, priority: P.MEDIUM, dueDate: "2026-09-10", assignee: null, reviewer: null, stopAt: S.ANALYSIS, extra: "none" },
  { key: "AN2", title: "TAC website accessibility audit", description: "Accessibility audit of the current TAC website ahead of the redesign.", product: "tac", project: "tacWebsiteDev", workType: T.RESEARCH, priority: P.LOW, dueDate: "2026-09-18", assignee: null, reviewer: null, stopAt: S.ANALYSIS, extra: "none" },
  { key: "AN3", title: "Treqqo LMS SSO feasibility", description: "Feasibility check for single sign-on into the Treqqo LMS.", product: "treqqoLms", project: null, workType: T.RESEARCH, priority: P.HIGH, dueDate: "2026-09-12", assignee: null, reviewer: null, stopAt: S.ANALYSIS, extra: "none" },

  // PLANNED (3)
  { key: "PL1", title: "Website homepage redesign", description: "Redesign the corporate homepage layout and hero section.", product: "website", project: "corporateWebsiteRedesign", workType: T.UI_UX, priority: P.MEDIUM, dueDate: "2026-10-05", assignee: "jr1", reviewer: null, stopAt: S.PLANNED, extra: "none" },
  { key: "PL2", title: "HRMS leave balance report enhancement", description: "Add filters and export options to the leave balance report.", product: "hrms", project: "hrmsEmployeeMgmt", workType: T.HRMS_DEVELOPMENT, priority: P.MEDIUM, dueDate: "2026-10-10", assignee: "jr2", reviewer: null, stopAt: S.PLANNED, extra: "none" },
  { key: "PL3", title: "LMS mobile responsiveness pass", description: "Fix layout issues on small screens across the LMS.", product: "lms", project: "lmsUiModernization", workType: T.UI_UX, priority: P.LOW, dueDate: "2026-10-20", assignee: "jr3", reviewer: null, stopAt: S.PLANNED, extra: "none" },

  // ASSIGNED (3)
  { key: "AS1", title: "Treqqo website new pricing page", description: "Build the new pricing page for the Treqqo website revamp.", product: "treqqo", project: "treqqoWebsiteRevamp", workType: T.NEW_WEBSITE, priority: P.HIGH, dueDate: "2026-09-08", assignee: "jr1", reviewer: null, stopAt: S.ASSIGNED, extra: "none" },
  { key: "AS2", title: "TAC server SSL renewal", description: "Renew and deploy the SSL certificate for the TAC production server.", product: "tac", project: "tacWebsiteDev", workType: T.SERVER_DEPLOYMENT, priority: P.URGENT, dueDate: "2026-08-30", assignee: "jr2", reviewer: null, stopAt: S.ASSIGNED, extra: "none" },
  { key: "AS3", title: "OTT content catalog sync fix", description: "Fix the periodic catalog sync job dropping entries intermittently.", product: "ott", project: null, workType: T.BUG_FIX, priority: P.MEDIUM, dueDate: "2026-09-05", assignee: "jr3", reviewer: null, stopAt: S.ASSIGNED, extra: "none" },

  // IN_PROGRESS (7): 3 overdue, 2 due-soon/future, 2 changes-requested
  { key: "IP1", title: "HRMS attendance regularization bug fix", description: "Regularization requests occasionally fail to update the attendance total.", product: "hrms", project: "hrmsAttendance", workType: T.BUG_FIX, priority: P.URGENT, dueDate: "2026-08-21", assignee: "jr1", reviewer: null, stopAt: S.IN_PROGRESS, extra: "none" },
  { key: "IP2", title: "HRMS attendance report timezone fix", description: "Attendance report totals are off by one hour for IST edge cases.", product: "hrms", project: "hrmsAttendance", workType: T.BUG_FIX, priority: P.HIGH, dueDate: "2026-08-22", assignee: "jr2", reviewer: null, stopAt: S.IN_PROGRESS, extra: "none" },
  { key: "IP3", title: "Treqqo pricing page copy update", description: "Update pricing page copy per the latest client feedback.", product: "treqqo", project: "treqqoWebsiteRevamp", workType: T.CLIENT_REQUEST, priority: P.MEDIUM, dueDate: "2026-08-24", assignee: "jr3", reviewer: null, stopAt: S.IN_PROGRESS, extra: "none" },
  { key: "IP4", title: "LMS enrollment email template update", description: "Refresh the enrollment confirmation email template.", product: "lms", project: "lmsCourseMgmt", workType: T.MAINTENANCE, priority: P.LOW, dueDate: "2026-08-28", assignee: "jr1", reviewer: null, stopAt: S.IN_PROGRESS, extra: "none" },
  { key: "IP5", title: "Website blog module setup", description: "Set up the new blog module for the corporate website redesign.", product: "website", project: "corporateWebsiteRedesign", workType: T.NEW_WEBSITE, priority: P.MEDIUM, dueDate: "2026-09-15", assignee: "jr2", reviewer: null, stopAt: S.IN_PROGRESS, extra: "none" },
  { key: "IP6", title: "Treqqo client dashboard mobile layout", description: "Client dashboard layout breaks on narrow mobile widths.", product: "treqqo", project: "treqqoClientSprint", workType: T.UI_UX, priority: P.HIGH, dueDate: "2026-08-27", assignee: "jr3", reviewer: "head", stopAt: S.IN_PROGRESS, extra: "reviewRequestChanges", extraReason: "Please handle the mobile layout before resubmitting." },
  { key: "IP7", title: "HRMS API empty-response handling", description: "The employee summary endpoint doesn't handle an empty result set gracefully.", product: "hrms", project: "hrmsAttendance", workType: T.HRMS_DEVELOPMENT, priority: P.MEDIUM, dueDate: "2026-08-29", assignee: "jr1", reviewer: "head", stopAt: S.IN_PROGRESS, extra: "reviewRequestChanges", extraReason: "Add validation for the empty API response." },

  // IN_REVIEW (4)
  { key: "RV1", title: "HRMS attendance CSV export bug fix", description: "CSV export fails when an employee name contains a comma.", product: "hrms", project: "hrmsAttendance", workType: T.BUG_FIX, priority: P.HIGH, dueDate: "2026-08-30", assignee: "jr1", reviewer: "head", stopAt: S.IN_PROGRESS, extra: "inReview" },
  { key: "RV2", title: "Treqqo header navigation update", description: "Updated header navigation to match the new site structure.", product: "treqqo", project: "treqqoWebsiteRevamp", workType: T.UI_UX, priority: P.MEDIUM, dueDate: "2026-09-02", assignee: "jr2", reviewer: "head", stopAt: S.IN_PROGRESS, extra: "inReview" },
  { key: "RV3", title: "LMS quiz feature — new question types", description: "Added multiple-choice and short-answer question types to the LMS quiz builder.", product: "lms", project: "lmsCourseMgmt", workType: T.CLIENT_REQUEST, priority: P.MEDIUM, dueDate: "2026-09-03", assignee: "jr3", reviewer: "head", stopAt: S.IN_PROGRESS, extra: "inReview" },
  { key: "RV4", title: "TAC website contact form update", description: "Updated the contact form fields and validation per the latest requirements.", product: "tac", project: "tacWebsiteDev", workType: T.EXISTING_WEBSITE_CHANGE, priority: P.LOW, dueDate: "2026-08-31", assignee: "jr2", reviewer: "head", stopAt: S.IN_PROGRESS, extra: "inReview" },

  // BLOCKED (3) — one also overdue, to exercise the Blocked > Overdue attention priority.
  { key: "BL1", title: "Treqqo client API integration", description: "Integrate with the client's API to pull order data into Treqqo.", product: "treqqo", project: "treqqoClientSprint", workType: T.CLIENT_REQUEST, priority: P.URGENT, dueDate: "2026-08-23", assignee: "jr2", reviewer: null, stopAt: S.IN_PROGRESS, extra: "blocked", extraReason: "Waiting for client API credentials." },
  { key: "BL2", title: "TAC production deployment", description: "Deploy the latest TAC website build to production.", product: "tac", project: "tacWebsiteDev", workType: T.SERVER_DEPLOYMENT, priority: P.HIGH, dueDate: "2026-09-01", assignee: "jr3", reviewer: null, stopAt: S.IN_PROGRESS, extra: "blocked", extraReason: "Deployment environment is unavailable." },
  { key: "BL3", title: "OTT catalog metadata clarification", description: "Update catalog metadata fields per the new content partner spec.", product: "ott", project: null, workType: T.CLIENT_REQUEST, priority: P.MEDIUM, dueDate: "2026-09-04", assignee: "jr1", reviewer: null, stopAt: S.IN_PROGRESS, extra: "blocked", extraReason: "Requirement clarification pending from client." },

  // COMPLETED (7) — 5 within the last 7 days, 2 backdated older to test the window.
  { key: "CP1", title: "HRMS login page bug fix", description: "Fixed a stale-session bug causing intermittent login failures.", product: "hrms", project: "hrmsAttendance", workType: T.BUG_FIX, priority: P.HIGH, dueDate: "2026-08-20", assignee: "jr1", reviewer: "head", stopAt: S.IN_PROGRESS, extra: "review" },
  { key: "CP2", title: "Treqqo footer links update", description: "Updated footer links to match the new site map.", product: "treqqo", project: "treqqoWebsiteRevamp", workType: T.EXISTING_WEBSITE_CHANGE, priority: P.LOW, dueDate: "2026-08-18", assignee: "jr2", reviewer: "head", stopAt: S.IN_PROGRESS, extra: "review" },
  { key: "CP3", title: "LMS password reset flow fix", description: "Password reset emails were not sending for a subset of accounts.", product: "lms", project: "lmsCourseMgmt", workType: T.BUG_FIX, priority: P.MEDIUM, dueDate: "2026-08-19", assignee: "jr3", reviewer: "head", stopAt: S.IN_PROGRESS, extra: "review" },
  { key: "CP4", title: "Treqqo LMS certificate template", description: "New completion certificate template for the Treqqo LMS.", product: "treqqoLms", project: "treqqoLmsFeature", workType: T.UI_UX, priority: P.MEDIUM, dueDate: "2026-08-05", assignee: "jr1", reviewer: "head", stopAt: S.IN_PROGRESS, extra: "review" },
  { key: "CP5", title: "Website SSL certificate renewal", description: "Renewed and deployed the SSL certificate for the corporate website.", product: "website", project: null, workType: T.SERVER_DEPLOYMENT, priority: P.URGENT, dueDate: "2026-08-15", assignee: "jr2", reviewer: "head", stopAt: S.IN_PROGRESS, extra: "review" },
  { key: "CP6", title: "OTT app icon update", description: "Updated the OTT mobile app icon for the seasonal campaign.", product: "ott", project: null, workType: T.MAINTENANCE, priority: P.LOW, dueDate: "2026-08-10", assignee: "jr3", reviewer: "head", stopAt: S.IN_PROGRESS, extra: "review", backdateCompletedDays: 12 },
  { key: "CP7", title: "TAC contact page bug fix", description: "Fixed a validation bug on the TAC contact page form.", product: "tac", project: "tacWebsiteDev", workType: T.BUG_FIX, priority: P.MEDIUM, dueDate: "2026-08-08", assignee: "jr1", reviewer: "head", stopAt: S.IN_PROGRESS, extra: "review", backdateCompletedDays: 15 },

  // CANCELLED (2)
  { key: "CX1", title: "OTT legacy analytics integration", description: "Integrate the legacy analytics SDK into the OTT platform.", product: "ott", project: "ottMaintenance", workType: T.INTERNAL_IT_SUPPORT, priority: P.LOW, dueDate: "2026-08-15", assignee: "jr2", reviewer: null, stopAt: S.ASSIGNED, extra: "cancelled", extraReason: "Client cancelled the requirement." },
  { key: "CX2", title: "Treqqo old login flow replacement", description: "Replace the legacy Treqqo login flow with the new authentication service.", product: "treqqo", project: null, workType: T.EXISTING_WEBSITE_CHANGE, priority: P.MEDIUM, dueDate: "2026-09-01", assignee: "jr3", reviewer: null, stopAt: S.ASSIGNED, extra: "cancelled", extraReason: "Requirement replaced by a new implementation." },
];

export interface SampleCommentSpec {
  workItemKey: string;
  author: SampleUserKey;
  body: string;
}

// 13 comments (Part 23) across a representative subset of Work Items —
// deliberately not on all 35, matching the brief's "approximately 10-15".
export const SAMPLE_COMMENTS: SampleCommentSpec[] = [
  { workItemKey: "IP1", author: "jr1", body: "Implemented the API validation. Testing the edge cases now." },
  { workItemKey: "IP1", author: "head", body: "Please also verify the mobile layout before submitting." },
  { workItemKey: "IP7", author: "jr1", body: "Found the issue in the production configuration. Checking the deployment environment." },
  { workItemKey: "RV1", author: "jr1", body: "Submitted for review — CSV export now handles special characters correctly." },
  { workItemKey: "RV1", author: "head", body: "Looks good, reviewing the edge cases now." },
  { workItemKey: "RV2", author: "jr2", body: "Header nav update ready, tested across breakpoints." },
  { workItemKey: "RV3", author: "jr3", body: "New question types implemented — multiple choice and short answer." },
  { workItemKey: "BL1", author: "jr2", body: "Found the issue in the production configuration. Checking the deployment environment." },
  { workItemKey: "BL2", author: "jr3", body: "Escalated to DevOps for environment access." },
  { workItemKey: "IP6", author: "jr3", body: "Working on the mobile layout fix now." },
  { workItemKey: "IP6", author: "head", body: "Thanks — let me know once it's ready for re-review." },
  { workItemKey: "CP1", author: "jr1", body: "Root cause was a stale session token. Fixed and verified in staging." },
  { workItemKey: "CP3", author: "jr3", body: "Password reset emails now sending correctly after the fix." },
];
