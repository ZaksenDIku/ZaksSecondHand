import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureBootstrap } from "@/lib/db/bootstrap";
import { getAppSettings, updateAppSettings, DEFAULT_SETTINGS, type AppSettings } from "@/lib/db/settings";
import { reanalyzeAll } from "@/lib/db/ingest";
import { seedDemoFixtures, clearDemoFixtures } from "@/lib/db/demo";

export const dynamic = "force-dynamic";

const weights = z.object({
  discountWeight: z.number(),
  profitWeight: z.number(),
  roiWeight: z.number(),
  freshnessWeight: z.number(),
  confidenceWeight: z.number(),
  riskPenalty: z.number(),
});

const body = z.object({
  setupComplete: z.boolean().optional(),
  freshnessHours: z.number().int().min(1).max(720).optional(),
  demo: z.object({ enabled: z.boolean() }).partial().optional(),
  weights: weights.partial().optional(),
  flip: z.record(z.string(), z.unknown()).optional(),
  profile: z
    .object({
      maxBudgetDkk: z.number().int().min(0).optional(),
      minProfitDkk: z.number().int().min(0).optional(),
      minRoiPct: z.number().min(-100).optional(),
      preferredMarketplaces: z.array(z.string()).optional(),
      location: z.string().optional(),
      maxTravelRadiusKm: z.number().int().min(0).optional(),
      products: z.array(z.string()).optional(),
      notifications: z.array(z.string()).optional(),
    })
    .partial()
    .optional(),
  notifications: z
    .object({
      browser: z.boolean().optional(),
      telegram: z
        .object({ enabled: z.boolean().optional(), botToken: z.string().optional(), chatId: z.string().optional() })
        .partial()
        .optional(),
      discord: z.object({ enabled: z.boolean().optional(), webhookUrl: z.string().optional() }).partial().optional(),
      email: z
        .object({
          enabled: z.boolean().optional(),
          resendApiKey: z.string().optional(),
          to: z.string().optional(),
          from: z.string().optional(),
        })
        .partial()
        .optional(),
    })
    .partial()
    .optional(),
  demoAction: z.enum(["seed", "clear"]).optional(),
  reanalyze: z.boolean().optional(),
});

/** Secrets are stored but never returned to the client. */
function mask(s: AppSettings) {
  return {
    ...s,
    notifications: {
      ...s.notifications,
      telegram: { ...s.notifications.telegram, botToken: s.notifications.telegram.botToken ? "••••••••" : "" },
      discord: {
        ...s.notifications.discord,
        webhookUrl: s.notifications.discord.webhookUrl
          ? `${s.notifications.discord.webhookUrl.split("/").slice(0, 3).join("/")}/••••`
          : "",
      },
      email: {
        ...s.notifications.email,
        resendApiKey: s.notifications.email.resendApiKey ? "••••••••" : "",
      },
    },
  };
}

export async function GET() {
  await ensureBootstrap();
  return NextResponse.json({ settings: mask(getAppSettings()), defaults: DEFAULT_SETTINGS });
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
  const patch: Partial<AppSettings> = {};
  const { demoAction, reanalyze, ...rest } = parsed.data;
  if (rest.setupComplete !== undefined) patch.setupComplete = rest.setupComplete;
  if (rest.freshnessHours !== undefined) patch.freshnessHours = rest.freshnessHours;
  if (rest.weights) patch.weights = { ...getAppSettings().weights, ...rest.weights };
  if (rest.flip) {
    patch.flip = { ...getAppSettings().flip, ...(rest.flip as Record<string, never>) };
  }
  if (rest.profile) patch.profile = { ...getAppSettings().profile, ...rest.profile };
  if (rest.notifications) {
    const current = getAppSettings().notifications;
    patch.notifications = {
      ...current,
      ...rest.notifications,
      telegram: { ...current.telegram, ...rest.notifications.telegram },
      discord: { ...current.discord, ...rest.notifications.discord },
      email: { ...current.email, ...rest.notifications.email },
    } as AppSettings["notifications"];
  }
  if (rest.demo) patch.demo = { ...getAppSettings().demo, ...rest.demo };

  updateAppSettings(patch);

  let demoResult: string | null = null;
  if (demoAction === "seed") {
    demoResult = `${seedDemoFixtures()} demo-records opdateret`;
  } else if (demoAction === "clear") {
    demoResult = `${clearDemoFixtures()} demo-records fjernet`;
  }

  const reanalyzed = reanalyze ? reanalyzeAll(1000) : 0;

  return NextResponse.json({ ok: true, settings: mask(getAppSettings()), demoResult, reanalyzed });
}
