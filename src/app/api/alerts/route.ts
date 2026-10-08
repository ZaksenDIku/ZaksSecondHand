import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureBootstrap } from "@/lib/db/bootstrap";
import { createAlertRule } from "@/lib/db/alerts";
import { getAlertRules, getRecentAlerts, deleteAlertRule, setAlertRuleEnabled } from "@/lib/db/queries";
import {
  dispatchNotifications,
  notificationChannels,
  type NotificationSendResult,
} from "@/lib/notifications";
import { getNotificationLog } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

const body = z.object({
  action: z.enum(["create", "delete", "toggle", "test", "read"]),
  id: z.string().optional(),
  name: z.string().optional(),
  kind: z.enum(["deal_score", "profit", "discount", "price_below"]).optional(),
  threshold: z.number().optional(),
  canonicalKey: z.string().nullable().optional(),
  productType: z.enum(["iphone", "macbook"]).optional(),
  enabled: z.boolean().optional(),
});

export async function GET() {
  await ensureBootstrap();
  return NextResponse.json({
    rules: getAlertRules(),
    recent: getRecentAlerts(25),
    channels: notificationChannels.map((c) => ({ key: c.key, label: c.label, ...c.status() })),
    log: getNotificationLog(15),
  });
}

export async function POST(req: Request) {
  await ensureBootstrap();
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ugyldig forespørgsel" },
      { status: 400 }
    );
  }
  const { action } = parsed.data;

  if (action === "create") {
    if (!parsed.data.name || parsed.data.kind === undefined) {
      return NextResponse.json({ error: "Navn og type er påkrævede" }, { status: 400 });
    }
    const id = createAlertRule({
      name: parsed.data.name,
      kind: parsed.data.kind,
      threshold: parsed.data.threshold ?? 0,
      canonicalKey: parsed.data.canonicalKey ?? null,
      productType: parsed.data.productType ?? null,
    });
    return NextResponse.json({ ok: true, id });
  }

  if (action === "delete") {
    const ok = parsed.data.id ? deleteAlertRule(parsed.data.id) : false;
    return NextResponse.json({ ok, error: ok ? null : "Regel ikke fundet" }, { status: ok ? 200 : 404 });
  }

  if (action === "toggle") {
    const ok = parsed.data.id && parsed.data.enabled !== undefined
      ? setAlertRuleEnabled(parsed.data.id, parsed.data.enabled)
      : false;
    return NextResponse.json({ ok, error: ok ? null : "Regel ikke fundet" }, { status: ok ? 200 : 404 });
  }

  if (action === "test") {
    const results: Record<string, NotificationSendResult | { ready: boolean; reason: string }> = {};
    for (const channel of notificationChannels) {
      const status = channel.status();
      if (!status.ready) {
        results[channel.key] = status;
        continue;
      }
      try {
        results[channel.key] = await channel.send({
          title: "ZaksSecondHand test",
          body: `Notifikationskanal testet ${new Date().toLocaleString("da-DK")}`,
        });
      } catch (err) {
        results[channel.key] = { ok: false, detail: err instanceof Error ? err.message : String(err) };
      }
    }
    await dispatchNotifications({
      title: "ZaksSecondHand test",
      body: `Notifikationskanal testet ${new Date().toLocaleString("da-DK")}`,
    });
    return NextResponse.json({ ok: true, results });
  }

  return NextResponse.json({ ok: true, read: true });
}
