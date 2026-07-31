import { ApiError } from "../../shared/errors/ApiError";
import { ROLES } from "../../shared/constants/roles";
import { NOTIFICATION_TYPES, NotificationType } from "../../shared/constants/notificationTypes";
import { toId } from "../../shared/utils/toId";
import { logger } from "../../shared/utils/logger";
import { getNotificationSettings } from "../configuration/configuration.cache";
import { INotificationEventToggles } from "../configuration/configuration.model";
import { sendTemplateEmail, EmailTemplateName } from "../email/email.service";
import { UserModel } from "../user/user.model";
import { NotificationModel } from "./notification.model";

interface EmailPayload {
  template: EmailTemplateName;
  data: Record<string, unknown>;
}

interface CreateNotificationInput {
  user: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  // When set, also dispatches this template through the Email Service —
  // gated by Configuration's per-event toggle (below), except for the
  // password templates, which are security notices sent unconditionally.
  email?: EmailPayload;
}

// Maps a notification type to the admin-configurable toggle that gates its
// email. Types absent from this map (PASSWORD_RESET, PASSWORD_CHANGED,
// EMPLOYEE_UPDATED, DOCUMENT_UPLOADED, REVIEW_PUBLISHED, SYSTEM) have no
// email template today, except the two password ones — those are
// security-critical and always send regardless of notification settings.
const EVENT_TOGGLE_BY_TYPE: Partial<Record<NotificationType, keyof INotificationEventToggles>> = {
  [NOTIFICATION_TYPES.LEAVE_APPLIED]: "LEAVE_APPLIED",
  [NOTIFICATION_TYPES.LEAVE_APPROVED]: "LEAVE_APPROVED",
  [NOTIFICATION_TYPES.LEAVE_REJECTED]: "LEAVE_REJECTED",
  [NOTIFICATION_TYPES.ATTENDANCE_CORRECTION_REQUESTED]: "ATTENDANCE_CORRECTION",
  [NOTIFICATION_TYPES.ATTENDANCE_CORRECTION_APPROVED]: "ATTENDANCE_CORRECTION",
  [NOTIFICATION_TYPES.ATTENDANCE_CORRECTION_REJECTED]: "ATTENDANCE_CORRECTION",
  [NOTIFICATION_TYPES.HOLIDAY_ADDED]: "HOLIDAY_ADDED",
  [NOTIFICATION_TYPES.ANNOUNCEMENT_PUBLISHED]: "ANNOUNCEMENT_PUBLISHED",
  [NOTIFICATION_TYPES.EMPLOYEE_CREATED]: "EMPLOYEE_CREATED",
  [NOTIFICATION_TYPES.BIRTHDAY]: "BIRTHDAY",
  [NOTIFICATION_TYPES.WORK_ANNIVERSARY]: "WORK_ANNIVERSARY",
  [NOTIFICATION_TYPES.PROBATION_ENDING]: "PROBATION_ENDING",
};

const ALWAYS_SEND_TYPES: NotificationType[] = [
  NOTIFICATION_TYPES.PASSWORD_RESET,
  NOTIFICATION_TYPES.PASSWORD_CHANGED,
];

function isEmailAllowed(type: NotificationType): boolean {
  if (ALWAYS_SEND_TYPES.includes(type)) return true;
  const toggleKey = EVENT_TOGGLE_BY_TYPE[type];
  if (!toggleKey) return false;
  const settings = getNotificationSettings();
  return settings.emailEnabled && settings.events[toggleKey];
}

function toPublicNotification(n: {
  _id: unknown;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}) {
  return {
    id: toId(n as never),
    type: n.type,
    title: n.title,
    message: n.message,
    read: n.read,
    metadata: n.metadata,
    createdAt: n.createdAt,
  };
}

// sendTemplateEmail never throws (it swallows and logs its own failures,
// same contract as this module's notification writes), so callers here
// don't need their own try/catch around it.
async function dispatchEmail(to: string | null | undefined, email: EmailPayload): Promise<void> {
  if (!to) return;
  await sendTemplateEmail(to, email.template, email.data as never);
}

// Best-effort, like recordActivity — a notification failing to write must
// never block or fail the primary business operation it's attached to.
export async function notifyUser(input: CreateNotificationInput): Promise<void> {
  try {
    await NotificationModel.create({
      user: input.user,
      type: input.type,
      title: input.title,
      message: input.message,
      metadata: input.metadata ?? null,
    });
  } catch (err) {
    logger.error({ err, input }, "Failed to create notification");
  }

  if (input.email && isEmailAllowed(input.type)) {
    try {
      const user = await UserModel.findById(input.user).select("email");
      await dispatchEmail(user?.email, input.email);
    } catch (err) {
      logger.error({ err, input }, "Failed to dispatch notification email");
    }
  }
}

async function notifyUsers(
  users: { id: string; email: string }[],
  payload: Omit<CreateNotificationInput, "user">
): Promise<void> {
  if (users.length === 0) return;
  try {
    await NotificationModel.insertMany(
      users.map((u) => ({
        user: u.id,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        metadata: payload.metadata ?? null,
      }))
    );
  } catch (err) {
    logger.error({ err, payload }, "Failed to bulk-create notifications");
  }

  if (payload.email && isEmailAllowed(payload.type)) {
    const email = payload.email;
    await Promise.all(users.map((u) => dispatchEmail(u.email, email)));
  }
}

// "Notify Admins" rule: every ADMIN/SUPER_ADMIN except the actor who
// triggered the event (you don't need to be told about your own action).
export async function notifyAdmins(
  excludeUserId: string,
  payload: Omit<CreateNotificationInput, "user">
): Promise<void> {
  const admins = await UserModel.find({
    role: { $in: [ROLES.ADMIN, ROLES.SUPER_ADMIN] },
    _id: { $ne: excludeUserId },
  }).select("_id email");
  await notifyUsers(
    admins.map((a) => ({ id: toId(a), email: a.email })),
    payload
  );
}

// "Notify Everyone" rule: every user except the actor.
export async function notifyEveryone(
  excludeUserId: string,
  payload: Omit<CreateNotificationInput, "user">
): Promise<void> {
  const users = await UserModel.find({ _id: { $ne: excludeUserId } }).select("_id email");
  await notifyUsers(
    users.map((u) => ({ id: toId(u), email: u.email })),
    payload
  );
}

interface ListQuery {
  page: number;
  limit: number;
  unreadOnly?: boolean;
}

export async function listNotifications(userId: string, query: ListQuery) {
  const filter: Record<string, unknown> = { user: userId };
  if (query.unreadOnly) filter.read = false;

  const skip = (query.page - 1) * query.limit;
  const [items, total, unreadCount] = await Promise.all([
    NotificationModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
    NotificationModel.countDocuments(filter),
    NotificationModel.countDocuments({ user: userId, read: false }),
  ]);

  return {
    notifications: items.map(toPublicNotification),
    unreadCount,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export async function getUnreadCount(userId: string): Promise<number> {
  return NotificationModel.countDocuments({ user: userId, read: false });
}

export async function markRead(userId: string, notificationId: string) {
  const notification = await NotificationModel.findById(notificationId);
  if (!notification) throw new ApiError(404, "Notification not found");
  if (String(notification.user) !== userId) {
    throw new ApiError(403, "You can only mark your own notifications as read");
  }

  if (!notification.read) {
    notification.read = true;
    await notification.save();
  }

  return toPublicNotification(notification);
}

export async function markAllRead(userId: string): Promise<{ modifiedCount: number }> {
  const result = await NotificationModel.updateMany(
    { user: userId, read: false },
    { $set: { read: true } }
  );
  return { modifiedCount: result.modifiedCount };
}
