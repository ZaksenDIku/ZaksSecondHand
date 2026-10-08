import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureBootstrap } from "@/lib/db/bootstrap";
import { ingestBatch } from "@/lib/db/ingest";
import { recordsFromCsv, recordsFromJson } from "@/lib/importer";
import { dbaProvider } from "@/lib/providers/dba";
import type { RawListingRecord } from "@/lib/providers/types";
import { parseAlertText } from "@/lib/providers/email-ingest";

export const dynamic = "force-dynamic";

const schema = z.object({
  mode: z.enum(["url", "text", "csv", "json", "email"]),
  payload: z.string().min(1, "Payload må ikke være tom"),
  /** Attribution for imports that carry no marketplace link. */
  marketplace: z
    .string()
    .trim()
    .regex(/^[a-zA-Z][a-zA-Z0-9 _-]{0,30}$/, "Ugyldigt markedspladsnavn")
    .optional()
    .or(z.literal("")),
});

export async function POST(req: Request) {
  await ensureBootstrap();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ugyldig forespørgsel" },
      { status: 400 }
    );
  }

  const { mode, payload } = parsed.data;
  const statedMarketplace = parsed.data.marketplace?.toLowerCase() || null;
  const results: { title: string; url: string | null; status: string; listingId: string | null }[] = [];
  const errors: string[] = [];
  let records: RawListingRecord[] = [];
  let skipped = 0;

  try {
    if (mode === "url") {
      const url = payload.trim();
      if (!/^https?:\/\//i.test(url)) throw new Error("URL skal starte med http:// eller https://");
      const fetchListing = dbaProvider.fetchListing;
      if (!fetchListing) {
        return NextResponse.json({ error: "DBA-adapteren understøtter ikke URL-hentning" }, { status: 400 });
      }
      const meta = await fetchListing(url);
      if (meta) {
        records = [meta];
      } else {
        results.push({ title: url, url, status: "MANUEL", listingId: null });
        errors.push(
          "DBA kunne ikke hentes automatisk (kun én URL ad gangen, ingen credentials). Åbn linket, kopier titel/pris/billede-URL og brug 'Ingen markedsplads-link' import."
        );
      }
    } else if (mode === "text" || mode === "email") {
      const parsedRecords = parseAlertText(payload);
      records = parsedRecords;
      if (records.length === 0) throw new Error("Kunne ikke finde nogen annonce i teksten");
    } else if (mode === "csv") {
      const res = recordsFromCsv(payload, statedMarketplace ?? "manual");
      records = res.records;
      errors.push(...res.errors);
      skipped = res.skipped;
      if (records.length === 0 && res.errors.length === 0) throw new Error("CSV'en indeholdt ingen rækker");
    } else {
      const res = recordsFromJson(payload);
      records = res.records;
      errors.push(...res.errors);
      skipped = res.skipped;
      if (records.length === 0 && res.errors.length === 0) throw new Error("JSON'en indeholdt ingen elementer");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ukendt fejl";
    return NextResponse.json({ error: message, results, errors }, { status: 400 });
  }

  if (statedMarketplace) {
    for (const r of records) r.marketplaceKey ??= statedMarketplace;
  }

  const providerKey = mode === "url" ? "dba" : mode === "email" ? "email" : (statedMarketplace ?? "manual");
  const ingest = await ingestBatch(records, providerKey);
  errors.push(...ingest.errors.slice(0, 10));

  for (let i = 0; i < records.length; i++) {
    results.push({
      title: records[i].rawTitle.slice(0, 80),
      url: records[i].url ?? null,
      status: "OK",
      listingId: null,
    });
  }

  return NextResponse.json({
    ok: true,
    parsed: records.length,
    created: ingest.created,
    updated: ingest.updated,
    skipped: skipped + ingest.skipped,
    results,
    errors,
  });
}
