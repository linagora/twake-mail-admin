package com.linagora.admin.e2e.mail.shell;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.util.regex.Pattern;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.Ids;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.shell.Shell;
import com.linagora.admin.e2e.pages.mail.shell.WebAdminStub;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

class JmapSettingsReportTest extends MailAdminE2ETest {
    private static final String EMPTY = "No data — no users have JMAP settings configured.";

    private static Locator keyTable(AdminApp app, String key) {
        return app.main().locator("div").filter(new Locator.FilterOptions()
            .setHas(app.page().getByRole(AriaRole.HEADING, new Page.GetByRoleOptions().setName(key).setExact(true)))).last();
    }

    @Test
    @DisplayName("JMAP-01 Global JMAP settings report: empty")
    void emptyReport(AdminApp app, Page page) {
        // The report is global and other tests save settings: a fresh stack is simulated
        WebAdminStub.answer(page, path -> path.equals("/jmap/settings/reports"), "{}");

        app.open("/");
        app.navigate("JMAP Settings Report");
        assertThat(app.heading()).hasText("JMAP Settings Report");
        assertThat(app.main().getByText(Pattern.compile("^Aggregated view of JMAP settings adoption across users\\. \\(doc\\)$"))).isVisible();
        assertThat(Shell.docLink(app)).hasAttribute("href", Pattern.compile("tmail-backend.*webadmin\\.adoc#jmap-settings-reports$"));
        assertThat(app.main().getByText(EMPTY, new Locator.GetByTextOptions().setExact(true))).isVisible();
    }

    @Test
    @DisplayName("JMAP-01 Global JMAP settings report: counts of saved settings")
    void reportCountsSavedSettings(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin) {
        // Keys of this test only: the report aggregates every user of the server
        String key = Ids.unique("e2e.key");
        String other = Ids.unique("e2e.other");
        String alice = fixtures.newUser("alice");
        String bob = fixtures.newUser("bob");
        webAdmin.put("/users/" + alice + "/jmap/settings", "{\"" + key + "\":\"fr\",\"" + other + "\":\"on\"}").expect(204);
        webAdmin.put("/users/" + bob + "/jmap/settings", "{\"" + key + "\":\"fr\"}").expect(204);
        String carol = fixtures.newUser("carol");
        webAdmin.put("/users/" + carol + "/jmap/settings", "{\"" + key + "\":\"en\"}").expect(204);

        app.open("/jmap-settings-report");
        Locator table = keyTable(app, key);
        assertThat(table.getByRole(AriaRole.COLUMNHEADER)).hasText(new String[] {"Value", "Users"});
        // Sorted by count, descending
        assertThat(table.getByRole(AriaRole.ROW)).hasText(new String[] {"ValueUsers", "fr2", "en1"});
        assertThat(keyTable(app, other).getByRole(AriaRole.ROW)).hasText(new String[] {"ValueUsers", "on1"});
        assertThat(app.main().getByText(EMPTY)).hasCount(0);
    }
}
