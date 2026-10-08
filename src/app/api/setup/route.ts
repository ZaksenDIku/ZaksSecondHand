import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureBootstrap } from "@/lib/db/bootstrap";
import { getAppSettings, updateAppSettings } from "@/lib/db/settings";
import { seedDemoFixtures } from "@/lib/db/demo";

export const dynamic = "force-dynamic";

const body = z.object({
  profile: z
    .object({
      maxBudgetDkk: z.number().int().min(0),
      minProfitDkk: z.number().int().min(0),
      minRoiPct: z.number(),
      preferredMarketplaces: z.array(z.string()),
      location: z.string(),
      maxTravelRadiusKm: z.number().int().min(0),
      products: z.array(z.string()),
      notifications: z.array(z.string()),
    })
    .partial()
    .optional(),
  demo: z.object({ enabled: z.boolean() }).optional(),
  setupComplete: z.boolean().optional(),
});


export async function POST(req: Request) {
  await ensureBootstrap();
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ugyldig forespørgsel" },
      { status: 400 }
    );
  }
  if (parsed.data.profile) {
    const current = getAppSettings().profile;
    updateAppSettings({ profile: { ...current, ...parsed.data.profile } });
  }
  if (parsed.data.demo) updateAppSettings({ demo: parsed.data.demo });
  updateAppSettings({ setupComplete: parsed.data.setupComplete ?? true });
  if (parsed.data.demo?.enabled) await seedDemoFixtures();
  return NextResponse.json({ ok: true, setupComplete: true });
}
