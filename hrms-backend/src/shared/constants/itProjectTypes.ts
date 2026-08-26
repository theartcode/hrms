export const IT_PROJECT_STATUS = {
  PLANNED: "PLANNED",
  ACTIVE: "ACTIVE",
  ON_HOLD: "ON_HOLD",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;

export type ITProjectStatus = (typeof IT_PROJECT_STATUS)[keyof typeof IT_PROJECT_STATUS];

export const IT_PROJECT_PRIORITY = {
  URGENT: "URGENT",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
} as const;

export type ITProjectPriority = (typeof IT_PROJECT_PRIORITY)[keyof typeof IT_PROJECT_PRIORITY];
