// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import i18n from "./index";

describe("document language", () => {
  it("follows the language the console is shown in", async () => {
    await i18n.changeLanguage("fr");
    expect(document.documentElement.lang).toBe("fr");
    await i18n.changeLanguage("de");
    expect(document.documentElement.lang).toBe("de");
  });
});
