import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:pointer-events-none disabled:opacity-40 select-none",
  {
    variants: {
      variant: {
        default: "bg-panel-3 text-ink border border-line hover:bg-line hover:border-line-2",
        primary: "bg-accent text-black hover:bg-accent-2 border border-transparent font-semibold",
        ghost: "text-muted hover:text-ink hover:bg-panel-3 border border-transparent",
        outline: "border border-line-2 text-ink hover:bg-panel-3",
        danger: "bg-steal/15 text-steal border border-steal/40 hover:bg-steal/25",
        success: "bg-good/15 text-good border border-good/40 hover:bg-good/25",
      },
      size: {
        sm: "h-7 px-2.5 text-[12px]",
        md: "h-9 px-3.5 text-[13px]",
        lg: "h-11 px-5 text-sm",
        icon: "h-8 w-8 text-[13px]",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);
Button.displayName = "Button";
