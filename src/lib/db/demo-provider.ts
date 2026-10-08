import { db } from "./index";
import { listings } from "./schema";
import { eq } from "drizzle-orm";
import type { MarketplaceProvider, ProviderStatus } from "../providers/types";

/**
 * Development fixture provider. It never contacts a network and it never
 * pretends to be a marketplace: every record it produces is tagged DEMO.
 */
export const demoProvider: MarketplaceProvider = {
  key: "demo",
  name: "DEMO (fixture)",

  async getStatus(): Promise<ProviderStatus> {
    const rows = db.select().from(listings).where(eq(listings.origin, "DEMO")).all();
    return {
      key: "demo",
      name: "DEMO (fixture)",
      accessStatus: "MANUAL",
      accessMode: "IKKE RIGTIGE DATA",
      detail:
        "Kunstige udviklingsdata. Bruges til at teste UI og beregninger uden at lyve om at komme fra et marked. Kan slås fra i Indstillinger > Datakilder.",
      requirements: ["Slå fra for kun at se rigtige/importerede data"],
      enabled: true,
      canSync: false,
      lastSyncAt: null,
      lastSyncError: null,
      listingCount: rows.length,
    };
  },
};
