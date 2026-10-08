/**
 * 💎 HIDDEN GEMS
 *
 * Listings the deterministic parser had to fight to understand. Bad titles and
 * thin descriptions reduce buyer visibility, so a well-specified device that
 * was underpriced *because* of sloppy writing is exactly the kind of listing a
 * human scrolling a marketplace would miss.
 *
 * Every reason below is a measured property of the listing. The "why it may be
 * cheap" text is explicitly framed as a hypothesis, never a fact.
 */
export interface HiddenGemReason {
  emoji: string;
  text: string;
  weight: number;
}

export interface HiddenGemInput {
  rawTitle: string;
  description: string;
  title: string;
  parseConfidence: number;
  parseAmbiguous: boolean;
  discountPct: number | null;
  productType: string | null;
  storageGb: number | null;
  ramGb: number | null;
  condition: string | null;
  batteryHealth: number | null;
  descriptionLength: number;
}

export interface HiddenGemResult {
  score: number;
  reasons: HiddenGemReason[];
  detected: string[];
  hypothesis: string | null;
}

const VAGUE_TITLE = /^(apple|iphone|macbook|mac|laptop|computer|iphone til salg|ny enhed|god handel)\b.{0,18}$/i;

export function hiddenGemScore(i: HiddenGemInput): HiddenGemResult {
  const reasons: HiddenGemReason[] = [];
  const detected: string[] = [];
  let score = 0;

  if (VAGUE_TITLE.test(i.rawTitle.trim())) {
    reasons.push({ emoji: "📝", text: `Vagt annoncetitel: "${i.rawTitle.trim()}"`, weight: 25 });
    score += 25;
  }

  if (i.rawTitle.trim().length <= 24) {
    reasons.push({ emoji: "📝", text: `Kun ${i.rawTitle.trim().length} tegn i titlen`, weight: 12 });
    score += 12;
  }

  if (i.descriptionLength < 60) {
    reasons.push({
      emoji: "📄",
      text: i.descriptionLength === 0 ? "Ingen beskrivelse overhovedet" : `Meget kort beskrivelse (${i.descriptionLength} tegn)`,
      weight: 20,
    });
    score += 20;
  } else if (i.descriptionLength < 180) {
    reasons.push({ emoji: "📄", text: `Kort beskrivelse (${i.descriptionLength} tegn)`, weight: 8 });
    score += 8;
  }

  if (i.parseAmbiguous || i.parseConfidence < 0.5) {
    reasons.push({ emoji: "🟣", text: "🟣 AI PARSED — modellen var svær at identificere automatisk", weight: 18 });
    score += 18;
  }

  const specWords: string[] = [];
  if (i.storageGb) specWords.push(`${i.storageGb} GB lagerplads`);
  if (i.ramGb) specWords.push(`${i.ramGb} GB RAM`);
  if (i.productType === "macbook" && i.ramGb && i.ramGb >= 16) specWords.push("16 GB+ RAM (sjældent nævnt i annoncer)");
  if (i.storageGb && i.storageGb >= 512) specWords.push("512 GB+ lagerplads");
  if (specWords.length > 0) {
    detected.push(...specWords);
    reasons.push({ emoji: "✨", text: `Uddannet specifikation: ${specWords.join(", ")}`, weight: 15 });
    score += 15;
  }

  if (i.batteryHealth === null) {
    reasons.push({ emoji: "🔋", text: "Batterihealth ikke nævnt", weight: 6 });
    score += 6;
  }
  if (!i.condition) {
    reasons.push({ emoji: "❔", text: "Stand ikke angivet", weight: 5 });
    score += 5;
  }

  const discount = i.discountPct ?? 0;
  if (discount >= 20) {
    reasons.push({ emoji: "💎", text: `${Math.round(discount)} % under estimeret markedspris`, weight: 20 });
    score += 20;
  }

  const hypothesis =
    reasons.length >= 2 && discount >= 8
      ? "Dårlig titel og tynd beskrivelse kan sænke købsinteressen. Dette er en hypotese, ikke en konstatering — verificér specifikationerne selv."
      : null;

  return { score, reasons, detected, hypothesis };
}
