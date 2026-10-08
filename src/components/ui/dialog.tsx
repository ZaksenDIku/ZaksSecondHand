"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { X } from "lucide-react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}

export function Dialog({ open, onClose, title, description, children, wide }: DialogProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          "animate-in relative z-10 w-full rounded-xl border border-line-2 bg-panel shadow-2xl shadow-black/60",
          wide ? "max-w-3xl" : "max-w-lg"
        )}
        role="dialog"
        aria-modal="true"
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
              {description && <p className="mt-1 text-[12.5px] text-muted">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="rounded p-1 text-dim transition-colors hover:bg-panel-3 hover:text-ink"
              aria-label="Luk"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
