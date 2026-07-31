import { ICompanyProfile } from "../../configuration/configuration.model";
import { escapeHtml, renderLayout, RenderedEmail } from "./base-layout";
import { button, codeBox } from "./helpers";

// Same data shape as welcome.ts's WelcomeEmailData, deliberately kept as a
// separate template rather than reused verbatim — "Welcome, you're new
// here!" reads oddly for an existing employee who's just having their
// credentials resent/reset by an admin.
export interface CredentialsResendEmailData {
  fullName: string;
  employeeId: string;
  email: string;
  tempPassword: string;
  loginUrl: string;
}

export function credentialsResendEmail(
  data: CredentialsResendEmailData,
  companyProfile: ICompanyProfile
): RenderedEmail {
  const body = `
    <p style="font-size:16px;font-weight:600;margin:0 0 12px;">Your login credentials</p>
    <p style="margin:0 0 12px;">An administrator reset your password on ${escapeHtml(companyProfile.name)}'s HRMS. Here are your updated sign-in details:</p>
    ${codeBox("Employee ID", data.employeeId)}
    ${codeBox("Email", data.email)}
    ${codeBox("Temporary password", data.tempPassword)}
    <p style="margin:16px 0 0;">You'll be asked to set a new password the first time you sign in.</p>
    ${button("Sign in", data.loginUrl)}
  `;
  return {
    subject: `Your ${companyProfile.name} HRMS login credentials`,
    html: renderLayout(body, companyProfile),
  };
}
