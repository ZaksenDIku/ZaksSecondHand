import { db } from "../db/index";
import { listings } from "../db/schema";
import { eq } from "drizzle-orm";
import type { MarketplaceProvider, ProviderStatus, RawListingRecord } from "./types";
import { extractMetadata, fetchUserSuppliedPage } from "./http";
import { parseDkk } from "../core/normalize";

/**
 * DBA (Den Blå Avis) has no official public developer API and its terms do not
 * permit automated bulk collection. This provider therefore exposes only the
 * permitted path: a single fetch of a URL the user pasted themselves, reading
 * embedded metadata only. No crawling, no pagination, no search automation.
 */
export const dbaProvider: MarketplaceProvider = {
  key: "dba",
  name: "DBA",

  async getStatus(): Promise<ProviderStatus> {
    const rows = db.select().from(listings).where(eq(listings.marketplaceKey, "dba")).all();
    return {
      key: "dba",
      name: "DBA",
      accessStatus: "MANUAL",
      accessMode: "URL_IMPORT / CSV / SÆT MANUELT IND",
      detail:
        "DBA har ingen offentlig udvikler-API, og automatiseret indsamling er ikke tilladt i deres vilkår. ZaksSecondHand henter derfor kun den ene side, du selv indsætter, og læser indlejret metadata (JSON-LD/OpenGraph).",
      requirements: [
        "Indsæt annonce-URL'en manuelt (enkelt hentning, robots.txt respekteres)",
        "Eller importér CSV/JSON fra din egen eksport",
        "Et tredjeparts-JSON-endpoint kan tilkobles via Settings > Datakilder, hvis du har licens til dataene",
      ],
      enabled: true,
      canSync: false,
      lastSyncAt: null,
      lastSyncError: null,
      listingCount: rows.length,
      docsUrl: "https://www.dba.dk/planer/",
    };
  },

  async fetchListing(url: string): Promise<RawListingRecord | null> {
    if (!/dba\.dk|guloggratis\.dk/i.test(url)) return null;
    const outcome = await fetchUserSuppliedPage(url);
    if (!outcome.ok || !outcome.html) {
      throw new Error(outcome.reason ?? "Kunne ikke hente annoncen");
    }
    const meta = extractMetadata(outcome.html);
    if (!meta.title && !meta.price) {
      throw new Error(
        "Siden indeholder ingen læsbar metadata. DBA renderer annoncer i browseren - indsæt i stedet titel, pris og beskrivelse manuelt."
      );
    }
    const price = meta.price ?? parseDkk(meta.description ?? "");
    if (!price) {
      throw new Error("Kunne ikke finde en pris i sidens metadata - indsæt oplysningerne manuelt.");
    }
    const idMatch = url.match(/\/(\d{5,12})(?:[/?#]|$)/);
    return {
      externalId: idMatch?.[1] ?? null,
      url: outcome.finalUrl ?? url,
      rawTitle: meta.title ?? "DBA annonce",
      description: meta.description ?? null,
      priceDkk: price,
      imageUrl: meta.image ?? null,
      location: null,
      postedAt: meta.postedAt ?? null,
      origin: "IMPORTED",
    };
  },
};
