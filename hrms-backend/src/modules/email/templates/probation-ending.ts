import { ICompanyProfile } from "../../configuration/configuration.model";
import { escapeHtml, renderLayout, RenderedEmail } from "./base-layout";
import { button, codeBox } from "./helpers";

export interface ProbationEndingEmailData {
  employeeName: string;
  employeeIdLabel: string;
  probationEndDate: string;
  profileUrl: string;
}

export function probationEndingEmail(
  data: ProbationEndingEmailData,
  companyProfile: ICompanyProfile
): RenderedEmail {
  const body = `
    <p style="font-size:16px;font-weight:600;margin:0 0 12px;">Probation period ended</p>
    <p style="margin:0 0 12px;">${escapeHtml(data.employeeName)} (${escapeHtml(data.employeeIdLabel)})'s probation period ended on ${escapeHtml(data.probationEndDate)}.</p>
    ${codeBox("Probation End Date", data.probationEndDate)}
    <p style="margin:16px 0 0;">Mark them Permanent, or extend their probation period, from their employee profile.</p>
    ${button("Review Employee", data.profileUrl)}
  `;
  return {
    subject: `Probation ended: ${data.employeeName}`,
    html: renderLayout(body, companyProfile),
  };
}
