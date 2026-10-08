const dkk = new Intl.NumberFormat("da-DK", {
  style: "currency",
  currency: "DKK",
  maximumFractionDigits: 0,
});

export function formatDkk(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return dkk.format(Math.round(value));
}

export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: digits }).format(value);
}

export function formatPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatAge(postedAt: number | null | undefined, now = Date.now()): string {
  if (!postedAt) return "ukendt alder";
  const diff = Math.max(0, now - postedAt);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "lige nu";
  if (min < 60) return `${min} min siden`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} t siden`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} dag${d === 1 ? "" : "e"} siden`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} md. siden`;
  return `${Math.floor(mo / 12)} år siden`;
}

export function ageMinutes(postedAt: number | null | undefined, now = Date.now()): number {
  if (!postedAt) return 60 * 24 * 365;
  return Math.max(0, (now - postedAt) / 60000);
}

export function isJustListed(postedAt: number | null | undefined, now = Date.now(), windowMin = 45): boolean {
  if (!postedAt) return false;
  return now - postedAt < windowMin * 60000;
}

export function formatDateTime(value: number | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatDate(value: number | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("da-DK", { dateStyle: "medium" }).format(new Date(value));
}

export function relativeDay(value: number): string {
  const days = Math.floor((Date.now() - value) / 86400000);
  if (days <= 0) return "i dag";
  if (days === 1) return "i går";
  if (days < 30) return `for ${days} dage siden`;
  return formatDate(value);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
