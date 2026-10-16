import i18n from "i18next";
import { currentLocale } from "./locale";

const UNIT_KEYS = ["common.bytes", "common.kb", "common.mb", "common.gb"] as const;

function unitExponent(bytes: number): number {
  return [3, 2, 1].find((exponent) => bytes >= 1024 ** exponent) ?? 0;
}

/**
 * A byte count in the UI language: localized number ("50,0" in French) and
 * translated unit ("Mo"). Bytes stay integers, larger units keep one decimal.
 */
export function formatByteSize(bytes: number): string {
  const exponent = unitExponent(bytes);
  const fractionDigits = exponent === 0 ? 0 : 1;
  const value = (bytes / 1024 ** exponent).toLocaleString(currentLocale(), {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return `${value} ${i18n.t(UNIT_KEYS[exponent])}`;
}
