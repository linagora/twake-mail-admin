import { describe, expect, it } from "vitest";
import { supportedLanguages } from "./index";

type Tree = { [key: string]: string | Tree };

const files = import.meta.glob<Tree>("./locales/*.json", { eager: true, import: "default" });

const locales: Record<string, Tree> = Object.fromEntries(
  Object.entries(files).map(([path, tree]) => [path.replace(/^.*\/(.+)\.json$/, "$1"), tree])
);

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

const en = flatten(locales.en);
const others = Object.keys(locales).filter((code) => code !== "en");

describe("locales", () => {
  it("registers every locale file as a supported language", () => {
    expect(supportedLanguages.map((l) => l.code).sort()).toEqual(Object.keys(locales).sort());
  });

  it.each(others)("%s has exactly the English keys", (code) => {
    expect(Object.keys(flatten(locales[code])).sort()).toEqual(Object.keys(en).sort());
  });

  it.each(others)("%s has no empty value", (code) => {
    const empty = Object.entries(flatten(locales[code]))
      .filter(([, value]) => value.trim() === "")
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it.each(others)("%s keeps the English interpolation variables", (code) => {
    const translated = flatten(locales[code]);
    const mismatches = Object.keys(en).filter(
      (key) => key in translated && placeholders(en[key]).join() !== placeholders(translated[key]).join()
    );
    expect(mismatches).toEqual([]);
  });
});
