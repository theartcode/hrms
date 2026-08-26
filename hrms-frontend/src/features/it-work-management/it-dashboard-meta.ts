// Phase 1E-A. Same simple-polling approach as the rest of the app (Task's
// own TASK_POLL_INTERVAL_MS is 20s; notifications poll at 30s) — a fresh
// constant here rather than importing across the Task/notifications
// boundary, since this module never imports from features/tasks.
export const IT_DASHBOARD_POLL_INTERVAL_MS = 30_000;
