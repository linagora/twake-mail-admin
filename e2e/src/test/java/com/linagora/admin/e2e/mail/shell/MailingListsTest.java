package com.linagora.admin.e2e.mail.shell;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.util.regex.Pattern;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.AriaRole;

class MailingListsTest extends MailAdminE2ETest {

    @Test
    @DisplayName("ML-01 Mailing lists page without LDAP")
    void mailingListsWithoutLdap(AdminApp app) {
        app.open("/");
        app.navigate("Mailing Lists");

        assertThat(app.heading()).hasText("Mailing Lists");
        assertThat(app.main().getByText(Pattern.compile("^Browse LDAP-backed mailing lists and manage their members and owners\\."))).isVisible();
        // No LDAP here: WebAdmin answers 404, the page shows its message in a readable way
        assertThat(app.main().getByText("Error: Failed to fetch data: GET /mailingLists can not be found",
            new Locator.GetByTextOptions().setExact(true))).isVisible();
        assertThat(app.main()).not().containsText("statusCode");
        assertThat(app.main().getByText("No mailing lists found.", new Locator.GetByTextOptions().setExact(true))).isVisible();
        assertThat(app.main().getByPlaceholder("Search mailing lists...")).isEditable();

        Locator toggle = app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Create a mailing list").setExact(true));
        toggle.click();
        Locator address = app.main().getByLabel("Address", new Locator.GetByLabelOptions().setExact(true));
        Locator members = app.main().getByLabel(Pattern.compile("^Members"));
        Locator owners = app.main().getByLabel("Owners", new Locator.GetByLabelOptions().setExact(true));
        Locator category = app.main().getByLabel("Business category", new Locator.GetByLabelOptions().setExact(true));
        Locator create = app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Create").setExact(true));
        assertThat(address).isVisible();
        assertThat(members).isVisible();
        assertThat(owners).isVisible();
        assertThat(category).hasText("None");
        assertThat(app.main().getByText("At least one member is required.", new Locator.GetByTextOptions().setExact(true))).isVisible();

        address.fill("sales@lists.e2e.test");
        // Without any member the list cannot be created
        assertThat(create).isDisabled();

        // Cancel: the form collapses
        toggle.click();
        assertThat(address).isHidden();
        assertThat(app.main().getByText("No mailing lists found.", new Locator.GetByTextOptions().setExact(true))).isVisible();
    }
}
