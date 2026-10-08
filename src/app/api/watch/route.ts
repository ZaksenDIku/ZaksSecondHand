import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureBootstrap } from "@/lib/db/bootstrap";
import { db } from "@/lib/db/index";
import { watchRules } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { newId } from "@/lib/db/ids";
import { getWatchRules } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

const body = z.object({
  action: z.enum(["create", "delete", "toggle"]),
  id: z.string().optional(),
  label: z.string().min(1).optional(),
  productType: z.enum(["iphone", "macbook"]).nullable().optional(),
  canonicalKey: z.string().nullable().optional(),
  storageGb: z.number().int().nullable().optional(),
  maxPriceDkk: z.number().int().min(0).nullable().optional(),
  minDealScore: z.number().min(0).max(100).nullable().optional(),
  minProfitDkk: z.number().int().min(0).nullable().optional(),
  marketplaces: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
});

export async function GET() {
  await ensureBootstrap();
  return NextResponse.json({ rules: getWatchRules() });
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
  const p = parsed.data;

  if (p.action === "create") {
    const id = newId("wr");
    db.insert(watchRules)
      .values({
        id,
        label: p.label ?? "Ny regel",
        productType: p.productType ?? null,
        canonicalKey: p.canonicalKey ?? null,
        storageGb: p.storageGb ?? null,
        maxPriceDkk: p.maxPriceDkk ?? null,
        minDealScore: p.minDealScore ?? null,
        minProfitDkk: p.minProfitDkk ?? null,
        marketplaces: p.marketplaces ? JSON.stringify(p.marketplaces) : null,
        enabled: true,
        createdAt: Date.now(),
      })
      .run();
    return NextResponse.json({ ok: true, id });
  }

  if (!p.id) return NextResponse.json({ error: "id er påkrævet" }, { status: 400 });

  if (p.action === "toggle") {
    const existing = db.select().from(watchRules).where(eq(watchRules.id, p.id)).get();
    if (!existing) return NextResponse.json({ error: "Regel ikke fundet" }, { status: 404 });
    db.update(watchRules).set({ enabled: p.enabled ?? !existing.enabled }).where(eq(watchRules.id, p.id)).run();
    return NextResponse.json({ ok: true });
  }

  const existing = db.select({ id: watchRules.id }).from(watchRules).where(eq(watchRules.id, p.id)).get();
  if (!existing) return NextResponse.json({ error: "Regel ikke fundet" }, { status: 404 });
  db.delete(watchRules).where(eq(watchRules.id, p.id)).run();
  return NextResponse.json({ ok: true });
}
