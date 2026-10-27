package com.linagora.admin.e2e.mail.domains;

import static com.linagora.admin.e2e.mail.domains.TeamMailboxesTest.SALES;
import static com.linagora.admin.e2e.mail.domains.TeamMailboxesTest.createTeamMailbox;
import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.domains.TeamMailboxPage;

class TeamMailboxSettingsTest extends MailAdminE2ETest {

    @Test
    @DisplayName("DTM-05 Team mailbox quota")
    void teamMailboxQuota(AdminApp app, MailFixtures fixtures) {
        String domain = fixtures.domain();
        WebAdmin webAdmin = fixtures.webAdmin();
        createTeamMailbox(webAdmin, domain, SALES);

        TeamMailboxPage teamMailbox = TeamMailboxPage.open(app, domain, SALES);
        teamMailbox.toggleSection("Quota");
        assertThat(teamMailbox.quotaRow("Applied limit")).isVisible();
        // WebAdmin answers "teamMailbox": null while nothing is set: the row is then left out
        assertThat(sizeIsSet(teamMailbox)).hasCount(0);
        assertThat(teamMailbox.button("Remove specific limits")).hasCount(0);

        // "Edit limits": count and size in one modal
        teamMailbox.editLimitsButton().click();
        assertThat(teamMailbox.dialog()).containsText("Quota limits of " + SALES + "@" + domain);
        teamMailbox.limitInput("Size").fill("100");
        teamMailbox.sizeUnitSelect().selectOption("MB");
        teamMailbox.dialogButton("Save").click();
        app.expectToast("Quota limits updated");
        assertThat(teamMailbox.dialog()).isHidden();
        assertThat(teamMailbox.quotaRow("Team Mailbox")).containsText("Size: 100.0 MB");
        assertThat(quota(webAdmin, domain).path("teamMailbox").path("size").asLong()).isEqualTo(100L * 1024 * 1024);

        teamMailbox.button("Remove specific limits").click();
        assertThat(app.dialog()).containsText("Remove the message count and size limits set for \"" + SALES + "@" + domain
            + "\"? The limits of the domain, or the global ones, will apply again.");
        app.confirm();
        app.expectToast("Specific limits removed");
        assertThat(sizeIsSet(teamMailbox)).hasCount(0);
        JsonNode reset = quota(webAdmin, domain).path("teamMailbox");
        assertThat(reset.isNull() || reset.path("size").isNull()).isTrue();
    }

    @Test
    @DisplayName("DTM-06 Team mailbox extra senders")
    void teamMailboxExtraSenders(AdminApp app, MailFixtures fixtures) {
        String domain = fixtures.domain();
        WebAdmin webAdmin = fixtures.webAdmin();
        String david = fixtures.newUser("david");
        String ghost = "ghost-" + david;
        createTeamMailbox(webAdmin, domain, SALES);

        // Extra Senders is open by default, as Members
        TeamMailboxPage teamMailbox = TeamMailboxPage.open(app, domain, SALES);
        assertThat(teamMailbox.text("No extra senders.")).isVisible();

        // The "+" opens a modal
        teamMailbox.addExtraSenderButton().click();
        assertThat(teamMailbox.dialog()).containsText("Add extra sender");
        teamMailbox.usernameInput().fill(david);
        assertThat(teamMailbox.dialog().getByText("User exists")).isVisible();
        teamMailbox.addButton().click();
        app.expectToast("Extra sender added");
        assertThat(teamMailbox.dialog()).isHidden();
        assertThat(teamMailbox.rowHeading(david)).isVisible();
        assertThat(teamMailbox.sectionButton("Extra Senders", 1)).isVisible();
        assertThat(extraSenders(webAdmin, domain)).containsExactly(david);

        teamMailbox.rowButton(david, "Remove extra sender").click();
        assertThat(app.dialog()).containsText("Revoke send-as right for \"" + david + "\"?");
        teamMailbox.confirmWith("Remove");
        app.expectToast("Extra sender removed");
        assertThat(teamMailbox.text("No extra senders.")).isVisible();
        assertThat(extraSenders(webAdmin, domain)).isEmpty();

        // Invalid mail address
        teamMailbox.addExtraSenderButton().click();
        teamMailbox.usernameInput().fill("a@b@c");
        assertThat(teamMailbox.dialog().getByText("Invalid mail address")).isVisible();
        assertThat(teamMailbox.addButton()).isDisabled();

        // Unknown user: asks first, Cancel keeps the modal and adds nothing, Confirm adds it
        teamMailbox.usernameInput().fill(ghost);
        assertThat(teamMailbox.dialog().getByText("User not found")).isVisible();
        teamMailbox.addButton().click();
        assertThat(app.dialog()).containsText("Unknown user");
        assertThat(app.dialog()).containsText("\"" + ghost + "\" does not exist. Add it anyway?");
        teamMailbox.dialogButton("Cancel").click();
        assertThat(teamMailbox.dialog()).containsText("Add extra sender");
        assertThat(extraSenders(webAdmin, domain)).isEmpty();
        teamMailbox.addButton().click();
        assertThat(app.dialog()).containsText("Unknown user");
        app.confirm();
        app.expectToast("Extra sender added");
        assertThat(teamMailbox.rowHeading(ghost)).isVisible();
        assertThat(extraSenders(webAdmin, domain)).containsExactly(ghost);
    }

    /** The "Team Mailbox" quota row, unless it sets no size ("Size: —"). */
    private static com.microsoft.playwright.Locator sizeIsSet(TeamMailboxPage teamMailbox) {
        return teamMailbox.quotaRow("Team Mailbox")
            .filter(new com.microsoft.playwright.Locator.FilterOptions().setHasNotText("Size: —"));
    }

    private static JsonNode quota(WebAdmin webAdmin, String domain) {
        return webAdmin.get("/domains/" + domain + "/team-mailboxes/" + SALES + "/quota").expect(200).json();
    }

    private static List<String> extraSenders(WebAdmin webAdmin, String domain) {
        JsonNode senders = webAdmin.get("/domains/" + domain + "/team-mailboxes/" + SALES + "/extraSenders").expect(200).json();
        return java.util.stream.StreamSupport.stream(senders.spliterator(), false)
            .map(sender -> sender.isTextual() ? sender.asText() : sender.path("username").asText()).toList();
    }
}
