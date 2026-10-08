import * as React from "react";
import { cn } from "@/lib/cn";

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line px-6 py-14 text-center",
        className
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-panel-2 text-dim">
        {icon ?? <span className="text-lg">◎</span>}
      </div>
      <div>
        <h3 className="text-[14px] font-semibold text-ink">{title}</h3>
        {description && (
          <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-relaxed text-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
