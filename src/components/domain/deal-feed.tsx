"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ListingView } from "@/lib/view-types";
import type { SortKey } from "@/lib/core/types";
import { DealTable } from "./deal-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const SORTERS: Record<SortKey, (a: ListingView, b: ListingView) => number> = {
  newest: (a, b) => (b.postedAt ?? b.firstSeenAt) - (a.postedAt ?? a.firstSeenAt),
  score: (a, b) => b.dealScore - a.dealScore,
  profit: (a, b) => (b.netProfitDkk ?? -1e9) - (a.netProfitDkk ?? -1e9),
  discount: (a, b) => (b.discountPct ?? -1e9) - (a.discountPct ?? -1e9),
  price_asc: (a, b) => a.priceDkk - b.priceDkk,
  roi: (a, b) => (b.roiPct ?? -1e9) - (a.roiPct ?? -1e9),
};

export function DealFeed({
  rows,
  initialSort = "score",
  showSort = true,
  emptyTitle = "Ingen deals matcher",
  emptyDescription,
  emptyHref,
  emptyAction,
}: {
  rows: ListingView[];
  initialSort?: SortKey;
  showSort?: boolean;
  emptyTitle?: string;
  emptyDescription?: React.ReactNode;
  emptyHref?: string;
  emptyAction?: string;
}) {
  const [sort, setSort] = React.useState<SortKey>(initialSort);
  const [local, setLocal] = React.useState<ListingView[]>(rows);
  const [rowsRef, setRowsRef] = React.useState(rows);
  const [busy, setBusy] = React.useState<string | null>(null);
  const router = useRouter();

  // Reset optimistic local state when a revalidation hands us a new `rows`
  // identity. Doing this during render avoids a state-sync effect.
  if (rows !== rowsRef) {
    setRowsRef(rows);
    setLocal(rows);
  }

  const sorted = React.useMemo(
    () => [...local].sort(SORTERS[sort] ?? SORTERS.score),
    [local, sort]
  );

  async function onAction(id: string, action: string) {
    setBusy(id);
    setLocal((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        switch (action) {
          case "watch":
            return { ...r, watchlisted: true };
          case "unwatch":
            return { ...r, watchlisted: false };
          case "ignore":
            return { ...r, ignored: true };
          case "contact":
            return { ...r, contactedAt: Date.now() };
          case "purchase":
            return { ...r, purchasedAt: Date.now(), status: "purchased" };
          default:
            return r;
        }
      })
    );
    try {
      await fetch("/api/listings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={
          emptyHref && emptyAction ? (
            <Link href={emptyHref}>
              <Button size="sm" variant="outline">
                {emptyAction}
              </Button>
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className={busy ? "opacity-70 transition-opacity" : undefined}>
      <DealTable rows={sorted} sort={sort} onSort={setSort} onAction={onAction} showSort={showSort} />
    </div>
  );
}
