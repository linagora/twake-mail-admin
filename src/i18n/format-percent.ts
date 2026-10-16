import { currentLocale } from "./locale";

/**
 * A ratio (0.002 for 0.2 %) as a percentage in the UI language, with one
 * decimal: "0.2%" in English, "0,2 %" in French.
 */
export function formatPercent(ratio: number): string {
  return ratio.toLocaleString(currentLocale(), {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}
