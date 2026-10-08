"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ListingView } from "@/lib/view-types";
import type { SortKey } from "@/lib/core/types";
import { cn } from "@/lib/cn";
import { formatAge, formatDkk, formatPct } from "@/lib/core/format";
import {
  ConfidenceBadge,
  JustListedBadge,
  OriginBadge,
  ProviderBadge,
  RiskBadge,
  VelocityBadge,
  TierBadge,
} from "./badges";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EyeOff, ExternalLink, PhoneCall, ShoppingBag, Star } from "lucide-react";

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "newest", label: "Nyeste" },
  { key: "score", label: "Deal Score" },
  { key: "profit", label: "Potentielle profit" },
  { key: "discount", label: "Rabat %" },
  { key: "price_asc", label: "Laveste pris" },
  { key: "roi", label: "Højeste ROI" },
];

function scoreColor(score: number): string {
  if (score >= 85) return "bg-steal";
  if (score >= 70) return "bg-great";
  if (score >= 50) return "bg-good";
  return "bg-fair";
}

function ProductThumb({ row }: { row: ListingView }) {
  return (
    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md border border-line bg-panel-2">
      {row.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.imageUrl}
          alt={row.model || row.rawTitle}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[15px] text-dim">
          {row.productType === "macbook" ? "💻" : row.productType === "iphone" ? "📱" : "?"}
        </div>
      )}
    </div>
  );
}

function RowActions({
  row,
  onAction,
}: {
  row: ListingView;
  onAction: (id: string, action: string) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      {row.url && (
        <a
          href={row.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          title="Åbn annonce"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-7 w-7 items-center justify-center rounded border border-line text-muted transition-colors hover:border-line-2 hover:text-ink"
        >
          <ExternalLink size={13} />
        </a>
      )}
      <Button
        size="icon"
        variant="ghost"
        title={row.watchlisted ? "Fjern fra watchlist" : "Watch"}
        onClick={(e) => {
          e.stopPropagation();
          onAction(row.id, row.watchlisted ? "unwatch" : "watch");
        }}
        className={row.watchlisted ? "text-accent" : ""}
      >
        <Star size={13} fill={row.watchlisted ? "currentColor" : "none"} />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        title="Ignorér"
        onClick={(e) => {
          e.stopPropagation();
          onAction(row.id, "ignore");
        }}
      >
        <EyeOff size={13} />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        title="Marker kontaktet"
        onClick={(e) => {
          e.stopPropagation();
          onAction(row.id, "contact");
        }}
        className={row.contactedAt ? "text-good" : ""}
      >
        <PhoneCall size={13} />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        title="Marker købt"
        onClick={(e) => {
          e.stopPropagation();
          onAction(row.id, "purchase");
        }}
        className={row.purchasedAt ? "text-good" : ""}
      >
        <ShoppingBag size={13} />
      </Button>
    </div>
  );
}

export interface DealTableProps {
  rows: ListingView[];
  sort: SortKey;
  onSort: (s: SortKey) => void;
  onAction: (id: string, action: string) => void;
  showSort?: boolean;
}

export function DealTable({ rows, sort, onSort, onAction, showSort = true }: DealTableProps) {
  const router = useRouter();

  const open = (id: string) => router.push(`/listings/${id}`);

  return (
    <div>
      {showSort && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-4 py-2.5">
          <span className="eyebrow mr-1">Sortér</span>
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.key}
              onClick={() => onSort(o.key)}
              className={cn(
                "rounded border px-2 py-1 text-[11px] font-medium transition-colors",
                sort === o.key
                  ? "border-accent/50 bg-accent/10 text-accent"
                  : "border-line text-muted hover:border-line-2 hover:text-ink"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      {/* Desktop */}
      <div className="hidden overflow-x-auto lg:block">
        <Table>
          <THead>
            <tr>
              <TH className="w-[52px]" />
              <TH>Markedsplads</TH>
              <TH>Produkt</TH>
              <TH className="text-right">Pris</TH>
              <TH className="text-right">Marked</TH>
              <TH className="text-right">Salgspris</TH>
              <TH className="text-right">Profit</TH>
              <TH className="text-right">Rabat</TH>
              <TH className="w-[110px]">Score</TH>
              <TH>Alder</TH>
              <TH>Hastighed</TH>
              <TH>Risiko</TH>
              <TH className="text-right">Handlinger</TH>
            </tr>
          </THead>
          <tbody>
            {rows.map((row) => (
              <TR
                key={row.id}
                onClick={() => open(row.id)}
                className={cn(
                  "cursor-pointer hover:bg-panel-2",
                  row.dealTier === "STEAL" && "bg-steal/[0.05]",
                  row.duplicateOf && "opacity-60"
                )}
              >
                <TD>
                  <ProductThumb row={row} />
                </TD>
                <TD>
                  <div className="flex flex-col gap-1">
                    <ProviderBadge provider={row.marketplaceKey} />
                    <OriginBadge origin={row.origin} />
                  </div>
                </TD>
                <TD className="min-w-[230px]">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">{row.title}</span>
                    <JustListedBadge ageMin={row.ageMin} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                    <span className="mono">{row.storageGb ? `${row.storageGb} GB` : "—"}</span>
                    {row.ramGb && <span className="mono">· {row.ramGb} GB RAM</span>}
                    {row.chip && <span>· {row.chip}</span>}
                    {row.condition && row.condition !== "unknown" && (
                      <span>· {row.condition.replace("_", " ")}</span>
                    )}
                    {row.batteryHealth && <span className="mono">· {row.batteryHealth}%</span>}
                    {row.location && <span>· {row.location}</span>}
                    {row.duplicateOf && (
                      <span className="rounded border border-warn/40 bg-warn/10 px-1 py-0.5 text-[10px] font-semibold text-warn">
                        POSSIBLE DUPLICATE
                      </span>
                    )}
                    {row.priceDrop !== null && row.priceDrop > 0 && (
                      <span className="mono rounded border border-good/40 bg-good/10 px-1 py-0.5 text-[10px] font-semibold text-good">
                        PRICE DROP -{formatDkk(row.priceDrop)}
                      </span>
                    )}
                  </div>
                </TD>
                <TD className="mono text-right font-semibold text-ink">{formatDkk(row.priceDkk)}</TD>
                <TD className="text-right">
                  <div className="mono text-muted">{formatDkk(row.marketValueDkk)}</div>
                  <div className="mt-0.5 flex justify-end">
                    <ConfidenceBadge confidence={row.estimateConfidence} sample={row.estimateSample} />
                  </div>
                </TD>
                <TD className="mono text-right text-muted">{formatDkk(row.quickSaleValueDkk)}</TD>
                <TD
                  className={cn(
                    "mono text-right font-semibold",
                    (row.netProfitDkk ?? 0) > 0 ? "text-good" : "text-dim"
                  )}
                >
                  {row.netProfitDkk !== null ? formatDkk(row.netProfitDkk) : "—"}
                  {row.roiPct !== null && (
                    <div className="text-[10.5px] font-normal text-muted">{formatPct(row.roiPct)}</div>
                  )}
                </TD>
                <TD
                  className={cn(
                    "mono text-right font-semibold",
                    (row.discountPct ?? 0) >= 25
                      ? "text-steal"
                      : (row.discountPct ?? 0) >= 15
                        ? "text-great"
                        : (row.discountPct ?? 0) >= 8
                          ? "text-good"
                          : "text-dim"
                  )}
                >
                  {row.discountPct !== null ? formatPct(row.discountPct) : "—"}
                </TD>
                <TD>
                  <div className="flex items-center gap-2">
                    <span className="mono w-7 text-right text-[13px] font-semibold">
                      {Math.round(row.dealScore)}
                    </span>
                    <div className="h-1.5 w-12 overflow-hidden rounded-full bg-panel-3">
                      <div
                        className={cn("h-full rounded-full", scoreColor(row.dealScore))}
                        style={{ width: `${Math.max(3, row.dealScore)}%` }}
                      />
                    </div>
                  </div>
                  <div className="mt-1">
                    <TierBadge tier={row.dealTier} />
                  </div>
                </TD>
                <TD className="mono whitespace-nowrap text-[12px] text-muted">
                  {formatAge(row.postedAt)}
                </TD>
                <TD>
                  <VelocityBadge level={row.velocityLevel} />
                </TD>
                <TD>
                  <RiskBadge level={row.riskLevel} score={row.riskScore} />
                </TD>
                <TD onClick={(e) => e.stopPropagation()}>
                  <RowActions row={row} onAction={onAction} />
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </div>

      {/* Mobile / tablet */}
      <div className="divide-y divide-line lg:hidden">
        {rows.map((row) => (
          <div
            key={row.id}
            onClick={() => open(row.id)}
            className={cn(
              "cursor-pointer px-4 py-3 transition-colors hover:bg-panel-2",
              row.dealTier === "STEAL" && "bg-steal/[0.05]"
            )}
          >
            <div className="flex gap-3">
              <ProductThumb row={row} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-ink">{row.title}</span>
                  <JustListedBadge ageMin={row.ageMin} />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <ProviderBadge provider={row.marketplaceKey} />
                  <OriginBadge origin={row.origin} />
                  <TierBadge tier={row.dealTier} />
                  <RiskBadge level={row.riskLevel} score={row.riskScore} />
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                  <div>
                    <div className="eyebrow">Pris</div>
                    <div className="mono text-[13px] font-semibold">{formatDkk(row.priceDkk)}</div>
                  </div>
                  <div>
                    <div className="eyebrow">Marked</div>
                    <div className="mono text-[13px] text-muted">{formatDkk(row.marketValueDkk)}</div>
                  </div>
                  <div>
                    <div className="eyebrow">Profit</div>
                    <div
                      className={cn(
                        "mono text-[13px]",
                        (row.netProfitDkk ?? 0) > 0 ? "text-good" : "text-dim"
                      )}
                    >
                      {row.netProfitDkk !== null ? formatDkk(row.netProfitDkk) : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="eyebrow">Score</div>
                    <div className="mono text-[13px] font-semibold">{Math.round(row.dealScore)}</div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
                  <span>{formatAge(row.postedAt)}</span>
                  <span className="mono">
                    {row.discountPct !== null ? `${formatPct(row.discountPct)} vs. marked` : ""}
                  </span>
                </div>
              </div>
            </div>
            <div onClick={(e) => e.stopPropagation()} className="mt-2 flex justify-end">
              <RowActions row={row} onAction={onAction} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
