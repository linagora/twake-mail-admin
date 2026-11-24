package com.linagora.admin.e2e.mail.domains;

import static com.linagora.admin.e2e.mail.domains.TeamMailboxesTest.SALES;
import static com.linagora.admin.e2e.mail.domains.TeamMailboxesTest.createTeamMailbox;
import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.domains.TeamMailboxFolderPage;
import com.linagora.admin.e2e.pages.mail.domains.TeamMailboxPage;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

class TeamMailboxFolderTest extends MailAdminE2ETest {

    @Test
    @DisplayName("DTM-04 Team mailbox folder: sub-addressing")
    void subaddressing(AdminApp app, MailFixtures fixtures) {
        String domain = fixtures.domain();
        WebAdmin webAdmin = fixtures.webAdmin();
        createTeamMailbox(webAdmin, domain, SALES);

        TeamMailboxPage teamMailbox = TeamMailboxPage.open(app, domain, SALES);
        teamMailbox.toggleSection("Folders");
        teamMailbox.main().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName("INBOX").setExact(true)).click();
        // Headed with the folder, under a breadcrumb back to its team mailbox
        TeamMailboxFolderPage folder = TeamMailboxFolderPage.expect(app, "INBOX");
        assertThat(folder.breadcrumb()).hasText(SALES + "@" + domain);

        Locator toggle = folder.subaddressingSwitch();
        assertThat(toggle).hasAttribute("aria-checked", "false");
        assertThat(toggle).hasAccessibleDescription("Sub-addressing delivery to this folder is disabled");
        toggle.click();
        app.expectToast("Sub-addressing enabled");
        assertThat(toggle).hasAttribute("aria-checked", "true");
        assertThat(toggle).hasAccessibleDescription("Emails to " + SALES + "+INBOX@" + domain + " are delivered to this folder");
        assertThat(subaddressing(webAdmin, domain)).isTrue();

        toggle.click();
        app.expectToast("Sub-addressing disabled");
        assertThat(toggle).hasAttribute("aria-checked", "false");
        assertThat(subaddressing(webAdmin, domain)).isFalse();

        folder.breadcrumb().click();
        TeamMailboxPage.expect(app, domain, SALES);
    }

    @Test
    @DisplayName("DTM-04 Team mailbox folder: extra ACL")
    void extraAcl(AdminApp app, MailFixtures fixtures, Page page) {
        String domain = fixtures.domain();
        WebAdmin webAdmin = fixtures.webAdmin();
        String alice = fixtures.newUser("alice");
        String emma = fixtures.newUser("emma");
        String ghost = "ghost-" + alice;
        createTeamMailbox(webAdmin, domain, SALES);

        TeamMailboxFolderPage folder = TeamMailboxFolderPage.open(app, domain, SALES, "INBOX");
        folder.toggleSection("Extra ACL");
        assertThat(folder.text("No extra ACL entries.")).isVisible();

        // Lookup + Read (the defaults), in the modal the "+" opens
        folder.button("Add ACL entry").click();
        assertThat(folder.dialog()).containsText("Add ACL entry");
        folder.usernameInput().fill(alice);
        assertThat(folder.dialog().getByText("User exists")).isVisible();
        assertThat(folder.right("l", "Lookup")).isChecked();
        assertThat(folder.right("r", "Read")).isChecked();
        assertThat(folder.dialog().getByText("Rights string:")).containsText("lr");
        folder.applyButton().click();
        app.expectToast("ACL entry set");
        assertThat(folder.dialog()).isHidden();
        assertThat(folder.row(alice)).containsText("Lookup");
        assertThat(folder.row(alice)).containsText("Read");
        assertThat(extraAcl(webAdmin, domain).path(alice).asText()).isEqualTo("lr");

        folder.rowButton(alice, "Remove ACL entry of \"" + alice + "\"").click();
        assertThat(app.dialog()).containsText("Remove all rights for \"" + alice + "\" on this folder?");
        folder.confirmWith("Remove");
        app.expectToast("ACL entry removed");
        assertThat(folder.text("No extra ACL entries.")).isVisible();
        assertThat(extraAcl(webAdmin, domain).size()).isZero();

        // Two entries, then clear them all
        for (String user : new String[] {alice, emma}) {
            folder.button("Add ACL entry").click();
            folder.usernameInput().fill(user);
            assertThat(folder.dialog().getByText("User exists")).isVisible();
            folder.applyButton().click();
            app.expectToast("ACL entry set");
            assertThat(folder.rowHeading(user)).isVisible();
        }
        assertThat(extraAcl(webAdmin, domain).size()).isEqualTo(2);
        folder.button("Clear all extra ACL entries").click();
        assertThat(app.dialog()).containsText("Remove all extra ACL entries from this folder?");
        folder.confirmWith("Clear");
        app.expectToast("All extra ACL entries removed");
        assertThat(folder.text("No extra ACL entries.")).isVisible();
        assertThat(extraAcl(webAdmin, domain).size()).isZero();

        // Keyboard only: Tab through the chips, Space toggles Write, then Cancel and Add
        folder.button("Add ACL entry").click();
        folder.usernameInput().fill(emma);
        assertThat(folder.dialog().getByText("User exists")).isVisible();
        folder.usernameInput().focus();
        page.keyboard().press("Tab");
        assertThat(folder.right("l", "Lookup")).isFocused();
        page.keyboard().press("Tab");
        assertThat(folder.right("r", "Read")).isFocused();
        page.keyboard().press("Tab");
        assertThat(folder.right("s", "Write Seen Flag")).isFocused();
        page.keyboard().press("Tab");
        Locator write = folder.right("w", "Write");
        assertThat(write).isFocused();
        assertThat(write).not().isChecked();
        page.keyboard().press("Space");
        assertThat(write).isChecked();
        assertThat(folder.dialog().getByText("Rights string:")).containsText("lrw");
        for (int i = 0; i < 7; i++) {
            page.keyboard().press("Tab");
        }
        assertThat(folder.right("a", "Administer")).isFocused();
        page.keyboard().press("Tab");
        assertThat(folder.dialogButton("Cancel")).isFocused();
        page.keyboard().press("Tab");
        assertThat(folder.applyButton()).isFocused();
        page.keyboard().press("Enter");
        app.expectToast("ACL entry set");
        assertThat(folder.dialog()).isHidden();
        assertThat(extraAcl(webAdmin, domain).path(emma).asText()).isEqualTo("lrw");

        // Invalid username: the button stays disabled
        folder.button("Add ACL entry").click();
        folder.usernameInput().fill("a@b@c");
        assertThat(folder.dialog().getByText("Invalid username")).isVisible();
        assertThat(folder.applyButton()).isDisabled();

        // Unknown user: asks first, Cancel keeps the modal and sets nothing, Confirm sets it
        folder.usernameInput().fill(ghost);
        assertThat(folder.dialog().getByText("User not found")).isVisible();
        folder.applyButton().click();
        assertThat(app.dialog()).containsText("Unknown user");
        assertThat(app.dialog()).containsText("\"" + ghost + "\" does not exist. Add it anyway?");
        folder.dialogButton("Cancel").click();
        assertThat(folder.dialog()).containsText("Add ACL entry");
        assertThat(folder.usernameInput()).hasValue(ghost);
        assertThat(extraAcl(webAdmin, domain).has(ghost)).isFalse();
        folder.applyButton().click();
        assertThat(app.dialog()).containsText("Unknown user");
        app.confirm();
        app.expectToast("ACL entry set");
        assertThat(folder.rowHeading(ghost)).isVisible();
        assertThat(extraAcl(webAdmin, domain).path(ghost).asText()).isEqualTo("lr");
    }

    // tmail-backend answers 500 "unexpected internal error" for a user of another domain (DifferentDomainException
    // not mapped by PUT .../extraAcl/{user}), where the members and extra senders routes answer a readable 400
    @Test
    @Tag("known-bug")
    @DisplayName("DTM-04 Team mailbox folder: extra ACL for a user of another domain is refused with a reason")
    void extraAclForAnotherDomainIsRefusedWithAReason(AdminApp app, MailFixtures fixtures) {
        String domain = fixtures.domain();
        String olivia = fixtures.newUser("olivia", fixtures.newDomain());
        createTeamMailbox(fixtures.webAdmin(), domain, SALES);

        TeamMailboxFolderPage folder = TeamMailboxFolderPage.open(app, domain, SALES, "INBOX");
        folder.toggleSection("Extra ACL");
        folder.button("Add ACL entry").click();
        folder.usernameInput().fill(olivia);
        assertThat(folder.dialog().getByText("User exists")).isVisible();
        folder.applyButton().click();

        // The refusal is shown in the modal, which stays open
        assertThat(app.dialogError()).isVisible();
        assertThat(app.dialogError()).not().containsText("unexpected internal error");
        assertThat(app.dialogError()).containsText(olivia);
    }

    private static boolean subaddressing(WebAdmin webAdmin, String domain) {
        return webAdmin.get("/domains/" + domain + "/team-mailboxes/" + SALES + "/mailboxes/INBOX/subaddressing")
            .expect(200).json().path("enabled").asBoolean();
    }

    private static JsonNode extraAcl(WebAdmin webAdmin, String domain) {
        return webAdmin.get("/domains/" + domain + "/team-mailboxes/" + SALES + "/mailboxes/INBOX/extraAcl").expect(200).json();
    }
}
