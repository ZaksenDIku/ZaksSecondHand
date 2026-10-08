import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";

export function KpiCard({
  label,
  value,
  sub,
  icon,
  tone = "default",
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "steal" | "good" | "great";
  accent?: string;
}) {
  const toneClass =
    tone === "steal"
      ? "text-steal"
      : tone === "good"
        ? "text-good"
        : tone === "great"
          ? "text-great"
          : "text-ink";

  return (
    <Card className="relative overflow-hidden p-4">
      {accent && (
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
        />
      )}
      <div className="flex items-start justify-between gap-2">
        <span className="eyebrow">{label}</span>
        {icon && <span className="text-dim">{icon}</span>}
      </div>
      <div className={cn("mono mt-2 text-[26px] font-semibold leading-none tracking-tight", toneClass)}>
        {value}
      </div>
      {sub && <div className="mt-2 text-[11.5px] leading-snug text-muted">{sub}</div>}
    </Card>
  );
}
