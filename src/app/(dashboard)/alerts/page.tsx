import Link from "next/link";
import { ensureBootstrap } from "@/lib/db/bootstrap";
import { getAlertRules, getRecentAlerts, getNotificationLog } from "@/lib/db/queries";
import { PageHeader } from "@/components/domain/page-header";
import { AlertRuleForm, AlertRuleActions, TestChannelsButton } from "@/components/domain/alert-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { OriginBadge } from "@/components/domain/badges";
import { formatAge, formatDateTime } from "@/lib/core/format";
import { notificationChannels } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/** 🔔 Alert categories with fixed semantic colour. */
const CATEGORIES: Record<string, { emoji: string; label: string; cls: string }> = {
  URGENT: { emoji: "🚨", label: "URGENT", cls: "border-steal/50 bg-steal/12 text-steal" },
  HOT: { emoji: "🔥", label: "HOT", cls: "border-accent/50 bg-accent/12 text-accent" },
  PRICE_DROP: { emoji: "📉", label: "PRISFALD", cls: "border-good/40 bg-good/10 text-good" },
  TARGET_HIT: { emoji: "🎯", label: "TARGET HIT", cls: "border-info/40 bg-info/10 text-info" },
  HIDDEN_GEM: { emoji: "💎", label: "HIDDEN GEM", cls: "border-demo/40 bg-demo/12 text-demo" },
  RISK_CHANGE: { emoji: "🛡", label: "RISK CHANGE", cls: "border-danger/40 bg-danger/12 text-danger" },
  INFO: { emoji: "ℹ️", label: "INFO", cls: "border-line bg-panel-2 text-muted" },
};

export default async function AlertsPage() {
  await ensureBootstrap();
  const recent = getRecentAlerts(60);
  const rules = getAlertRules();
  const log = getNotificationLog(10);
  const channels = notificationChannels.map((c) => ({ key: c.key, label: c.label, ...c.status() }));

  const counts = recent.reduce<Record<string, number>>((acc, a) => {
    acc[a.category] = (acc[a.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="🔔 Alerts"
        subtitle="Alarmer opstår kun for data du selv har importeret eller for godkendte kilder. DEMO-records udløser aldrig alarmer."
        actions={<TestChannelsButton />}
      />

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
        {Object.entries(CATEGORIES).map(([key, c]) => (
          <div key={key} className={`rounded-lg border px-3 py-2 ${c.cls}`}>
            <div className="text-[11.5px] font-semibold">
              {c.emoji} {c.label}
            </div>
            <div className="mono mt-0.5 text-[15px] font-bold">{counts[key] ?? 0}</div>
          </div>
        ))}
      </div>

      <div className="mb-5">
        <AlertRuleForm />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-[13px]">Seneste alarmer ({recent.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {recent.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    title="Ingen alarmer endnu"
                    description="Alarmer opstår, når en importeret annonce matcher en regel eller en watch-grænse. DEMO-data er bevidst undtaget."
                    action={
                      <Link href="/import">
                        <span className="text-[12.5px] text-accent underline underline-offset-2">Importér data</span>
                      </Link>
                    }
                  />
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {recent.map((a) => {
                    const c = CATEGORIES[a.category] ?? CATEGORIES.INFO;
                    return (
                      <li key={a.id} className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium ${c.cls}`}>
                            {c.emoji} {c.label}
                          </span>
                          <OriginBadge origin={a.origin} />
                          <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{a.title}</span>
                          <span className="text-[11px] text-dim">{formatAge(a.createdAt)}</span>
                          {a.listingId && (
                            <Link href={`/listings/${a.listingId}`} className="text-[11.5px] text-accent hover:underline">
                              Åbn →
                            </Link>
                          )}
                        </div>
                        <p className="mono mt-1 whitespace-pre-line text-[11px] text-dim">{a.body}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[13px]">Regler ({rules.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {rules.length === 0 ? (
                <p className="p-4 text-[12px] text-dim">Ingen regler endnu.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {rules.map((r) => (
                    <li key={r.id} className="flex items-center gap-2 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] text-ink">{r.name}</div>
                        <div className="mono text-[11px] text-dim">
                          {r.kind} ≥ {r.threshold}
                          {r.productType ? ` · ${r.productType}` : ""} · {r.lastFiredAt ? `sidst ${formatAge(r.lastFiredAt)}` : "aldrig"}
                        </div>
                      </div>
                      <AlertRuleActions id={r.id} enabled={r.enabled} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-[13px]">📡 Notifikationskanaler</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-line">
                {channels.map((c) => (
                  <li key={c.key} className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[12.5px] text-ink">{c.label}</span>
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[10.5px] ${
                          c.ready ? "border-good/40 bg-good/10 text-good" : "border-line bg-panel-2 text-dim"
                        }`}
                      >
                        {c.ready ? "🟢 klar" : "⚪ ikke konfigureret"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-dim">{c.reason}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-[13px]">Leveringslog</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {log.length === 0 ? (
                <p className="p-4 text-[12px] text-dim">Ingen leveringsforsøg endnu.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {log.map((n) => (
                    <li key={n.id} className="flex items-center gap-2 px-3 py-1.5 text-[11.5px]">
                      <span className={n.status === "sent" || n.status === "queued" ? "text-good" : "text-danger"}>
                        {n.status === "sent" ? "✅" : n.status === "queued" ? "🕐" : "⛔"}
                      </span>
                      <span className="text-muted">{n.channel}</span>
                      <span className="mono ml-auto text-dim">{formatDateTime(n.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
