import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureBootstrap } from "@/lib/db/bootstrap";
import { getAllStatuses, syncProvider, nonDemoProviders, hasLiveProvider } from "@/lib/providers/registry";
import { seedDemoFixtures, clearDemoFixtures } from "@/lib/db/demo";
import { getMarketplaces } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

const body = z.object({
  action: z.enum(["sync", "demo-seed", "demo-clear"]),
  key: z.string().optional(),
});

export async function GET() {
  await ensureBootstrap();
  const statuses = await getAllStatuses();
  return NextResponse.json({
    sources: statuses,
    marketplaces: getMarketplaces(),
    hasLive: hasLiveProvider(),
    syncable: nonDemoProviders().filter((p) => typeof p.sync === "function").map((p) => p.key),
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
  const { action, key } = parsed.data;

  if (action === "demo-seed") {
    return NextResponse.json({ ok: true, count: seedDemoFixtures() });
  }
  if (action === "demo-clear") {
    return NextResponse.json({ ok: true, count: clearDemoFixtures() });
  }
  if (!key) return NextResponse.json({ error: "key er påkrævet" }, { status: 400 });
  const result = await syncProvider(key);
  return NextResponse.json({ ok: !result.error, result });
}
