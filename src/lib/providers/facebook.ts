import { db } from "../db/index";
import { listings } from "../db/schema";
import { eq } from "drizzle-orm";
import type { MarketplaceProvider, ProviderStatus } from "./types";

/**
 * Facebook Marketplace has no public API for listing data. The Graph API does
 * not expose Marketplace inventory, and automated collection of Facebook pages
 * is prohibited by its terms. This adapter is therefore intentionally inert: it
 * reports UNAVAILABLE and accepts data only through the manual import path.
 */
export const facebookProvider: MarketplaceProvider = {
  key: "facebook",
  name: "Facebook Marketplace",

  async getStatus(): Promise<ProviderStatus> {
    const rows = db.select().from(listings).where(eq(listings.marketplaceKey, "facebook")).all();
    return {
      key: "facebook",
      name: "Facebook Marketplace",
      accessStatus: "UNAVAILABLE",
      accessMode: "MANUEL IMPORT",
      detail:
        "Facebook udbyder ingen API til Marketplace-annoncer. Automatiseret hentning er ikke tilladt, og ZaksSecondHand forsøger heller ikke det. Annoncer kan kun komme ind ved at du selv indsætter dem.",
      requirements: [
        "Indsæt annonce-URL + titel/pris/beskrivelse manuelt via Import",
        "Videresend din Marketplace-søgnings-notifikation via e-mail-ingestion",
        "Hvis Meta på et tidspunkt åbner en partner-API, tilsluttes den her uden ændringer i appen",
      ],
      enabled: true,
      canSync: false,
      lastSyncAt: null,
      lastSyncError: null,
      listingCount: rows.length,
      docsUrl: "https://developers.facebook.com/docs/marketplace",
    };
  },
};
