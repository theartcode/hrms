import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accentClassName?: string;
  hint?: string;
  onClick?: () => void;
}

export function StatCard({ label, value, icon: Icon, accentClassName, hint, onClick }: StatCardProps) {
  return (
    <Card
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        "group gap-0 border-border/60 py-0 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md",
        onClick && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      )}
    >
      <CardContent className="flex items-center gap-4 p-4">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105",
            accentClassName
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="text-2xl font-bold tracking-tight tabular-nums">{value}</span>
          <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
