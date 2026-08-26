// Part 7/10 — the full status breakdown, every status shown even at zero
// (never hidden), using the real enum values already established elsewhere
// in this module. Compact chips rather than a chart or table, matching
// Part 34's "avoid huge tables, keep it scannable" direction.
export function ItExecutiveStatusChips<T extends string>({
  counts,
  labels,
  order,
}: {
  counts: Record<T, number>;
  labels: Record<T, string>;
  order: T[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {order.map((key) => (
        <div
          key={key}
          className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs"
        >
          <span className="text-muted-foreground">{labels[key]}</span>
          <span className="font-semibold tabular-nums">{counts[key] ?? 0}</span>
        </div>
      ))}
    </div>
  );
}
