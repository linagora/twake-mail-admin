import { afterAll, describe, expect, it } from "vitest";
import i18n from "./index";
import { formatByteSize } from "./format-size";

const NBSP = /\s/g;

function formatIn(language: string, bytes: number): string {
  i18n.changeLanguage(language);
  return formatByteSize(bytes).replace(NBSP, " ");
}

afterAll(() => {
  i18n.changeLanguage("en");
});

describe("formatByteSize", () => {
  it.each([
    [0, "0 B"],
    [561, "561 B"],
    [1126, "1.1 KB"],
    [50 * 1024 * 1024, "50.0 MB"],
    [3 * 1024 * 1024 * 1024, "3.0 GB"],
  ])("formats %d bytes in English as %s", (bytes, expected) => {
    expect(formatIn("en", bytes)).toBe(expected);
  });

  it.each([
    [0, "0 o"],
    [561, "561 o"],
    [1126, "1,1 Ko"],
    [50 * 1024 * 1024, "50,0 Mo"],
    [1536 * 1024 * 1024 * 1024, "1 536,0 Go"],
  ])("formats %d bytes in French as %s", (bytes, expected) => {
    expect(formatIn("fr", bytes)).toBe(expected);
  });
});
