package com.linagora.admin.e2e.mail.shell;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.regex.Pattern;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.shell.Shell;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

class LanguageTest extends MailAdminE2ETest {
    /** French groups digits with a (narrow) no-break space. */
    private static final String NBSP = "[\\u00a0\\u202f ]";

    private static Locator languageSelector(AdminApp app) {
        return app.sidebar().getByRole(AriaRole.COMBOBOX);
    }

    private static void chooseLanguage(AdminApp app, String language) {
        languageSelector(app).click();
        app.page().getByRole(AriaRole.OPTION, new Page.GetByRoleOptions().setName(language).setExact(true)).click();
        assertThat(languageSelector(app)).hasText(language);
    }

    private static void assertNoRawKey(AdminApp app) {
        assertThat(Shell.rawI18nKeys(app.page().locator("body").innerText())).isEmpty();
    }

    private static Locator section(AdminApp app, String title) {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(Pattern.compile("^" + Shell.quote(title) + "( \\(\\d+\\))?$")));
    }

    @Test
    @DisplayName("NAV-02 Language selector")
    void languageSelector(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin, Page page) {
        // A user with a quota of 50 MB / 1000 messages and one mail
        MailSeeds.UserWithMail seed = MailSeeds.userWithMail(fixtures, "lang");
        String user = seed.user();
        webAdmin.put("/quota/users/" + user + "/size", String.valueOf(50L * 1024 * 1024)).expect(204);
        webAdmin.put("/quota/users/" + user + "/count", "1000").expect(204);

        app.open("/users");
        assertThat(languageSelector(app)).hasText("English");
        languageSelector(app).click();
        assertThat(page.getByRole(AriaRole.OPTION)).hasText(new String[] {
            "English", "Français", "Русский", "Tiếng Việt",
            "Монгол", "Español", "Deutsch", "Italiano"});
        page.getByRole(AriaRole.OPTION, new Page.GetByRoleOptions().setName("Français")).click();

        assertThat(Shell.sidebarLink(app, "Utilisateurs")).isVisible();
        assertThat(Shell.sidebarLink(app, "Domaines")).isVisible();
        assertNoRawKey(app);
        app.navigate("Domaines");
        assertThat(app.heading()).hasText("Domaines");
        assertNoRawKey(app);
        app.navigate("Utilisateurs");
        assertNoRawKey(app);

        // The choice survives a reload
        page.reload();
        assertThat(Shell.sidebarLink(app, "Utilisateurs")).isVisible();
        assertThat(languageSelector(app)).hasText("Français");

        // Formats of the user page in French
        app.open("/users/user/" + WebAdmin.encode(user));
        section(app, "Quota").click();
        assertThat(app.main()).containsText("50,0 Mo");
        assertThat(app.main()).containsText(Pattern.compile("1" + NBSP + "000"));
        assertThat(app.main()).containsText(Pattern.compile("Nombre :" + NBSP + "*0,1" + NBSP + "%"));
        assertThat(app.main()).containsText("Taille :");
        assertThat(app.main()).not().containsText("50.0 MB");
        section(app, "Boîtes aux lettres").click();
        String today = LocalDate.now(ZoneId.of("Europe/Paris")).format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
        assertThat(app.main()).containsText(Pattern.compile("Date de création :" + NBSP + "*\\d{2}/\\d{2}/\\d{4} \\d{2}:\\d{2}:\\d{2}"));
        assertThat(app.main()).containsText(today);
        assertThat(app.main()).not().containsText("GMT");
        section(app, "Correspondances").click();
        assertThat(app.main().getByText("Aucune correspondance trouvée.").first()).isVisible();
        assertThat(app.main().getByText("No mappings found.")).hasCount(0);
        assertNoRawKey(app);

        // Task status pills
        app.navigate("Tâches");
        assertThat(app.main().getByText("Terminée", new Locator.GetByTextOptions().setExact(true))
            .filter(new Locator.FilterOptions().setVisible(true)).first()).isVisible();
        assertNoRawKey(app);

        // The load error of Mailing Lists, then back to English without reloading
        app.navigate("Listes de diffusion");
        Locator frenchError = app.main().getByText("Erreur : Échec du chargement des données : GET /mailingLists can not be found",
            new Locator.GetByTextOptions().setExact(true));
        assertThat(frenchError).isVisible();
        chooseLanguage(app, "English");
        assertThat(app.main().getByText("Error: Failed to fetch data: GET /mailingLists can not be found",
            new Locator.GetByTextOptions().setExact(true))).isVisible();
        assertThat(frenchError).hasCount(0);
        assertThat(Shell.sidebarLink(app, "Users")).isVisible();
        assertThat(app.heading()).hasText("Mailing Lists");
    }
}
