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
    ["en", "users.deletedVault.found", {}, 0, "0 messages found"],
    ["en", "users.deletedVault.found", {}, 1, "1 message found"],
    ["fr", "users.deletedVault.found", {}, 0, "0 message trouvé"],
    ["fr", "users.deletedVault.found", {}, 2, "2 messages trouvés"],
    ["en", "users.deletedVault.restoreConfirm", { label: "alice" }, 1, "Restore 1 message for alice? This will enqueue a background task."],
    ["ru", "users.deletedVault.restoreConfirm", { label: "alice" }, 5, "Восстановить 5 сообщений для alice? Это поставит в очередь фоновую задачу."],
    ["en", "common.pageOf", { page: 1 }, 1, "Page 1 — 1 result"],
    ["en", "common.pageOf", { page: 2 }, 20, "Page 2 — 20 results"],
    ["de", "exploreQuota.page", { page: 1 }, 3, "Seite 1 — 3 Ergebnisse"],
    ["en", "commonTasks.cleanupOldTasksConfirm", {}, 1, "Delete all tasks older than 1 day?"],
    ["en", "commonTasks.cleanupOldTasksConfirm", {}, 30, "Delete all tasks older than 30 days?"],
    ["en", "mailRepositories.filtersActive", {}, 1, "1 filter active"],
    ["it", "tasks.filtersActive", {}, 2, "Filtri (2 attivi)"],
    ["en", "mappings.removedPage", {}, 1, "1 mapping removed successfully"],
    ["en", "mappings.errorRemovingPage", { removed: 2 }, 3, "3 mappings could not be removed (2 removed)"],
    ["en", "networkChannels.geolocatingIPs", {}, 1, "Geolocating 1 IP…"],
    ["ru", "networkChannels.totalConnections", {}, 2, "Всего: 2 соединения"],
  ])("%s pluralises %s with %o for %i", (lng, key, options, count, expected) => {
    expect(i18n.getFixedT(lng)(key, { ...options, count })).toBe(expected);
  });

  it.each(["en", "fr", "de", "es", "it", "ru", "mn", "vi"])("%s words counts without the \"(s)\" placeholder plural", (lng) => {
    const t = i18n.getFixedT(lng);
    const rendered = [1, 2, 5].flatMap((count) => [
      t("users.deletedVault.found", { count }),
      t("users.deletedVault.restoreConfirm", { count, label: "alice" }),
      t("common.pageOf", { page: 1, count }),
      t("commonTasks.cleanupOldTasksConfirm", { count }),
      t("mailRepositories.filtersActive", { count }),
      t("tasks.filtersActive", { count }),
      t("mappings.removedPage", { count }),
      t("mappings.errorRemovingPage", { count, removed: 1 }),
      t("networkChannels.geolocatingIPs", { count }),
      t("networkChannels.totalConnections", { count }),
    ]);
    expect(rendered.filter((text) => /\(\S{1,3}\)|\/i\b|\/e\b/.test(text))).toEqual([]);
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
