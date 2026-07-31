import { logger } from "../../shared/utils/logger";
import { getOrCreateConfiguration } from "../configuration/configuration.service";
import { resolveSender } from "./email.transport";
import { welcomeEmail, WelcomeEmailData } from "./templates/welcome";
import { passwordResetEmail, PasswordResetEmailData } from "./templates/password-reset";
import { passwordChangedEmail, PasswordChangedEmailData } from "./templates/password-changed";
import { testEmail, TestEmailData } from "./templates/test-email";
import { leaveAppliedEmail, LeaveAppliedEmailData } from "./templates/leave-applied";
import { leaveApprovedEmail, LeaveApprovedEmailData } from "./templates/leave-approved";
import { leaveRejectedEmail, LeaveRejectedEmailData } from "./templates/leave-rejected";
import { probationEndingEmail, ProbationEndingEmailData } from "./templates/probation-ending";
import { credentialsResendEmail, CredentialsResendEmailData } from "./templates/credentials-resend";
import { SendEmailCommand } from "@aws-sdk/client-ses";
import { EMAIL_PROVIDER } from "../configuration/configuration.model";

// One entry per template — add a new file under templates/ and a new key
// here to add a template. Business services never call nodemailer/SES
// directly; they go through notifications.service.ts's notifyUser(...,
// { email: { template, data } }), which calls sendTemplateEmail below.
const TEMPLATES = {
  welcome: welcomeEmail,
  "password-reset": passwordResetEmail,
  "password-changed": passwordChangedEmail,
  "test-email": testEmail,
  "leave-applied": leaveAppliedEmail,
  "leave-approved": leaveApprovedEmail,
  "leave-rejected": leaveRejectedEmail,
  "probation-ending": probationEndingEmail,
  "credentials-resend": credentialsResendEmail,
} as const;

export type EmailTemplateName = keyof typeof TEMPLATES;

type TemplateDataMap = {
  welcome: WelcomeEmailData;
  "password-reset": PasswordResetEmailData;
  "password-changed": PasswordChangedEmailData;
  "test-email": TestEmailData;
  "leave-applied": LeaveAppliedEmailData;
  "leave-approved": LeaveApprovedEmailData;
  "leave-rejected": LeaveRejectedEmailData;
  "probation-ending": ProbationEndingEmailData;
  "credentials-resend": CredentialsResendEmailData;
};

interface SendResult {
  success: boolean;
  error?: string;
}

// Best-effort by default (never throws) to match notifyUser's resilience
// contract — a broken SMTP/SES config must not fail the business operation
// it's attached to. sendTestEmail (below) opts back into surfacing the
// error, since a test send exists specifically to report failures.
async function send<T extends EmailTemplateName>(
  to: string,
  template: T,
  data: TemplateDataMap[T]
): Promise<SendResult> {
  try {
    const config = await getOrCreateConfiguration();
const { provider, transport, sesClient, from } = resolveSender(config);
    const render = TEMPLATES[template];
    const { subject, html } = render(data as never, config.companyProfile);
if (provider === EMAIL_PROVIDER.SMTP) {
  await transport!.sendMail({
    from,
    to,
    subject,
    html,
  });
} else {
  await sesClient!.send(
    new SendEmailCommand({
      Source: from,
      Destination: {
        ToAddresses: [to],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: "UTF-8",
        },
        Body: {
          Html: {
            Data: html,
            Charset: "UTF-8",
          },
        },
      },
    })
  );
}
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error sending email";
    logger.error({ err, to, template }, "Failed to send email");
    return { success: false, error: message };
  }
}

export async function sendTemplateEmail<T extends EmailTemplateName>(
  to: string,
  template: T,
  data: TemplateDataMap[T]
): Promise<void> {
  await send(to, template, data);
}

/** Used by the "Send Test Email" admin action — surfaces failures instead of swallowing them. */
export async function sendTestEmail(to: string, requestedBy: string): Promise<SendResult> {
  return send(to, "test-email", { requestedBy });
}
