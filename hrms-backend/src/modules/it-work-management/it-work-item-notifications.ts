import { ROLES } from "../../shared/constants/roles";
import { NOTIFICATION_TYPES } from "../../shared/constants/notificationTypes";
import { notifyUser } from "../notifications/notifications.service";
import { UserModel } from "../user/user.model";
import { DepartmentModel } from "../department/department.model";
import { IITWorkItem } from "./it-work-item.model";

// Reuses the existing generic Notification infrastructure directly
// (notifyUser — model/service/routes/read-unread/UI all untouched) rather
// than building a second notification system. See the Phase 1D-C report
// for why this module needed no new collection, route, or email template.
//
// No `email` payload is ever passed here — every call below is in-app
// only, per the brief's explicit "in-app first, no automatic email for
// IT events." Since these types were also deliberately left out of
// notifications.service.ts's EVENT_TOGGLE_BY_TYPE map, even a future
// accidental `email:` addition here would silently no-op rather than send,
// but the real safeguard is simply never passing it.

type WorkItemRef = Pick<IITWorkItem, "_id" | "workItemId" | "title">;

function workItemLabel(workItem: WorkItemRef): string {
  return `${workItem.workItemId} — ${workItem.title}`;
}

function truncate(text: string, max = 200): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function metadataFor(workItem: WorkItemRef) {
  return { workItemId: String(workItem._id) };
}

// The exact "manage tier" population — Admin, Super Admin, or the IT
// department's head — mirroring it-access.ts's getItAccessTier definition
// so this never notifies someone who isn't actually authorized to act on
// the item. Deliberately does NOT include plain IT team members or
// readonly viewers: per §9 of the brief, a readonly viewer is a visibility
// grant, not a "management fallback" recipient.
async function getManageTierRecipientIds(excludeUserId: string): Promise<string[]> {
  const [admins, itDepartment] = await Promise.all([
    UserModel.find({ role: { $in: [ROLES.ADMIN, ROLES.SUPER_ADMIN] } }).select("_id"),
    DepartmentModel.findOne({ name: /^IT$/i }).select("headEmployeeId"),
  ]);
  const ids = new Set<string>();
  for (const admin of admins) ids.add(String(admin._id));
  if (itDepartment?.headEmployeeId) ids.add(String(itDepartment.headEmployeeId));
  ids.delete(excludeUserId);
  return Array.from(ids);
}

// Assignment / reassignment — §5 of the brief: never fires when the new
// assignee is unchanged (callers only invoke this when it actually
// changed) and never notifies someone about assigning themselves.
export async function notifyWorkItemAssigned(
  actorId: string,
  workItem: WorkItemRef,
  assigneeId: string,
  isReassignment: boolean
): Promise<void> {
  if (assigneeId === actorId) return;
  await notifyUser({
    user: assigneeId,
    type: isReassignment
      ? NOTIFICATION_TYPES.IT_WORK_ITEM_REASSIGNED
      : NOTIFICATION_TYPES.IT_WORK_ITEM_ASSIGNED,
    title: isReassignment ? "IT Work Item Reassigned" : "IT Work Item Assigned",
    message: `${workItemLabel(workItem)} was ${isReassignment ? "reassigned" : "assigned"} to you.`,
    metadata: metadataFor(workItem),
  });
}

// Submit for review — notifies the named reviewer if one exists; otherwise
// falls back to the manage-tier pool (§3: "otherwise the appropriate IT
// management recipient"), never both, so there is no double notification
// when the reviewer also happens to be manage-tier.
export async function notifySubmittedForReview(
  actorId: string,
  workItem: WorkItemRef,
  reviewerId: string | null
): Promise<void> {
  const message = `${workItemLabel(workItem)} was submitted for review.`;
  const metadata = metadataFor(workItem);
  const base = {
    type: NOTIFICATION_TYPES.IT_WORK_ITEM_SUBMITTED_FOR_REVIEW,
    title: "Work Item Submitted for Review",
    message,
    metadata,
  };

  if (reviewerId) {
    if (reviewerId === actorId) return;
    await notifyUser({ user: reviewerId, ...base });
    return;
  }

  const recipients = await getManageTierRecipientIds(actorId);
  await Promise.all(recipients.map((user) => notifyUser({ user, ...base })));
}

// Review decision — §6: the assignee only, never the reviewer who took the
// action (self-notification is never sent). Self-approval is already
// blocked at the service layer, so actorId === assigneeId can't happen in
// practice here, but the guard stays as defense-in-depth.
export async function notifyReviewDecision(
  actorId: string,
  workItem: WorkItemRef,
  assigneeId: string | null,
  decision: "APPROVE" | "REQUEST_CHANGES",
  reason?: string
): Promise<void> {
  if (!assigneeId || assigneeId === actorId) return;
  const approved = decision === "APPROVE";
  await notifyUser({
    user: assigneeId,
    type: approved
      ? NOTIFICATION_TYPES.IT_WORK_ITEM_REVIEW_APPROVED
      : NOTIFICATION_TYPES.IT_WORK_ITEM_CHANGES_REQUESTED,
    title: approved ? "Work Item Approved" : "Changes Requested",
    message: approved
      ? `${workItemLabel(workItem)} was approved and completed.`
      : `Changes were requested for ${workItemLabel(workItem)}${
          reason ? `: "${truncate(reason)}"` : "."
        }`,
    metadata: metadataFor(workItem),
  });
}

// Blocked — management pool plus the named reviewer if one exists (§7),
// minus the actor. Every recipient here already has full visibility into
// the item (manage tier sees everything; the reviewer already has view
// rights), so including the reason in the message can't leak it to anyone
// unauthorized.
export async function notifyBlocked(
  actorId: string,
  workItem: WorkItemRef,
  reviewerId: string | null,
  reason: string
): Promise<void> {
  const recipientIds = new Set(await getManageTierRecipientIds(actorId));
  if (reviewerId && reviewerId !== actorId) recipientIds.add(reviewerId);

  const message = `${workItemLabel(workItem)} is blocked: "${truncate(reason)}"`;
  await Promise.all(
    Array.from(recipientIds).map((user) =>
      notifyUser({
        user,
        type: NOTIFICATION_TYPES.IT_WORK_ITEM_BLOCKED,
        title: "Work Item Blocked",
        message,
        metadata: metadataFor(workItem),
      })
    )
  );
}

// Unblocked — §7/§9: only meaningful when someone OTHER than the assignee
// resumed it (the assignee resuming their own item already knows). No
// management fan-out here — being blocked needed attention, being
// unblocked mainly needs to reach the one person who can now act on it.
export async function notifyUnblocked(
  actorId: string,
  workItem: WorkItemRef,
  assigneeId: string | null
): Promise<void> {
  if (!assigneeId || assigneeId === actorId) return;
  await notifyUser({
    user: assigneeId,
    type: NOTIFICATION_TYPES.IT_WORK_ITEM_UNBLOCKED,
    title: "Work Item Unblocked",
    message: `${workItemLabel(workItem)} is no longer blocked — you can resume work.`,
    metadata: metadataFor(workItem),
  });
}

// Comments — §8: assignee and reviewer only, excluding the comment's own
// author. Deliberately does NOT also blanket-notify the manage-tier pool
// on every comment (unlike submit-for-review/blocked, which are one-time
// signals) — the brief's own strongest, most repeated instruction across
// every section is to avoid notification spam, and CC'ing the IT Head on
// every comment thread they aren't otherwise party to would become exactly
// that. If the IT Head is the item's own reviewer, they're already
// covered by the reviewer branch.
export async function notifyCommented(
  actorId: string,
  workItem: WorkItemRef,
  assigneeId: string | null,
  reviewerId: string | null
): Promise<void> {
  const recipientIds = new Set<string>();
  if (assigneeId && assigneeId !== actorId) recipientIds.add(assigneeId);
  if (reviewerId && reviewerId !== actorId) recipientIds.add(reviewerId);

  const message = `New comment on ${workItemLabel(workItem)}.`;
  await Promise.all(
    Array.from(recipientIds).map((user) =>
      notifyUser({
        user,
        type: NOTIFICATION_TYPES.IT_WORK_ITEM_COMMENTED,
        title: "New Comment",
        message,
        metadata: metadataFor(workItem),
      })
    )
  );
}

// Proposals — a team member creating work for themselves, pending IT Head
// approval before it enters the normal tracked pipeline. Notifies the same
// manage-tier pool as submit-for-review's no-reviewer-set fallback, since a
// proposal has no reviewer yet by definition.
export async function notifyWorkItemProposed(
  actorId: string,
  workItem: WorkItemRef
): Promise<void> {
  const recipients = await getManageTierRecipientIds(actorId);
  await Promise.all(
    recipients.map((user) =>
      notifyUser({
        user,
        type: NOTIFICATION_TYPES.IT_WORK_ITEM_PROPOSED,
        title: "New Work Item Proposed",
        message: `${workItemLabel(workItem)} was proposed and is awaiting approval.`,
        metadata: metadataFor(workItem),
      })
    )
  );
}

export async function notifyProposalApproved(
  actorId: string,
  workItem: WorkItemRef,
  proposerId: string
): Promise<void> {
  if (proposerId === actorId) return;
  await notifyUser({
    user: proposerId,
    type: NOTIFICATION_TYPES.IT_WORK_ITEM_PROPOSAL_APPROVED,
    title: "Work Item Proposal Approved",
    message: `${workItemLabel(workItem)} was approved and is now tracked.`,
    metadata: metadataFor(workItem),
  });
}

export async function notifyProposalRejected(
  actorId: string,
  workItem: WorkItemRef,
  proposerId: string,
  reason: string
): Promise<void> {
  if (proposerId === actorId) return;
  await notifyUser({
    user: proposerId,
    type: NOTIFICATION_TYPES.IT_WORK_ITEM_PROPOSAL_REJECTED,
    title: "Work Item Proposal Rejected",
    message: `${workItemLabel(workItem)} was not approved: "${truncate(reason)}"`,
    metadata: metadataFor(workItem),
  });
}

// A middle ground between approve and reject — the proposal stays PENDING
// (not cancelled), the Head's note lands in the existing reviewNote field
// (same "live outstanding feedback" field the post-review workflow already
// uses), and the proposer can edit their own proposal in response (see
// updateProposal in it-work-item.service.ts) rather than having to cancel
// and repropose from scratch.
export async function notifyProposalChangesRequested(
  actorId: string,
  workItem: WorkItemRef,
  proposerId: string,
  note: string
): Promise<void> {
  if (proposerId === actorId) return;
  await notifyUser({
    user: proposerId,
    type: NOTIFICATION_TYPES.IT_WORK_ITEM_PROPOSAL_CHANGES_REQUESTED,
    title: "Changes Requested on Your Proposal",
    message: `${workItemLabel(workItem)}: "${truncate(note)}"`,
    metadata: metadataFor(workItem),
  });
}
