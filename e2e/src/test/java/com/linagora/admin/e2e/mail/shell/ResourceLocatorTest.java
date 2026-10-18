package com.linagora.admin.e2e.mail.shell;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.util.regex.Pattern;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.docker.MailStack;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.shell.ResourceLocatorPage;
import com.microsoft.playwright.Locator;

class ResourceLocatorTest extends MailAdminE2ETest {
    /**
     * A time based (v1) UUID nobody uses: this Cassandra backend reports a random v4 UUID as
     * "syntactically invalid", a v1 one as not found.
     */
    private static final String UNKNOWN_ID = "a1b2c3d4-c464-11f1-ad63-c75c21872971";

    @Test
    @DisplayName("RL-01 Look up a mailbox by ID")
    void lookUpMailbox(AdminApp app, MailFixtures fixtures) {
        String user = fixtures.newUser("rl");
        fixtures.webAdmin().put("/users/" + user + "/mailboxes/INBOX").expect(204);
        String inboxId = MailSeeds.inboxId(fixtures.webAdmin(), user);

        // Step 1: the id is shown under INBOX on the user page
        app.open("/users/user/" + WebAdmin.encode(user));
        app.main().getByRole(com.microsoft.playwright.options.AriaRole.BUTTON,
            new Locator.GetByRoleOptions().setName(Pattern.compile("^Mailboxes"))).click();
        assertThat(app.main().getByText(inboxId)).isVisible();

        app.navigate("Resource Locator");
        ResourceLocatorPage locator = new ResourceLocatorPage(app);
        String form = ResourceLocatorPage.MAILBOX;
        assertThat(locator.lookUp(form)).isDisabled();
        locator.field(form).fill("   ");
        assertThat(locator.lookUp(form)).isDisabled();

        // Surrounding spaces are trimmed
        locator.search(form, " " + inboxId + " ");
        assertThat(locator.form(form)).containsText("Mailbox ID: " + inboxId);
        assertThat(locator.form(form)).containsText("Mailbox path: #private:" + user + ":INBOX");

        locator.search(form, UNKNOWN_ID);
        assertThat(locator.form(form).getByText(ResourceLocatorPage.NOT_FOUND)).isVisible();
        assertThat(locator.form(form)).not().containsText("Mailbox path:");

        locator.field(form).fill("not-an-id");
        locator.field(form).press("Enter");
        assertThat(locator.form(form).getByText(ResourceLocatorPage.INVALID)).isVisible();
    }

    @Test
    @DisplayName("RL-02 Locate a message by ID")
    void locateMessage(AdminApp app, MailFixtures fixtures, MailStack stack) {
        MailSeeds.UserWithMail seed = MailSeeds.userWithMail(fixtures, "rl");
        String messageId = MailSeeds.firstMessageId(stack, seed.user());

        ResourceLocatorPage locator = ResourceLocatorPage.open(app);
        String form = ResourceLocatorPage.MESSAGE;
        assertThat(locator.lookUp(form)).isDisabled();

        locator.search(form, messageId);
        assertThat(locator.form(form)).containsText("Found in 1 mailbox(es):");
        assertThat(locator.form(form)).containsText("Mailbox ID: " + seed.inboxId());
        assertThat(locator.form(form)).containsText("Mailbox path: #private:" + seed.user() + ":INBOX");

        locator.search(form, UNKNOWN_ID);
        assertThat(locator.form(form).getByText(ResourceLocatorPage.NOT_FOUND)).isVisible();

        locator.search(form, "not an id");
        assertThat(locator.form(form).getByText(ResourceLocatorPage.INVALID)).isVisible();
    }
}
