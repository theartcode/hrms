export const STATUTORY_STATUS = {
  ENABLED: "ENABLED",
  DISABLED: "DISABLED",
} as const;

export type StatutoryStatus = (typeof STATUTORY_STATUS)[keyof typeof STATUTORY_STATUS];
