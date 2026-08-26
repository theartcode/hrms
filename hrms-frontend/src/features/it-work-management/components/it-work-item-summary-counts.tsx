import { ItWorkItemStatusSummary } from "../it-work-item-meta";

const TILES: { key: keyof Omit<ItWorkItemStatusSummary, "total">; label: string; tone: string }[] = [
  { key: "active", label: "Active", tone: "text-blue-600 dark:text-blue-400" },
  { key: "inReview", label: "In Review", tone: "text-amber-600 dark:text-amber-400" },
  { key: "blocked", label: "Blocked", tone: "text-red-600 dark:text-red-400" },
  { key: "completed", label: "Completed", tone: "text-emerald-600 dark:text-emerald-400" },
  { key: "cancelled", label: "Cancelled", tone: "text-muted-foreground" },
];

// Simple counts only — no percentage, no velocity, no forecast. Per
// Parts E/F of the Phase 1C-C brief, deliberately.
export function ItWorkItemSummaryCounts({ summary }: { summary: ItWorkItemStatusSummary }) {
  if (summary.total === 0) {
    return <p className="text-sm text-muted-foreground">No work items yet.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {TILES.map(({ key, label, tone }) => (
        <div key={key} className="rounded-lg border p-3 text-center">
          <p className={`text-xl font-semibold ${tone}`}>{summary[key]}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}
