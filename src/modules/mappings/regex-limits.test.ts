import { describe, expect, it } from "vitest";
import i18n, { supportedLanguages } from "@/i18n";
import { exceededRegexLimits, MAX_REGEX_LENGTH } from "./regex-limits";

describe("exceededRegexLimits", () => {
  it("accepts a mapping within the limits", () => {
    expect(exceededRegexLimits("qa.*@a.org:bob@b.org")).toEqual([]);
  });

  it.each([
    ["a replacement parameter", "(.*)@a.org:${1}@b.org"],
    ["a counted repetition", "a{2,3}@a.org:bob@b.org"],
    ["a lone closing brace, in the replacement", "qa@a.org:bob}@b.org"],
  ])("flags the braces of %s", (_, mapping) => {
    expect(exceededRegexLimits(mapping)).toEqual(["braces"]);
  });

  it("allows a regex of exactly the maximal length", () => {
    expect(exceededRegexLimits(`${"a".repeat(MAX_REGEX_LENGTH)}:bob@b.org`)).toEqual([]);
  });

  it("flags a regex over the maximal length", () => {
    expect(exceededRegexLimits(`${"a".repeat(MAX_REGEX_LENGTH + 1)}:bob@b.org`)).toEqual(["length"]);
  });

  it("does not count the replacement in the length", () => {
    expect(exceededRegexLimits(`qa@a.org:${"a".repeat(MAX_REGEX_LENGTH + 1)}`)).toEqual([]);
  });

  it.each([
    ["a tab", "\t"],
    ["a null character", "\u0000"],
    ["a delete", "\u007f"],
    ["a C1 control", "\u0085"],
  ])("flags %s, in the regex or in the replacement", (_, character) => {
    expect(exceededRegexLimits(`q${character}a@a.org:bob@b.org`)).toEqual(["controlCharacters"]);
    expect(exceededRegexLimits(`qa@a.org:b${character}ob@b.org`)).toEqual(["controlCharacters"]);
  });

  it("does not take a non-ASCII letter for a control character", () => {
    expect(exceededRegexLimits("élodie@a.org:bob@b.org")).toEqual([]);
  });

  it("reports every limit exceeded", () => {
    expect(exceededRegexLimits(`${"a".repeat(MAX_REGEX_LENGTH + 1)}\t:\${1}@b.org`)).toEqual(["braces", "length", "controlCharacters"]);
  });
});

describe("the regex mapping hint", () => {
  it.each(supportedLanguages.map((language) => language.code))("%s names RE2 and renders its limits literally", (code) => {
    const hint = i18n.getFixedT(code)("mappings.typeHint.regex", { max: MAX_REGEX_LENGTH });
    expect(hint).toContain("RE2");
    expect(hint).toContain("${1}");
    expect(hint).toContain(String(MAX_REGEX_LENGTH));
  });
});
