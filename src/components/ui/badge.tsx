import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] leading-none whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-line-2 bg-panel-3 text-muted",
        good: "border-good/35 bg-good/10 text-good",
        great: "border-great/40 bg-great/10 text-great",
        steal: "border-steal/45 bg-steal/12 text-steal",
        fair: "border-fair/35 bg-fair/10 text-fair",
        warn: "border-warn/40 bg-warn/10 text-warn",
        danger: "border-danger/45 bg-danger/12 text-danger",
        demo: "border-demo/45 bg-demo/12 text-demo",
        info: "border-info/35 bg-info/10 text-info",
        muted: "border-line bg-panel-2 text-dim",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
