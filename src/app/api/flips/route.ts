import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureBootstrap } from "@/lib/db/bootstrap";
import { createFlip, updateFlip, deleteFlip } from "@/lib/db/flips";
import { getFlips } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

const body = z.object({
  action: z.enum(["create", "update", "close", "delete"]),
  id: z.string().optional(),
  listingId: z.string().nullable().optional(),
  productLabel: z.string().min(1).optional(),
  canonicalKey: z.string().nullable().optional(),
  storageGb: z.number().int().nullable().optional(),
  purchasePriceDkk: z.number().int().min(0).optional(),
  purchaseDate: z.number().optional(),
  purchaseMarketplace: z.string().nullable().optional(),
  expensesDkk: z.number().int().min(0).optional(),
  salePriceDkk: z.number().int().min(0).nullable().optional(),
  saleDate: z.number().nullable().optional(),
  salePlatform: z.string().nullable().optional(),
  notes: z.string().optional(),
  status: z.enum(["CONTACTED", "NEGOTIATING", "PURCHASED", "PREPARING", "LISTED", "SOLD"]).optional(),
  offerDkk: z.number().int().min(0).nullable().optional(),
});

export async function GET() {
  await ensureBootstrap();
  return NextResponse.json({ flips: getFlips() });
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
    if (!p.productLabel || p.purchasePriceDkk === undefined) {
      return NextResponse.json({ error: "Produkt og købspris er påkrævede" }, { status: 400 });
    }
    const id = createFlip({
      listingId: p.listingId ?? null,
      productLabel: p.productLabel,
      canonicalKey: p.canonicalKey ?? null,
      storageGb: p.storageGb ?? null,
      purchasePriceDkk: p.purchasePriceDkk,
      purchaseDate: p.purchaseDate,
      purchaseMarketplace: p.purchaseMarketplace ?? null,
      expensesDkk: p.expensesDkk,
      salePriceDkk: p.salePriceDkk ?? null,
      saleDate: p.saleDate ?? null,
      salePlatform: p.salePlatform ?? null,
      // A flip only counts as sold when the caller actually says so; otherwise
      // fall back to the pipeline's first stage.
      status: p.status ?? (p.salePriceDkk != null ? "SOLD" : "CONTACTED"),
      offerDkk: p.offerDkk ?? null,
      notes: p.notes,
    });
    return NextResponse.json({ ok: true, id });
  }

  if (!p.id) return NextResponse.json({ error: "id er påkrævet" }, { status: 400 });

  if (p.action === "update") {
    const ok = updateFlip(p.id, {
      ...p,
      listedForSaleAt: p.status === "LISTED" ? Date.now() : undefined,
    });
    return NextResponse.json({ ok, error: ok ? null : "Flip ikke fundet" }, { status: ok ? 200 : 404 });
  }

  if (p.action === "close") {
    const ok = updateFlip(p.id, {
      salePriceDkk: p.salePriceDkk ?? null,
      saleDate: p.saleDate ?? Date.now(),
      salePlatform: p.salePlatform ?? null,
      status: "SOLD",
      notes: p.notes,
    });
    return NextResponse.json({ ok, error: ok ? null : "Flip ikke fundet" }, { status: ok ? 200 : 404 });
  }

  const ok = deleteFlip(p.id);
  return NextResponse.json({ ok, error: ok ? null : "Flip ikke fundet" }, { status: ok ? 200 : 404 });
}
