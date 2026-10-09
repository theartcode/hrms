export interface DistributionSlice {
  name: string;
  value: number;
  color: string;
}

// Part-to-whole as a horizontal bar list rather than a pie/donut: every
// value is readable directly (no hover required), bars make close values
// easy to compare, and each row is already identity-labeled so color never
// has to carry meaning alone.
export function DistributionBarChart({ data }: { data: DistributionSlice[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const max = Math.max(...data.map((d) => d.value), 1);
  const sorted = [...data].sort((a, b) => b.value - a.value);

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col justify-center gap-4">
      {sorted.map((d) => {
        const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
        const widthPct = (d.value / max) * 100;
        return (
          <div key={d.name} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">{d.name}</span>
              <span className="text-muted-foreground tabular-nums">
                {d.value} · {pct}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{ width: `${widthPct}%`, backgroundColor: d.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
