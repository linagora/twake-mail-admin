import { afterAll, describe, expect, it } from "vitest";
import i18n from "./index";
import { formatPercent } from "./format-percent";

const NBSP = /\s/g;

function formatIn(language: string, ratio: number): string {
  i18n.changeLanguage(language);
  return formatPercent(ratio).replace(NBSP, " ");
}

afterAll(() => {
  i18n.changeLanguage("en");
});

describe("formatPercent", () => {
  it.each([
    [0, "0.0%"],
    [0.002, "0.2%"],
    [0.5, "50.0%"],
    [12.345, "1,234.5%"],
  ])("formats %d in English as %s", (ratio, expected) => {
    expect(formatIn("en", ratio)).toBe(expected);
  });

  it.each([
    [0, "0,0 %"],
    [0.002, "0,2 %"],
    [0.5, "50,0 %"],
    [12.345, "1 234,5 %"],
  ])("formats %d in French as %s", (ratio, expected) => {
    expect(formatIn("fr", ratio)).toBe(expected);
  });
});
