export interface QuotaUsageSum {
  count: number;
  size: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

// The backend answer is only trusted when it carries numeric count and size:
// another payload (e.g. the domain quota limits, which James also serves on
// GET /quota/domains/{domain}) must not be rendered as a usage sum.
export function parseQuotaUsageSum(value: unknown): QuotaUsageSum | null {
  if (typeof value !== "object" || value === null) return null;
  const { count, size } = value as Record<string, unknown>;
  return isFiniteNumber(count) && isFiniteNumber(size) ? { count, size } : null;
}
