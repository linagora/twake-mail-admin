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
        assertThat(teamMailbox.quotaRow("Computed (effective)")).isVisible();
        // WebAdmin answers "teamMailbox": null while nothing is set: the row is then left out
        assertThat(sizeIsSet(teamMailbox)).hasCount(0);

        teamMailbox.button("Update size limit").click();
        teamMailbox.sizeLimitInput().fill("100");
        teamMailbox.sizeUnitSelect().selectOption("MB");
        teamMailbox.button("Save").click();
        app.expectToast("Quota size updated");
        assertThat(teamMailbox.quotaRow("Team Mailbox")).containsText("Size: 100.0 MB");
        assertThat(quota(webAdmin, domain).path("teamMailbox").path("size").asLong()).isEqualTo(100L * 1024 * 1024);

        teamMailbox.button("Reset to domain default").click();
        assertThat(app.dialog()).containsText("Reset the quota size for \"" + SALES + "@" + domain + "\" to domain default?");
        app.confirm();
        app.expectToast("Quota size reset to domain default");
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
        TeamMailboxPage teamMailbox = TeamMailboxPage.open(app, domain, SALES).collapseMembers();
        assertThat(teamMailbox.text("No extra senders.")).isVisible();

        teamMailbox.usernameInput().fill(david);
        assertThat(teamMailbox.text("User exists")).isVisible();
        teamMailbox.addButton().click();
        app.expectToast("Extra sender added");
        assertThat(teamMailbox.rowHeading(david)).isVisible();
        assertThat(teamMailbox.sectionButton("Extra Senders", 1)).isVisible();
        assertThat(extraSenders(webAdmin, domain)).containsExactly(david);

        teamMailbox.rowButton(david, "Remove extra sender").click();
        assertThat(app.dialog()).containsText("Revoke send-as right for \"" + david + "\"?");
        app.confirm();
        app.expectToast("Extra sender removed");
        assertThat(teamMailbox.text("No extra senders.")).isVisible();
        assertThat(extraSenders(webAdmin, domain)).isEmpty();

        // Invalid username
        teamMailbox.usernameInput().fill("a@b@c");
        assertThat(teamMailbox.text("Invalid username")).isVisible();
        assertThat(teamMailbox.addButton()).isDisabled();

        // Unknown user: asks first, Cancel adds nothing, Confirm adds it
        teamMailbox.usernameInput().fill(ghost);
        assertThat(teamMailbox.addButton()).isDisabled();
        assertThat(teamMailbox.text("User not found")).isVisible();
        teamMailbox.addButton().click();
        assertThat(app.dialog()).containsText("Unknown user");
        assertThat(app.dialog()).containsText("\"" + ghost + "\" does not exist. Add it anyway?");
        app.cancel();
        assertThat(extraSenders(webAdmin, domain)).isEmpty();
        teamMailbox.addButton().click();
        app.confirm();
        app.expectToast("Extra sender added");
        assertThat(teamMailbox.rowHeading(ghost)).isVisible();
        assertThat(extraSenders(webAdmin, domain)).containsExactly(ghost);
    }

    /** The "Team Mailbox" quota row, unless absent or showing "Size: not set". */
    private static com.microsoft.playwright.Locator sizeIsSet(TeamMailboxPage teamMailbox) {
        return teamMailbox.quotaRow("Team Mailbox")
            .filter(new com.microsoft.playwright.Locator.FilterOptions().setHasNotText("Size: not set"));
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
