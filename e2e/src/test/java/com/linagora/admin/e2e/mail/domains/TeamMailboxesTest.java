package com.linagora.admin.e2e.mail.domains;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.regex.Pattern;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.domains.DomainDetailPage;
import com.linagora.admin.e2e.pages.mail.domains.Regex;
import com.linagora.admin.e2e.pages.mail.domains.TeamMailboxPage;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

class TeamMailboxesTest extends MailAdminE2ETest {
    static final String SALES = "sales";

    @Test
    @DisplayName("DTM-01 Create, open and delete a team mailbox")
    void createOpenDeleteTeamMailbox(AdminApp app, MailFixtures fixtures, Page page) {
        String domain = fixtures.domain();
        WebAdmin webAdmin = fixtures.webAdmin();

        DomainDetailPage detail = DomainDetailPage.open(app, domain).openSection("Team Mailboxes");
        assertThat(detail.text("No team mailboxes configured.")).isVisible();
        detail.button("Add team mailbox").click();
        detail.placeholder("mailbox name").fill(SALES);
        detail.button("Add").click();
        app.expectToast("Team mailbox created");
        assertThat(detail.sectionButton("Team Mailboxes", 1)).isVisible();
        assertThat(teamMailboxes(webAdmin, domain)).containsExactly(SALES);

        Locator link = detail.main().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName(SALES).setExact(true));
        assertThat(link.locator("xpath=..")).containsText(SALES + "@" + domain);
        link.click();
        assertThat(page).hasURL(Pattern.compile(Regex.quote(TeamMailboxPage.path(domain, SALES)) + "$"));
        TeamMailboxPage teamMailbox = TeamMailboxPage.expect(app, domain, SALES);
        assertThat(teamMailbox.main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions()
            .setName("Team Mailbox Details").setExact(true))).isVisible();
        for (String section : List.of("Members", "Folders", "Quota", "Extra Senders", "Deleted Message Vault")) {
            assertThat(teamMailbox.sectionButton(section)).isVisible();
        }

        page.goBack();
        detail = DomainDetailPage.open(app, domain).openSection("Team Mailboxes");
        Locator row = link.locator("xpath=ancestor::div[.//button][1]");
        row.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Delete team mailbox").setExact(true)).click();
        assertThat(app.dialog()).containsText("Delete team mailbox \"" + SALES + "@" + domain + "\"?");
        app.confirm();
        app.expectToast("Team mailbox deleted");
        assertThat(link).hasCount(0);
        assertThat(detail.text("No team mailboxes configured.")).isVisible();
        assertThat(teamMailboxes(webAdmin, domain)).isEmpty();
    }

    @Test
    @DisplayName("DTM-02 Team mailbox members")
    void teamMailboxMembers(AdminApp app, MailFixtures fixtures) {
        String domain = fixtures.domain();
        WebAdmin webAdmin = fixtures.webAdmin();
        String bob = fixtures.newUser("bob");
        String charlotte = fixtures.newUser("charlotte");
        String ghost = "ghost-" + bob;
        createTeamMailbox(webAdmin, domain, SALES);

        TeamMailboxPage teamMailbox = TeamMailboxPage.open(app, domain, SALES).collapseExtraSenders();
        assertThat(teamMailbox.text("No members.")).isVisible();

        // Existing user, role member
        teamMailbox.usernameInput().fill(bob);
        assertThat(teamMailbox.addButton()).isDisabled();
        assertThat(teamMailbox.text("User exists")).isVisible();
        assertThat(teamMailbox.addButton()).isEnabled();
        teamMailbox.addButton().click();
        app.expectToast("Member added");
        assertThat(teamMailbox.rowHeading(bob)).hasText(Pattern.compile(Regex.quote(bob) + "\\s*\\(member\\)$"));

        // Manager, then the role select goes back to member
        teamMailbox.usernameInput().fill(charlotte);
        assertThat(teamMailbox.text("User exists")).isVisible();
        teamMailbox.roleSelect().selectOption("manager");
        teamMailbox.addButton().click();
        app.expectToast("Member added");
        assertThat(teamMailbox.rowHeading(charlotte)).hasText(Pattern.compile(Regex.quote(charlotte) + "\\s*\\(manager\\)$"));
        assertThat(teamMailbox.roleSelect()).hasValue("member");
        assertThat(teamMailbox.usernameInput()).hasValue("");
        assertThat(members(webAdmin, domain, SALES)).containsExactlyInAnyOrder(bob + ":member", charlotte + ":manager");

        // Malformed input
        teamMailbox.usernameInput().fill("a@b@c");
        assertThat(teamMailbox.text("Invalid username")).isVisible();
        assertThat(teamMailbox.addButton()).isDisabled();

        // Unknown user: asks first, Cancel adds nothing, Confirm adds it
        teamMailbox.usernameInput().fill(ghost);
        assertThat(teamMailbox.text("User not found")).isVisible();
        teamMailbox.addButton().click();
        assertThat(app.dialog()).containsText("Unknown user");
        assertThat(app.dialog()).containsText("\"" + ghost + "\" does not exist. Add it anyway?");
        app.cancel();
        assertThat(teamMailbox.rowHeading(ghost)).hasCount(0);
        assertThat(members(webAdmin, domain, SALES)).hasSize(2);
        teamMailbox.addButton().click();
        app.confirm();
        app.expectToast("Member added");
        assertThat(teamMailbox.rowHeading(ghost)).isVisible();
        assertThat(members(webAdmin, domain, SALES)).contains(ghost + ":member");

        teamMailbox.rowButton(bob, "Remove member").click();
        assertThat(app.dialog()).containsText("Remove \"" + bob + "\" from " + SALES + "@" + domain + "?");
        app.confirm();
        app.expectToast("Member removed");
        assertThat(teamMailbox.rowHeading(bob)).hasCount(0);
        assertThat(members(webAdmin, domain, SALES)).containsExactlyInAnyOrder(charlotte + ":manager", ghost + ":member");
    }

    @Test
    @DisplayName("DTM-03 Team mailbox folders and counts")
    void teamMailboxFolders(AdminApp app, MailFixtures fixtures) {
        String domain = fixtures.domain();
        WebAdmin webAdmin = fixtures.webAdmin();
        createTeamMailbox(webAdmin, domain, SALES);

        TeamMailboxPage teamMailbox = TeamMailboxPage.open(app, domain, SALES);
        teamMailbox.toggleSection("Folders");
        List<String> defaults = List.of("Drafts", "INBOX", "Outbox", "Sent", "Templates", "Trash");
        for (String folder : defaults) {
            assertThat(folderLink(teamMailbox, folder)).isVisible();
            Locator row = teamMailbox.row(folder);
            assertThat(row.getByTitle("Total messages")).hasText("0");
            assertThat(row.getByTitle("Unseen messages")).hasText("0");
        }
        // The team mailbox root itself is not listed
        assertThat(folderLink(teamMailbox, SALES)).hasCount(0);
        assertThat(teamMailbox.sectionButton("Folders", defaults.size())).isVisible();

        teamMailbox.button("Create folder").click();
        teamMailbox.placeholder("New folder name (use . for nesting, e.g. INBOX.work)").fill("INBOX.archive");
        teamMailbox.button("Create").click();
        app.expectToast("Folder created successfully");
        assertThat(folderLink(teamMailbox, "INBOX.archive")).isVisible();
        assertThat(folders(webAdmin, domain, SALES)).contains("INBOX.archive");

        teamMailbox.rowButton("INBOX.archive", "Delete folder").click();
        assertThat(app.dialog()).containsText("Are you sure you want to delete folder \"INBOX.archive\"?");
        app.confirm();
        app.expectToast("Folder deleted successfully");
        assertThat(folderLink(teamMailbox, "INBOX.archive")).hasCount(0);
        assertThat(folders(webAdmin, domain, SALES)).doesNotContain("INBOX.archive");
    }

    private static Locator folderLink(TeamMailboxPage teamMailbox, String folder) {
        return teamMailbox.main().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName(folder).setExact(true));
    }

    static void createTeamMailbox(WebAdmin webAdmin, String domain, String name) {
        webAdmin.put("/domains/" + domain + "/team-mailboxes/" + name).expect(204);
    }

    static List<String> teamMailboxes(WebAdmin webAdmin, String domain) {
        return names(webAdmin.get("/domains/" + domain + "/team-mailboxes").expect(200).json(), "name");
    }

    static List<String> members(WebAdmin webAdmin, String domain, String name) {
        JsonNode members = webAdmin.get("/domains/" + domain + "/team-mailboxes/" + name + "/members").expect(200).json();
        return java.util.stream.StreamSupport.stream(members.spliterator(), false)
            .map(member -> member.path("username").asText() + ":" + member.path("role").asText()).toList();
    }

    static List<String> folders(WebAdmin webAdmin, String domain, String name) {
        return names(webAdmin.get("/domains/" + domain + "/team-mailboxes/" + name + "/mailboxes").expect(200).json(), "mailboxName");
    }

    private static List<String> names(JsonNode array, String field) {
        return java.util.stream.StreamSupport.stream(array.spliterator(), false).map(node -> node.path(field).asText()).toList();
    }
}
