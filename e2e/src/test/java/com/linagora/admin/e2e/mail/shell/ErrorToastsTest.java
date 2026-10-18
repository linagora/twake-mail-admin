package com.linagora.admin.e2e.mail.shell;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.regex.Pattern;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.AriaRole;

class ErrorToastsTest extends MailAdminE2ETest {

    /** The toast titled {@code title} shows the WebAdmin message and details, as plain readable text. */
    private static void assertReadableErrorToast(AdminApp app, String title, String message, String details) {
        Locator toast = app.toast(title);
        assertThat(toast).isVisible();
        assertThat(toast).containsText(message);
        assertThat(toast).containsText(details);
        String text = toast.innerText();
        assertThat(text).doesNotContain("{", "\"statusCode\"", "stack", "config", "headers", "AxiosError", "[object Object]", ",,");
        assertThat(text.replace(title, "").trim()).doesNotStartWith(",");
    }

    @Test
    @DisplayName("NAV-07 Error toasts show the WebAdmin message")
    void errorToastsShowWebAdminMessage(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin) {
        String user = fixtures.newUser("toast");

        // 1. Domains: an invalid domain name
        app.open("/domains");
        app.main().getByPlaceholder("New domain name").fill("not a domain!");
        app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Create").setExact(true)).click();
        app.confirm();
        assertReadableErrorToast(app, "Error creating domain", "Invalid request for domain creation not a domain!",
            "Domain parts ASCII chars must be a-z A-Z 0-9 - or _ in not a domain!");

        // 2. User aliases: not an address
        app.open("/users/user/" + WebAdmin.encode(user));
        app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(Pattern.compile("^Aliases"))).click();
        app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Add alias").setExact(true)).click();
        app.main().getByPlaceholder("alias@domain.com").fill("not-an-address");
        app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Add").setExact(true)).click();
        assertReadableErrorToast(app, "Error adding alias", "The alias is not an email address", "Out of data at position 1 in 'not-an-address'");

        // 3. Mappings: an invalid source address
        app.navigate("Mappings");
        app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Add Address Mapping").setExact(true)).click();
        app.main().getByPlaceholder("Source (e.g. user@domain.com)").fill("bad source");
        app.main().getByPlaceholder("Destination (e.g. alias@domain.com)").fill(user);
        app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Create").setExact(true)).click();
        assertReadableErrorToast(app, "Error creating address mapping", "The address is not an email address",
            "Invalid character in local-part (user account) at position 4 in 'bad source'");

        assertThat(webAdmin.get("/address/aliases/" + user).json()).isEmpty();
    }
}
