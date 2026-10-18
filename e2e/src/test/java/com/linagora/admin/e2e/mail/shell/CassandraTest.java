package com.linagora.admin.e2e.mail.shell;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;

class CassandraTest extends MailAdminE2ETest {

    private static Locator row(AdminApp app, String label) {
        return app.main().locator("div").filter(new Locator.FilterOptions()
            .setHas(app.page().getByText(label, new com.microsoft.playwright.Page.GetByTextOptions().setExact(true)))).last();
    }

    @Test
    @DisplayName("CAS-01 Schema versions")
    void schemaVersions(AdminApp app, WebAdmin webAdmin) {
        int current = webAdmin.get("/cassandra/version").expect(200).json().path("version").asInt();
        int latest = webAdmin.get("/cassandra/version/latest").expect(200).json().path("version").asInt();

        app.open("/");
        app.navigate("Cassandra");

        assertThat(app.heading()).hasText("Cassandra");
        assertThat(row(app, "Current schema version")).hasText("Current schema version" + current);
        assertThat(row(app, "Latest available version")).hasText("Latest available version" + latest);
        if (current >= latest) {
            assertThat(app.button("Already at latest version")).isDisabled();
            assertThat(app.main().getByText("Upgrade to version")).hasCount(0);
        } else {
            assertThat(app.button("Upgrade to version " + latest)).isEnabled();
        }
    }
}
