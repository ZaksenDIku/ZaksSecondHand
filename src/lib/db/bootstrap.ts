import { db } from "./index";
import { marketplaces } from "./schema";
import { eq } from "drizzle-orm";
import { getAppSettings, updateAppSettings } from "./settings";
import { seedDefaultAlertRules } from "./alerts";
import { clearDemoFixtures, seedDemoFixtures } from "./demo";

const MARKETPLACE_SEED = [
  {
    key: "dba",
    name: "DBA",
    accessStatus: "MANUAL",
    accessMode: "URL_IMPORT",
    docsUrl: "https://www.dba.dk/",
    notes: "Ingen offentlig API. Enkelt-URL-hentning og manuel import.",
  },
  {
    key: "facebook",
    name: "Facebook Marketplace",
    accessStatus: "UNAVAILABLE",
    accessMode: "MANUAL_IMPORT",
    docsUrl: "https://www.facebook.com/marketplace/",
    notes: "Ingen API. Kun manuel import eller e-mail-alert.",
  },
  {
    key: "vinted",
    name: "Vinted",
    accessStatus: "UNAVAILABLE",
    accessMode: "MANUAL_IMPORT",
    docsUrl: "https://www.vinted.dk/",
    notes: "Officiel API kræver allow-listed Vinted Pro-konto.",
  },
  {
    key: "manual",
    name: "Manuel import",
    accessStatus: "MANUAL",
    accessMode: "URL_TEXT_CSV_JSON",
    docsUrl: "",
    notes: "Indsæt URL, tekst, CSV eller JSON.",
  },
  {
    key: "email",
    name: "E-mail-alert ingestion",
    accessStatus: "MANUAL",
    accessMode: "ALERT_INGESTION",
    docsUrl: "",
    notes: "Videresend søgnings-alerts.",
  },
  {
    key: "demo",
    name: "DEMO (fixture)",
    accessStatus: "MANUAL",
    accessMode: "DEMO_FIXTURE",
    docsUrl: "",
    notes: "Kunstige data til udvikling. Markeret DEMO alle vegne.",
  },
];

let bootstrapped = false;

export async function ensureBootstrap(): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;

  for (const row of MARKETPLACE_SEED) {
    const existing = db.select().from(marketplaces).where(eq(marketplaces.key, row.key)).get();
    if (!existing) {
      db.insert(marketplaces).values({ ...row, enabled: true }).run();
    }
  }

  seedDefaultAlertRules();

  const settings = getAppSettings();
  if (settings.demo.enabled) {
    await seedDemoFixtures();
  } else {
    clearDemoFixtures();
  }

  if (!settings.setupComplete) {
    // First run: keep the flag false so /setup is shown once.
    updateAppSettings({});
  }
}
