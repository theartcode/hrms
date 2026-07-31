import { ApiError } from "../../shared/errors/ApiError";
import { env } from "../../shared/config/env";
import { ROLES } from "../../shared/constants/roles";
import { LOGIN_ALLOWED_STATUSES } from "../../shared/constants/employeeStatus";
import { NOTIFICATION_TYPES } from "../../shared/constants/notificationTypes";
import { toId } from "../../shared/utils/toId";
import {
  compareSecret,
  generateResetToken,
  generateTempPassword,
  hashResetToken,
  hashSecret,
  validatePasswordAgainstPolicy,
} from "../../shared/utils/password";
import {
  JwtPayload,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../shared/utils/token";
import { getSecuritySettings } from "../configuration/configuration.cache";
import { getDepartmentsHeadedBy } from "../department/department.cache";
import { notifyUser } from "../notifications/notifications.service";
import { IUser, UserModel } from "../user/user.model";
import { AuthTokens, PublicUser } from "./auth.types";

// Reads department-head info from an in-memory cache (never a DB query
// here) — see department.cache.ts. Deliberately kept synchronous: every
// call site below (login, refresh, setPassword, getMe) already has the
// IUser in hand, so there's no reason for this to be async.
function toPublicUser(user: IUser): PublicUser {
  return {
    id: user._id.toString(),
    employeeId: user.employeeId,
    email: user.email,
    fullName: user.fullName,
    profilePhoto: user.profilePhoto ?? null,
    role: user.role,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    departmentHeadOf: getDepartmentsHeadedBy(user._id.toString()),
  };
}

async function issueTokens(user: IUser): Promise<AuthTokens> {
  const payload: JwtPayload = {
    sub: user._id.toString(),
    role: user.role,
    employeeId: user.employeeId,
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  user.refreshTokenHash = await hashSecret(refreshToken);
  await user.save();

  return { accessToken, refreshToken };
}

export async function login(
  email: string,
  password: string
): Promise<{ tokens: AuthTokens; user: PublicUser }> {
  const user = await UserModel.findOne({ email }).select(
    "+passwordHash +failedLoginAttempts +lockedUntil"
  );

  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    throw new ApiError(
      423,
      `Account locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`
    );
  }

  if (!LOGIN_ALLOWED_STATUSES.includes(user.status)) {
    throw new ApiError(403, "This account is not active");
  }

  const isValidPassword = await compareSecret(password, user.passwordHash);
  if (!isValidPassword) {
    const { maxLoginAttempts, lockoutDurationMinutes } = getSecuritySettings();
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= maxLoginAttempts) {
      user.lockedUntil = new Date(Date.now() + lockoutDurationMinutes * 60 * 1000);
      user.failedLoginAttempts = 0;
    }
    await user.save();
    throw new ApiError(401, "Invalid email or password");
  }

  user.failedLoginAttempts = 0;
  user.lockedUntil = null;

  const tokens = await issueTokens(user);
  return { tokens, user: toPublicUser(user) };
}

export async function refresh(
  rawRefreshToken: string
): Promise<{ tokens: AuthTokens; user: PublicUser }> {
  let payload: JwtPayload;
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  const user = await UserModel.findById(payload.sub).select(
    "+refreshTokenHash"
  );

  if (!user || !user.refreshTokenHash) {
    throw new ApiError(401, "Session expired, please log in again");
  }

  const isValidToken = await compareSecret(
    rawRefreshToken,
    user.refreshTokenHash
  );
  if (!isValidToken) {
    // Possible token reuse after rotation - revoke the session entirely.
    user.refreshTokenHash = null;
    await user.save();
    throw new ApiError(401, "Session expired, please log in again");
  }

  if (!LOGIN_ALLOWED_STATUSES.includes(user.status)) {
    throw new ApiError(403, "This account is not active");
  }

  const tokens = await issueTokens(user);
  return { tokens, user: toPublicUser(user) };
}

export async function logout(userId: string): Promise<void> {
  await UserModel.findByIdAndUpdate(userId, { refreshTokenHash: null });
}

export async function setPassword(
  userId: string,
  newPassword: string
): Promise<{ tokens: AuthTokens; user: PublicUser }> {
  validatePasswordAgainstPolicy(newPassword);

  const user = await UserModel.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  user.passwordHash = await hashSecret(newPassword);
  user.mustChangePassword = false;

  const tokens = await issueTokens(user);
  return { tokens, user: toPublicUser(user) };
}

export async function adminResetPassword(
  actor: { id: string; role: string },
  targetUserId: string
): Promise<{ tempPassword: string; user: PublicUser }> {
  const target = await UserModel.findById(targetUserId);
  if (!target) {
    throw new ApiError(404, "User not found");
  }

  if (target.role === ROLES.SUPER_ADMIN) {
    throw new ApiError(
      403,
      "Super Admin passwords cannot be reset through this endpoint"
    );
  }

  if (target.role === ROLES.ADMIN && actor.role !== ROLES.SUPER_ADMIN) {
    throw new ApiError(403, "Only Super Admin can reset an Admin's password");
  }

  const tempPassword = generateTempPassword();
  target.passwordHash = await hashSecret(tempPassword);
  target.mustChangePassword = true;
  target.refreshTokenHash = null;
  await target.save();

  // Same "always send" type forgotPassword uses below — this is a
  // credential-delivery email, not a preference-gated notification, so it
  // shouldn't be silently skipped just because an admin turned off the
  // EMPLOYEE_CREATED/etc. toggles.
  await notifyUser({
    user: toId(target),
    type: NOTIFICATION_TYPES.PASSWORD_RESET,
    title: "Your password was reset",
    message: "An administrator reset your HRMS password — check your email for new sign-in details.",
    email: {
      template: "credentials-resend",
      data: {
        fullName: target.fullName,
        employeeId: target.employeeId,
        email: target.email,
        tempPassword,
        loginUrl: `${env.clientOrigin}/login`,
      },
    },
  });

  return { tempPassword, user: toPublicUser(target) };
}

const RESET_TOKEN_TTL_MINUTES = 30;

// Self-service "forgot password": emails a one-time link (never a temp
// password to retype — that path is error-prone and reads as "broken" to
// users, since it needs a manual sign-in step before the app even lets
// them choose a new password). Always resolves silently — whether or not
// the email matches an account — so this can't be used to enumerate
// registered emails.
export async function forgotPassword(email: string): Promise<void> {
  const user = await UserModel.findOne({ email });
  if (!user || !LOGIN_ALLOWED_STATUSES.includes(user.status)) {
    return;
  }

  const token = generateResetToken();
  user.passwordResetTokenHash = hashResetToken(token);
  user.passwordResetExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
  await user.save();

  await notifyUser({
    user: toId(user),
    type: NOTIFICATION_TYPES.PASSWORD_RESET,
    title: "Password reset requested",
    message: "A password reset link was requested for your account",
    email: {
      template: "password-reset",
      data: {
        fullName: user.fullName,
        resetUrl: `${env.clientOrigin}/reset-password?token=${token}`,
        expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
      },
    },
  });
}

// Consumes the link token from forgotPassword above: verified by exact
// hash match plus expiry, single-use (both cleared as soon as they're
// consumed, whether that's here or by a fresh forgotPassword call
// superseding the old one), and — like adminResetPassword — invalidates
// any existing session so a stale device gets signed out.
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  validatePasswordAgainstPolicy(newPassword);

  const user = await UserModel.findOne({
    passwordResetTokenHash: hashResetToken(token),
    passwordResetExpiresAt: { $gt: new Date() },
  });
  if (!user) {
    throw new ApiError(400, "This reset link is invalid or has expired");
  }

  user.passwordHash = await hashSecret(newPassword);
  user.mustChangePassword = false;
  user.refreshTokenHash = null;
  user.passwordResetTokenHash = null;
  user.passwordResetExpiresAt = null;
  await user.save();
}

export async function getMe(userId: string): Promise<PublicUser> {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  return toPublicUser(user);
}
