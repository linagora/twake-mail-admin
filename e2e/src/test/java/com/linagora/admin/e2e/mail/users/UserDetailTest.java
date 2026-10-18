package com.linagora.admin.e2e.mail.users;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

import org.awaitility.Awaitility;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.Ids;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.users.UserDetailPage;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

/** User detail: mailboxes, quota and the mapping related sections (aliases, forwards, team mailboxes). */
class UserDetailTest extends MailAdminE2ETest {

    static List<String> texts(JsonNode array, String field) {
        List<String> values = new ArrayList<>();
        array.forEach(node -> values.add(field == null ? node.asText() : node.path(field).asText()));
        return values;
    }

    /** Creates the INBOX of {@code user} and delivers {@code count} mails into it. */
    static void deliver(MailFixtures fixtures, WebAdmin webAdmin, String user, int count) {
        webAdmin.put("/users/" + user + "/mailboxes/INBOX").expect(204);
        String sender = fixtures.newUser("sender");
        for (int i = 0; i < count; i++) {
            fixtures.sendMail(sender, user, "Hello " + i, "Body " + i);
        }
        Awaitility.await().atMost(Duration.ofSeconds(30)).pollInterval(Duration.ofMillis(200))
            .until(() -> fixtures.messageCount(user, "INBOX") == count);
    }

    @Test
    @DisplayName("UDT-01 Mailboxes: list, counters, create, delete")
    void mailboxesListCreateDelete(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin) {
        String bob = fixtures.newUser("bob");
        deliver(fixtures, webAdmin, bob, 2);

        UserDetailPage detail = UserDetailPage.open(app, bob);
        assertThat(detail.toggle("Mailboxes", 1)).isVisible();
        Locator mailboxes = detail.expand("Mailboxes");
        String inboxId = webAdmin.get("/users/" + bob + "/mailboxes").expect(200).json().get(0).path("mailboxId").asText();
        Locator inbox = detail.itemRow(mailboxes, "INBOX", "Delete mailbox");
        assertThat(inbox).containsText(inboxId);
        // Local date and time of the browser (en-US, Europe/Paris), not a GMT string
        assertThat(inbox).containsText(Pattern.compile("Creation date: \\d{1,2}/\\d{1,2}/\\d{4} \\d{1,2}:\\d{2}:\\d{2} [AP]M"));
        assertThat(inbox).not().containsText("GMT");
        assertThat(inbox.getByTitle("Total messages")).hasText("2");
        assertThat(inbox.getByTitle("Unseen messages")).hasText("2");

        detail.button(mailboxes, "Create mailbox").click();
        mailboxes.getByPlaceholder("New mailbox name (use . for nesting, e.g. INBOX.work)").fill("INBOX.qa-folder");
        detail.button(mailboxes, "Create").click();
        app.expectToast("Mailbox created successfully");
        assertThat(detail.toggle("Mailboxes", 2)).isVisible();
        assertThat(texts(webAdmin.get("/users/" + bob + "/mailboxes").expect(200).json(), "mailboxName"))
            .contains("INBOX.qa-folder");

        mailboxes.getByPlaceholder("Search mailboxes...").fill("qa");
        assertThat(detail.items(mailboxes)).hasCount(1);
        assertThat(detail.item(mailboxes, "INBOX.qa-folder")).isVisible();

        detail.clickItemButton(mailboxes, "INBOX.qa-folder", "Delete mailbox");
        assertThat(app.dialog()).containsText("Are you sure you want to delete mailbox \"INBOX.qa-folder\" and all its children?");
        app.confirm();
        app.expectToast("Mailbox deleted successfully");
        assertThat(detail.toggle("Mailboxes", 1)).isVisible();
        assertThat(texts(webAdmin.get("/users/" + bob + "/mailboxes").expect(200).json(), "mailboxName"))
            .containsExactly("INBOX");
    }

    @Test
    @DisplayName("UDT-02 Mailboxes: clear mailbox content")
    void clearMailboxContent(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin, Page page) {
        String alice = fixtures.newUser("alice");
        deliver(fixtures, webAdmin, alice, 2);

        UserDetailPage detail = UserDetailPage.open(app, alice);
        Locator mailboxes = detail.expand("Mailboxes");
        assertThat(detail.itemRow(mailboxes, "INBOX", "Clear mailbox content").getByTitle("Total messages")).hasText("2");

        detail.clickItemButton(mailboxes, "INBOX", "Clear mailbox content");
        assertThat(app.dialog()).containsText("Are you sure you want to delete all messages in \"INBOX\"?");
        app.confirm();
        Locator taskLink = app.toast("Task created").getByRole(AriaRole.LINK);
        assertThat(taskLink).isVisible();
        String taskId = taskLink.innerText().trim().substring("Task ".length());
        // Follow the link right away: the toast vanishes after a few seconds
        taskLink.click();
        assertThat(page).hasURL(Pattern.compile("/task/" + taskId + "$"));

        assertThat(webAdmin.awaitTask(taskId).path("status").asText()).isEqualTo("completed");
        assertThat(fixtures.messageCount(alice, "INBOX")).isZero();
        detail = UserDetailPage.open(app, alice);
        mailboxes = detail.expand("Mailboxes");
        assertThat(detail.itemRow(mailboxes, "INBOX", "Clear mailbox content").getByTitle("Total messages")).hasText("0");
    }

    @Test
    @DisplayName("UDT-03 Quota: view, update, reset")
    void quotaViewUpdateReset(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin) {
        String bob = fixtures.newUser("bob");
        webAdmin.put("/quota/users/" + bob + "/count", "1000").expect(204);
        webAdmin.put("/quota/users/" + bob + "/size", String.valueOf(50L * 1024 * 1024)).expect(204);

        UserDetailPage detail = UserDetailPage.open(app, bob);
        Locator quota = detail.expand("Quota");
        assertThat(quota.getByText("Occupation", new Locator.GetByTextOptions().setExact(true))).isVisible();
        assertThat(quotaRow(quota, "Used")).containsText("Count: 0");
        assertThat(quotaRow(quota, "Ratio")).containsText("Max:");
        assertThat(quota.getByText("Per user limit", new Locator.GetByTextOptions().setExact(true))).isVisible();
        assertThat(quotaRow(quota, "Computed (effective)")).containsText("Size: 50.0 MB");
        assertThat(quotaRow(quota, "User")).hasText(Pattern.compile("Count: 1,000\\s*Size: 50\\.0 MB"));
        // No domain limit in this fresh domain: the row is omitted
        assertThat(quota.getByText("Domain", new Locator.GetByTextOptions().setExact(true))).hasCount(0);

        detail.button(quota, "Update size limit").click();
        quota.getByLabel("Size limit", new Locator.GetByLabelOptions().setExact(true)).fill("100");
        quota.getByLabel("Unit", new Locator.GetByLabelOptions().setExact(true)).selectOption("MB");
        detail.button(quota, "Save").click();
        app.expectToast("Quota size updated");
        assertThat(quotaRow(quota, "User")).containsText("Size: 100.0 MB");
        assertThat(webAdmin.get("/quota/users/" + bob + "/size").expect(200).json().asLong()).isEqualTo(104857600L);

        detail.button(quota, "Reset to domain default").click();
        assertThat(app.dialog()).containsText("Reset the quota size for \"" + bob + "\" to domain default?");
        app.confirm();
        app.expectToast("Quota size reset to domain default");
        assertThat(quotaRow(quota, "User")).containsText("Size: not set");
        assertThat(webAdmin.get("/quota/users/" + bob + "/size").status()).isEqualTo(204);

        detail.button(quota, "Update size limit").click();
        quota.getByLabel("Size limit", new Locator.GetByLabelOptions().setExact(true)).fill("-1");
        detail.button(quota, "Save").click();
        app.expectToast("Quota size updated");
        assertThat(quotaRow(quota, "User")).containsText("Size: unlimited");
        assertThat(webAdmin.get("/quota/users/" + bob + "/size").expect(200).json().asLong()).isEqualTo(-1L);
    }

    /** A "label  Count: x  Size: y" row of the quota section. */
    private static Locator quotaRow(Locator quota, String label) {
        return quota.locator("div")
            .filter(new Locator.FilterOptions().setHas(quota.page().getByText(label, new Page.GetByTextOptions().setExact(true))))
            .filter(new Locator.FilterOptions().setHasText(Pattern.compile("Count:|Size:|Max:")))
            .last();
    }

    @Test
    @DisplayName("UDT-04 Aliases: add and remove")
    void aliasesAddRemove(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin) {
        String alice = fixtures.newUser("alice");
        String domain = fixtures.domain();
        String existingAlias = Ids.unique("alice.alias") + "@" + domain;
        String newAlias = Ids.unique("alice.qa") + "@" + domain;
        webAdmin.put("/address/aliases/" + alice + "/sources/" + existingAlias).expect(204);

        UserDetailPage detail = UserDetailPage.open(app, alice);
        assertThat(detail.toggle("Aliases", 1)).isVisible();
        Locator aliases = detail.expand("Aliases");
        assertThat(detail.item(aliases, existingAlias)).isVisible();

        detail.button(aliases, "Add alias").click();
        aliases.getByPlaceholder("alias@domain.com").fill(newAlias);
        detail.button(aliases, "Add").click();
        app.expectToast("Alias added successfully");
        assertThat(detail.toggle("Aliases", 2)).isVisible();
        assertThat(texts(webAdmin.get("/address/aliases/" + alice).expect(200).json(), "source"))
            .containsExactlyInAnyOrder(existingAlias, newAlias);

        detail.clickItemButton(aliases, newAlias, "Remove alias");
        assertThat(app.dialog()).containsText("Remove alias \"" + newAlias + "\" from " + alice + "?");
        app.confirm();
        app.expectToast("Alias removed successfully");
        assertThat(detail.toggle("Aliases", 1)).isVisible();
        assertThat(texts(webAdmin.get("/address/aliases/" + alice).expect(200).json(), "source"))
            .containsExactly(existingAlias);

        detail.button(aliases, "Add alias").click();
        aliases.getByPlaceholder("alias@domain.com").fill("not-an-address");
        detail.button(aliases, "Add").click();
        assertThat(app.toast("Error adding alias")).containsText("The alias is not an email address");
        assertThat(detail.toggle("Aliases", 1)).isVisible();
    }

    @Test
    @DisplayName("UDT-05 Forwards and \"User still receives emails\"")
    void forwardsAndUserStillReceives(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin) {
        String brian = fixtures.newUser("brian");
        String charlotte = fixtures.newUser("charlotte");
        String david = fixtures.newUser("david");
        webAdmin.put("/address/forwards/" + brian + "/targets/" + charlotte).expect(204);

        UserDetailPage detail = UserDetailPage.open(app, brian);
        assertThat(detail.toggle("Forwards", 1)).isVisible();
        Locator forwards = detail.expand("Forwards");
        assertThat(detail.item(forwards, charlotte)).isVisible();
        Locator stillReceives = forwards.getByRole(AriaRole.CHECKBOX,
            new Locator.GetByRoleOptions().setName("User still receives emails").setExact(true));
        assertThat(stillReceives).not().isChecked();
        assertThat(stillReceives).isEnabled();

        stillReceives.click();
        app.expectToast("User added to forward destinations");
        assertThat(stillReceives).isChecked();
        assertThat(detail.item(forwards, brian)).containsText("(self)");
        assertThat(texts(webAdmin.get("/address/forwards/" + brian).expect(200).json(), "mailAddress"))
            .containsExactlyInAnyOrder(brian, charlotte);

        stillReceives.click();
        app.expectToast("User removed from forward destinations");
        assertThat(stillReceives).not().isChecked();
        assertThat(detail.item(forwards, brian)).hasCount(0);

        detail.button(forwards, "Add forward").click();
        forwards.getByPlaceholder("destination@domain.com").fill(david);
        detail.button(forwards, "Add").click();
        app.expectToast("Forward added successfully");
        assertThat(detail.item(forwards, david)).isVisible();
        assertThat(texts(webAdmin.get("/address/forwards/" + brian).expect(200).json(), "mailAddress"))
            .containsExactlyInAnyOrder(charlotte, david);

        detail.clickItemButton(forwards, david, "Remove forward");
        assertThat(app.dialog()).containsText("Remove forward to \"" + david + "\" from " + brian + "?");
        app.confirm();
        app.expectToast("Forward removed successfully");
        assertThat(detail.item(forwards, david)).hasCount(0);
        assertThat(texts(webAdmin.get("/address/forwards/" + brian).expect(200).json(), "mailAddress"))
            .containsExactly(charlotte);

        UserDetailPage davidDetail = UserDetailPage.open(app, david);
        Locator davidForwards = davidDetail.expand("Forwards");
        Locator davidReceives = davidForwards.getByRole(AriaRole.CHECKBOX,
            new Locator.GetByRoleOptions().setName("User still receives emails").setExact(true));
        assertThat(davidReceives).isChecked();
        assertThat(davidReceives).isDisabled();
        assertThat(davidForwards.getByText("No forwards configured.")).isVisible();
    }

    @Test
    @DisplayName("UDT-06 Mappings of a user")
    void mappingsOfAUser(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin) {
        String alice = fixtures.newUser("alice");
        String brian = fixtures.newUser("brian");
        String charlotte = fixtures.newUser("charlotte");
        String alias = Ids.unique("alice.alias") + "@" + fixtures.domain();
        webAdmin.put("/address/aliases/" + alice + "/sources/" + alias).expect(204);
        webAdmin.put("/address/forwards/" + brian + "/targets/" + charlotte).expect(204);

        UserDetailPage brianDetail = UserDetailPage.open(app, brian);
        Locator brianMappings = brianDetail.expand("Mappings");
        assertThat(brianMappings.getByText("Mappings from this user", new Locator.GetByTextOptions().setExact(true))).isVisible();
        Locator table = brianMappings.getByRole(AriaRole.TABLE);
        assertThat(table.getByRole(AriaRole.COLUMNHEADER)).hasText(new String[] {"#", "Type", "Destination"});
        assertThat(table.getByRole(AriaRole.ROW).filter(new Locator.FilterOptions().setHasText(charlotte)))
            .containsText("Forward");

        UserDetailPage detail = UserDetailPage.open(app, alice);
        Locator mappings = detail.expand("Mappings");
        assertThat(mappings.getByText("Sources pointing to this user", new Locator.GetByTextOptions().setExact(true))).isVisible();
        assertThat(mappings.getByText(alias, new Locator.GetByTextOptions().setExact(true))).isVisible();

        detail.button(mappings, "Remove all Alias sources").click();
        assertThat(app.dialog()).containsText("Remove all Alias sources of " + alice + " (" + alias + ")?");
        app.confirm();
        app.expectToast("Alias sources of " + alice + " removed");
        assertThat(mappings.getByText("No mappings found.")).isVisible();
        assertThat(webAdmin.get("/mappings/sources/" + alice + "?type=alias").expect(200).json()).isEmpty();
        assertThat(webAdmin.get("/address/aliases/" + alice).expect(200).json()).isEmpty();
    }

    @Test
    @DisplayName("UDT-07 Team mailboxes of a user: leave")
    void teamMailboxesLeave(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin) {
        String bob = fixtures.newUser("bob");
        String domain = fixtures.domain();
        String sales = "sales@" + domain;
        webAdmin.put("/domains/" + domain + "/team-mailboxes/sales").expect(204);
        webAdmin.put("/domains/" + domain + "/team-mailboxes/sales/members/" + bob + "?role=member").expect(204);

        UserDetailPage detail = UserDetailPage.open(app, bob);
        assertThat(detail.toggle("Allowed From Headers", 2)).isVisible();
        Locator allowedFrom = detail.expand("Allowed From Headers");
        assertThat(detail.item(allowedFrom, sales)).isVisible();
        assertThat(detail.toggle("JMAP Identities", 2)).isVisible();

        assertThat(detail.toggle("Team Mailboxes", 1)).isVisible();
        Locator teamMailboxes = detail.expand("Team Mailboxes");
        assertThat(detail.item(teamMailboxes, sales)).isVisible();
        detail.clickItemButton(teamMailboxes, sales, "Leave");
        assertThat(app.dialog()).containsText("Remove \"" + bob + "\" from team mailbox \"" + sales + "\"?");
        app.confirm();
        app.expectToast("Left team mailbox \"" + sales + "\"");
        assertThat(teamMailboxes.getByText("Not a member of any team mailbox.")).isVisible();
        assertThat(detail.toggle("Team Mailboxes", 0)).isVisible();

        // Without reload, the sections following the mappings are refreshed
        int allowedCount = webAdmin.get("/users/" + bob + "/allowedFromHeaders").expect(200).json().size();
        int identitiesCount = webAdmin.get("/users/" + bob + "/identities").expect(200).json().size();
        assertThat(allowedCount).isEqualTo(1);
        assertThat(detail.item(allowedFrom, sales)).hasCount(0);
        assertThat(detail.toggle("Allowed From Headers", allowedCount)).isVisible();
        assertThat(detail.toggle("JMAP Identities", identitiesCount)).isVisible();
    }
}
