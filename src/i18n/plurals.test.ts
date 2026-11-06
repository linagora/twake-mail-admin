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

  it("counts the pending changes of a staged dialog", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("common.pendingChanges", { count: 1 })).toBe("1 pending change: click Apply to save.");
    expect(i18n.t("common.pendingChanges", { count: 2 })).toBe("2 pending changes: click Apply to save.");
    await i18n.changeLanguage("fr");
    expect(i18n.t("common.pendingChanges", { count: 2 })).toBe("2 modifications en attente : cliquez sur Appliquer pour enregistrer.");
    await i18n.changeLanguage("ru");
    expect(i18n.t("common.pendingChanges", { count: 2 })).toBe("2 изменения ожидают сохранения: нажмите «Применить».");
    expect(i18n.t("common.pendingChanges", { count: 5 })).toBe("5 изменений ожидают сохранения: нажмите «Применить».");
  });

  it("counts the changes a discarded staged dialog drops", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("common.discardMessage", { count: 1 })).toBe("1 change will not be saved.");
    expect(i18n.t("common.discardMessage", { count: 2 })).toBe("2 changes will not be saved.");
    await i18n.changeLanguage("fr");
    expect(i18n.t("common.discardMessage", { count: 1 })).toBe("1 modification ne sera pas enregistrée.");
    expect(i18n.t("common.discardMessage", { count: 2 })).toBe("2 modifications ne seront pas enregistrées.");
    await i18n.changeLanguage("ru");
    expect(i18n.t("common.discardMessage", { count: 1 })).toBe("1 изменение не будет сохранено.");
    expect(i18n.t("common.discardMessage", { count: 5 })).toBe("5 изменений не будут сохранены.");
  });

  it.each([
    ["fr", 0, "1 en échec, 0 dégradé sur 4 composants."],
    ["fr", 1, "1 en échec, 1 dégradé sur 4 composants."],
    ["fr", 2, "1 en échec, 2 dégradés sur 4 composants."],
    ["es", 1, "1 con fallos, 1 degradado de 4 componentes."],
    ["es", 2, "1 con fallos, 2 degradados de 4 componentes."],
    ["it", 1, "1 in errore, 1 degradato su 4 componenti."],
    ["it", 2, "1 in errore, 2 degradati su 4 componenti."],
    ["en", 2, "1 unhealthy, 2 degraded out of 4 components."],
    ["de", 2, "1 fehlerhaft, 2 beeinträchtigt von 4 Komponenten."],
    ["ru", 2, "Неисправно: 1, с деградацией: 2 из 4 компонентов."],
    ["vi", 2, "1 lỗi, 2 suy giảm trên 4 thành phần."],
    ["mn", 2, "4 бүрэлдэхүүнээс 1 алдаатай, 2 доголдолтой."],
  ])("%s words the health check banner for %i degraded components", (lng, degraded, expected) => {
    const t = i18n.getFixedT(lng);
    expect(t("healthCheck.summary.problems", {
      unhealthy: 1,
      degraded: t("healthCheck.summary.degraded", { count: degraded }),
      count: 4,
    })).toBe(expected);
  });
});
