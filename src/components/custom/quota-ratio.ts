import { formatPercent } from "@/i18n/format-percent";

/** A computed limit: a value, -1 or null for unlimited, undefined when not known. */
export type ComputedLimit = number | null | undefined;

export interface QuotaRatios {
  count: number | null;
  size: number | null;
  max: number | null;
}

interface RawOccupation {
  count: number;
  size: number;
  ratio?: { count?: unknown; size?: unknown; max?: unknown } | null;
}

export interface ComputedLimits {
  count: ComputedLimit;
  size: ComputedLimit;
}

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const isUnlimited = (limit: ComputedLimit) => limit === null || (limit !== undefined && limit < 0);

/**
 * used / limit, as James computes it since a zero limit no longer yields NaN:
 * a zero limit gives 0 when nothing is used and 1 otherwise, an unlimited
 * quota gives 0. The backend ratio is trusted only when finite: older backends
 * answer NaN or Infinity for a zero limit. Null when it cannot be worked out.
 */
export function occupationRatio(ratio: unknown, used: number, limit: ComputedLimit): number | null {
  if (limit === 0) return used > 0 ? 1 : 0;
  if (isFiniteNumber(ratio)) return ratio;
  if (isUnlimited(limit)) return 0;
  return isFiniteNumber(limit) ? used / limit : null;
}

const maxOf = (count: number | null, size: number | null, backendMax: unknown) =>
  count !== null && size !== null ? Math.max(count, size) : isFiniteNumber(backendMax) ? backendMax : null;

/** The count, size and max ratios of an occupation, safe to display. */
export function occupationRatios(occupation: RawOccupation, limits: ComputedLimits | null | undefined): QuotaRatios {
  const ratio = occupation.ratio ?? {};
  const count = occupationRatio(ratio.count, occupation.count, limits?.count);
  const size = occupationRatio(ratio.size, occupation.size, limits?.size);
  return { count, size, max: maxOf(count, size, ratio.max) };
}

/** Whether the count or the size limit is 0: nothing can be stored. */
export const hasZeroLimit = (limits: ComputedLimits | null | undefined) => limits?.count === 0 || limits?.size === 0;

/** A localized percentage, "—" when the ratio cannot be worked out. */
export const formatRatio = (ratio: number | null) => (ratio === null ? "—" : formatPercent(ratio));

/** The width of a progress bar, capped at 100%. */
export const barWidth = (ratio: number | null) => `${Math.min((ratio ?? 0) * 100, 100)}%`;
