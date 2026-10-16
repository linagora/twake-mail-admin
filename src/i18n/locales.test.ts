import { describe, expect, it } from "vitest";
import i18n, { supportedLanguages } from "./index";

type Tree = { [key: string]: string | Tree };

const files = import.meta.glob<Tree>("./locales/*.json", { eager: true, import: "default" });

const locales: Record<string, Tree> = Object.fromEntries(
  Object.entries(files).map(([path, tree]) => [path.replace(/^.*\/(.+)\.json$/, "$1"), tree])
);

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") acc[path] = value;
    else Object.assign(acc, flatten(value, path));
    return acc;
  }, {});
}

function placeholders(value: string): string[] {
  return (value.match(/\{\{\s*[^}]+\s*\}\}/g) ?? []).sort();
}

function baseKey(key: string): string {
  return key.replace(PLURAL_SUFFIX, "");
}

function baseKeys(keys: string[]): string[] {
  return [...new Set(keys.map(baseKey))].sort();
}

function pluralKeys(keys: string[]): Map<string, string[]> {
  return keys
    .filter((key) => PLURAL_SUFFIX.test(key))
    .reduce((acc, key) => acc.set(baseKey(key), [...(acc.get(baseKey(key)) ?? []), key.replace(/^.*_/, "")]), new Map<string, string[]>());
}

// Categories Intl.PluralRules (hence i18next) selects for the integer counts the UI displays.
function integerPluralCategories(code: string): string[] {
  const rules = new Intl.PluralRules(code);
  return [...new Set(Array.from({ length: 1001 }, (_, count) => rules.select(count)))].sort();
}

const en = flatten(locales.en);
const others = Object.keys(locales).filter((code) => code !== "en");

describe("locales", () => {
  it("registers every locale file as a supported language", () => {
    expect(supportedLanguages.map((l) => l.code).sort()).toEqual(Object.keys(locales).sort());
  });

  it.each(others)("%s has exactly the English keys", (code) => {
    expect(baseKeys(Object.keys(flatten(locales[code])))).toEqual(baseKeys(Object.keys(en)));
  });

  it.each(others)("%s has no empty value", (code) => {
    const empty = Object.entries(flatten(locales[code]))
      .filter(([, value]) => value.trim() === "")
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it.each(others)("%s keeps the English interpolation variables", (code) => {
    const translated = flatten(locales[code]);
    const englishFor = (key: string) => en[key] ?? en[`${baseKey(key)}_other`];
    const mismatches = Object.keys(translated).filter(
      (key) => englishFor(key) !== undefined && placeholders(englishFor(key)).join() !== placeholders(translated[key]).join()
    );
    expect(mismatches).toEqual([]);
  });

  it.each(Object.keys(locales))("%s uses no legacy i18next v3 _plural key", (code) => {
    expect(Object.keys(flatten(locales[code])).filter((key) => key.endsWith("_plural"))).toEqual([]);
  });

  it.each(Object.keys(locales))("%s defines every plural form its language needs", (code) => {
    const expected = integerPluralCategories(code);
    const incomplete = [...pluralKeys(Object.keys(flatten(locales[code])))]
      .filter(([, categories]) => expected.some((category) => !categories.includes(category)) || !categories.includes("other"))
      .map(([key]) => key);
    expect(incomplete).toEqual([]);
  });
});

describe("plural rendering", () => {
  const rulesCount = (lng: string, count: number) =>
    i18n.getFixedT(lng)("users.bookingLinks.rulesCount", { count });

  it.each([
    ["en", 1, "1 rule"],
    ["en", 2, "2 rules"],
    ["fr", 1, "1 règle"],
    ["fr", 2, "2 règles"],
    ["de", 2, "2 Regeln"],
    ["es", 2, "2 reglas"],
    ["it", 2, "2 regole"],
    ["ru", 1, "1 правило"],
    ["ru", 3, "3 правила"],
    ["ru", 5, "5 правил"],
    ["ru", 21, "21 правило"],
    ["vi", 2, "2 quy tắc"],
    ["mn", 2, "2 дүрэм"],
  ])("%s renders %i rules as \"%s\"", (lng, count, expected) => {
    expect(rulesCount(lng, count)).toBe(expected);
  });
});
