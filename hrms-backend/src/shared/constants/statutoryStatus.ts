// Shared by pfStatus, professionalTaxStatus, lwfStatus and esicStatus on
// IStatutoryInfo — all four are the same "is this compliance item switched
// on for this employee" toggle, just for different statutory schemes.
export const STATUTORY_STATUS = {
  ENABLED: "ENABLED",
  DISABLED: "DISABLED",
} as const;

export type StatutoryStatus = (typeof STATUTORY_STATUS)[keyof typeof STATUTORY_STATUS];
