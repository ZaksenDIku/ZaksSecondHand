import type { ReactNode } from "react";
import { OriginBadge } from "./badges";

export function PageHeader({
  title,
  subtitle,
  actions,
  originNote,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  originNote?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-muted">{subtitle}</p>}
        {originNote && <div className="mt-2">{originNote}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function OriginLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
      <span className="text-muted">Datakilder:</span>
      <OriginBadge origin="REAL" />
      <OriginBadge origin="IMPORTED" />
      <OriginBadge origin="DEMO" />
      <OriginBadge origin="STALE" />
      <span>– kun DEMO er syntetisk; REAL kræver en godkendt datakilde eller din egen import.</span>
    </div>
  );
}
