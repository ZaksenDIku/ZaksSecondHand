import type { MarketplaceProvider, ProviderStatus } from "./types";

/**
 * The catch-all import adapter: paste a URL, paste listing details, CSV or
 * JSON. Imported records flow through exactly the same pipeline as any
 * automated record - parse, estimate, score, risk, duplicates.
 */
export const manualProvider: MarketplaceProvider = {
  key: "manual",
  name: "Manuel import",

  async getStatus(): Promise<ProviderStatus> {
    return {
      key: "manual",
      name: "Manuel import",
      accessStatus: "MANUAL",
      accessMode: "URL / TEKST / CSV / JSON",
      detail:
        "Alt du indsætter selv: enkeltannonce-URL'er, fritekst, CSV eller JSON. Dataene markeres som IMPORTED og gennemgår samme analyse som automatiserede data.",
      requirements: ["Ingen - virker med det samme"],
      enabled: true,
      canSync: false,
      lastSyncAt: null,
      lastSyncError: null,
      listingCount: 0,
    };
  },
};
