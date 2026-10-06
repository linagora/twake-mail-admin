import i18n from "i18next";

/**
 * The language chosen in the UI, to pass to toLocaleString and friends so
 * dates and numbers follow it rather than the browser locale.
 */
export function currentLocale(): string | undefined {
  return i18n.resolvedLanguage || i18n.language || undefined;
}
