import { db } from "./index";
import { settings } from "./schema";
import { eq } from "drizzle-orm";
import { DEFAULT_WEIGHTS } from "../core/deal-score";
import type { DataOrigin, DealScoreWeights } from "../core/types";
import { FLIP_DEFAULTS, type FlipDefaults } from "../core/flip";

export interface NotificationSettings {
  browser: boolean;
  telegram: { enabled: boolean; botToken: string; chatId: string };
  discord: { enabled: boolean; webhookUrl: string };
  email: { enabled: boolean; resendApiKey: string; to: string; from: string };
}

export interface DemoSettings {
  enabled: boolean;
}

export interface ProfileSettings {
  maxBudgetDkk: number;
  minProfitDkk: number;
  minRoiPct: number;
  preferredMarketplaces: string[];
  location: string;
  maxTravelRadiusKm: number;
  products: string[];
  notifications: string[];
}

export interface AppSettings {
  setupComplete: boolean;
  demo: DemoSettings;
  weights: DealScoreWeights;
  flip: FlipDefaults;
  profile: ProfileSettings;
  notifications: NotificationSettings;
  freshnessHours: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  setupComplete: false,
  demo: { enabled: true },
  weights: { ...DEFAULT_WEIGHTS },
  flip: { ...FLIP_DEFAULTS },
  profile: {
    maxBudgetDkk: 6000,
    minProfitDkk: 800,
    minRoiPct: 15,
    preferredMarketplaces: ["dba", "facebook", "vinted", "manual"],
    location: "København",
    maxTravelRadiusKm: 50,
    products: ["iphone", "macbook"],
    notifications: ["browser"],
  },
  notifications: {
    browser: true,
    telegram: { enabled: false, botToken: "", chatId: "" },
    discord: { enabled: false, webhookUrl: "" },
    email: { enabled: false, resendApiKey: "", to: "", from: "ZaksSecondHand <alerts@example.com>" },
  },
  freshnessHours: 36,
};

const CACHE = new Map<string, unknown>();

export function resetSettingsCache() {
  CACHE.clear();
}

export function getSetting<T>(key: string, fallback: T): T {
  if (CACHE.has(key)) return CACHE.get(key) as T;
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  if (!row) return fallback;
  try {
    const parsed = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
    CACHE.set(key, parsed);
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function setSetting(key: string, value: unknown) {
  const now = Date.now();
  const serialized = JSON.stringify(value);
  const existing = db.select().from(settings).where(eq(settings.key, key)).get();
  if (existing) {
    db.update(settings).set({ value: serialized, updatedAt: now }).where(eq(settings.key, key)).run();
  } else {
    db.insert(settings).values({ key, value: serialized, updatedAt: now }).run();
  }
  CACHE.set(key, value);
}

export function getAppSettings(): AppSettings {
  return {
    setupComplete: getSetting("setupComplete", DEFAULT_SETTINGS.setupComplete),
    demo: { ...DEFAULT_SETTINGS.demo, ...getSetting("demo", DEFAULT_SETTINGS.demo) },
    weights: { ...DEFAULT_WEIGHTS, ...getSetting("weights", DEFAULT_SETTINGS.weights) },
    flip: { ...FLIP_DEFAULTS, ...getSetting("flip", DEFAULT_SETTINGS.flip) },
    profile: { ...DEFAULT_SETTINGS.profile, ...getSetting("profile", DEFAULT_SETTINGS.profile) },
    notifications: {
      ...DEFAULT_SETTINGS.notifications,
      ...getSetting("notifications", DEFAULT_SETTINGS.notifications),
    },
    freshnessHours: getSetting("freshnessHours", DEFAULT_SETTINGS.freshnessHours),
  };
}

export function updateAppSettings(patch: Partial<AppSettings>) {
  if (patch.setupComplete !== undefined) setSetting("setupComplete", patch.setupComplete);
  if (patch.demo !== undefined) setSetting("demo", patch.demo);
  if (patch.weights !== undefined) setSetting("weights", { ...DEFAULT_WEIGHTS, ...patch.weights });
  if (patch.flip !== undefined) setSetting("flip", { ...FLIP_DEFAULTS, ...patch.flip });
  if (patch.profile !== undefined) setSetting("profile", { ...DEFAULT_SETTINGS.profile, ...patch.profile });
  if (patch.notifications !== undefined)
    setSetting("notifications", { ...DEFAULT_SETTINGS.notifications, ...patch.notifications });
  if (patch.freshnessHours !== undefined) setSetting("freshnessHours", patch.freshnessHours);
  resetSettingsCache();
}

/** REAL until it ages out of the freshness window, DEMO while demo mode is on. */
export function effectiveOrigin(row: { origin: string; lastSeenAt: number }): DataOrigin {
  const s = getAppSettings();
  if (row.origin === "DEMO") return "DEMO";
  if (Date.now() - row.lastSeenAt > s.freshnessHours * 3600000) return "STALE";
  return row.origin as DataOrigin;
}
