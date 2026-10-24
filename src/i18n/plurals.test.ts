import { afterEach, describe, expect, it } from "vitest";
import i18n from "./index";

afterEach(() => i18n.changeLanguage("en"));

describe("plural forms", () => {
  it("names one user or one domain alias in the singular", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("domains.delete.users", { count: 1, examples: "u1@qa.test" })).toBe("1 user (e.g. u1@qa.test)");
    expect(i18n.t("domains.delete.users", { count: 2, examples: "u1@qa.test" })).toBe("2 users (e.g. u1@qa.test)");
    expect(i18n.t("domains.delete.stillAliases", { domain: "qa.test", aliases: i18n.t("domains.delete.aliases", { count: 1 }) }))
      .toBe("qa.test still has 1 domain alias.");
    expect(i18n.t("domains.delete.aliasesConsequence", { count: 1 })).toBe("Mail to this domain alias will no longer be delivered.");
    expect(i18n.t("domains.delete.aliasesConsequence", { count: 3 })).toBe("Mail to these domain aliases will no longer be delivered.");
  });

  it("falls back to the plain key in the locales without plural variants", async () => {
    await i18n.changeLanguage("ru");
    expect(i18n.t("domains.delete.aliasesConsequence", { count: 1 })).toBe("Почта на эти псевдонимы домена больше не будет доставляться.");
    expect(i18n.t("domains.delete.aliases", { count: 2 })).toBe("псевдонимов домена: 2");
  });
});
