export type OfferTier = "conservative" | "normal" | "aggressive";

export interface NegotiationInput {
  modelLabel: string;
  askingPrice: number;
  marketMedian: number | null;
  quickSale: number | null;
  daysListed: number;
  batteryHealth?: number | null;
  missingAccessories?: string[];
  location?: string | null;
}

export interface OfferOption {
  tier: OfferTier;
  label: string;
  amount: number;
  deltaFromAsking: number;
  message: string;
}

const round50 = (n: number) => Math.max(50, Math.round(n / 50) * 50);

function pickUpLine(location: string | null | undefined): string {
  return location ? `Jeg kan hente det i ${location} i dag` : "Jeg kan hente det i dag";
}

/**
 * Generates Danish offer drafts. Nothing is ever sent automatically - the
 * user copies the text and decides.
 */
export function generateOffers(input: NegotiationInput): OfferOption[] {
  const { askingPrice, marketMedian, daysListed, modelLabel } = input;

  const conservativePrice = round50(Math.max(askingPrice - 100, askingPrice * 0.97));
  const normalPrice = round50(
    Math.max(
      askingPrice - Math.max(150, askingPrice * 0.07),
      (input.quickSale ?? askingPrice) * 0.9
    )
  );
  // A listing that has sat for weeks is worth pushing harder on: the extra
  // 3-5% is what usually breaks a deadlock.
  const stalenessCut =
    daysListed >= 45 ? 0.07 : daysListed >= 21 ? 0.05 : daysListed >= 7 ? 0.03 : daysListed <= 2 ? 0 : 0.015;

  const aggressiveFloor = marketMedian ? marketMedian * 0.7 : askingPrice * 0.8;
  const aggressivePrice = round50(
    Math.min(
      askingPrice - Math.max(250, askingPrice * (0.12 + stalenessCut)),
      Math.max(aggressiveFloor, askingPrice * (0.78 - stalenessCut))
    )
  );

  const stale = daysListed >= 7;

  const conservative = [
    "Hej, er den stadig til salg?",
    `${pickUpLine(input.location)}, og jeg betaler med det samme.`,
    stale
      ? `Vil du tage ${conservativePrice} kr.?`
      : `Jeg er frisk på ${conservativePrice} kr., hvis det passer dig.`,
  ].join(" ");

  const normal = [
    "Hej, er den stadig til salg?",
    `${pickUpLine(input.location)} og betaler med det samme.`,
    `Vil du tage ${normalPrice} kr.?`,
  ].join(" ");

  const aggressiveParts = [
    `Hej, jeg står og skal bruge en ${modelLabel} nu.`,
    `Jeg giver ${aggressivePrice} kr. - jeg henter i dag og betaler med det samme.`,
  ];
  if (marketMedian && askingPrice > marketMedian) {
    aggressiveParts.push(
      `Lignende enheder ligger omkring ${Math.round(marketMedian)} kr. lige nu.`
    );
  }
  const aggressive = aggressiveParts.join(" ");

  const options: OfferOption[] = [
    {
      tier: "conservative",
      label: "Konservativ",
      amount: conservativePrice,
      deltaFromAsking: conservativePrice - askingPrice,
      message: conservative,
    },
    {
      tier: "normal",
      label: "Normal",
      amount: normalPrice,
      deltaFromAsking: normalPrice - askingPrice,
      message: normal,
    },
    {
      tier: "aggressive",
      label: "Aggressiv",
      amount: aggressivePrice,
      deltaFromAsking: aggressivePrice - askingPrice,
      message: aggressive,
    },
  ];

  return options.filter((o) => o.amount > 0 && o.amount <= askingPrice);
}

export function negotiationPoints(input: NegotiationInput): string[] {
  const points: string[] = [];
  if (input.marketMedian) {
    points.push(
      `Markedsmedian for denne konfiguration: ${input.marketMedian} kr. (forespørgsel)`
    );
  }
  if (input.quickSale) {
    points.push(`Realistisk gen-salgspris (hurtigt salg): ${input.quickSale} kr.`);
  }
  if (input.daysListed >= 7) {
    points.push(`Annoncen har været aktiv i ${input.daysListed} dage - sælger er typisk mere fleksibel.`);
  }
  if (input.batteryHealth !== null && input.batteryHealth !== undefined && input.batteryHealth < 90) {
    points.push(`Batterihelse på ${input.batteryHealth}% kan bruges som forhandlingspunkt.`);
  }
  for (const acc of input.missingAccessories ?? []) {
    points.push(`Manglende tilbehør: ${acc}.`);
  }
  points.push("Kontant/MobilePay ved afhentning giver sælger sikkerhed og dig rabat.");
  return points;
}
