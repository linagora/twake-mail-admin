package com.linagora.admin.e2e.mail.users;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

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
        fixtures.awaitMessageCount(user, "INBOX", count);
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
        Locator inbox = detail.itemRow(mailboxes, "INBOX", "Delete mailbox \"INBOX\"");
        assertThat(inbox).containsText(inboxId);
        // Local date and time of the browser (en-US, Europe/Paris), not a GMT string
        assertThat(inbox).containsText(Pattern.compile("Creation date: \\d{1,2}/\\d{1,2}/\\d{4} \\d{1,2}:\\d{2}:\\d{2} [AP]M"));
        assertThat(inbox).not().containsText("GMT");
        // The counters are labelled in visible text: a touch screen never shows a hover tooltip
        assertThat(inbox.getByText("Total: 2", new Locator.GetByTextOptions().setExact(true))).isVisible();
        assertThat(inbox.getByText("Unseen: 2", new Locator.GetByTextOptions().setExact(true))).isVisible();

        // The "+" next to the title opens a modal
        detail.button(mailboxes, "Create mailbox").click();
        assertThat(detail.dialog().getByRole(AriaRole.HEADING)).hasText("Create mailbox");
        Locator name = detail.dialog().getByLabel("Mailbox name", new Locator.GetByLabelOptions().setExact(true));
        assertThat(name).isFocused();
        name.fill("INBOX.qa-folder");
        detail.button(detail.dialog(), "Create").click();
        app.expectToast("Mailbox created successfully");
        assertThat(detail.dialog()).isHidden();
        assertThat(detail.toggle("Mailboxes", 2)).isVisible();
        assertThat(texts(webAdmin.get("/users/" + bob + "/mailboxes").expect(200).json(), "mailboxName"))
            .contains("INBOX.qa-folder");

        mailboxes.getByPlaceholder("Search mailboxes...").fill("qa");
        assertThat(detail.items(mailboxes)).hasCount(1);
        assertThat(detail.item(mailboxes, "INBOX.qa-folder")).isVisible();

        detail.clickItemButton(mailboxes, "INBOX.qa-folder", "Delete mailbox \"INBOX.qa-folder\"");
        assertThat(app.dialog()).containsText("Are you sure you want to delete mailbox \"INBOX.qa-folder\" and all its children?");
        assertThat(app.dialog()).containsText("\"INBOX.qa-folder\", its sub-folders and all their messages are permanently deleted.");
        detail.confirm("Delete");
        app.expectToast("Mailbox deleted successfully");
        assertThat(detail.toggle("Mailboxes", 1)).isVisible();
        assertThat(texts(webAdmin.get("/users/" + bob + "/mailboxes").expect(200).json(), "mailboxName"))
            .containsExactly("INBOX");

        // Deleting the INBOX takes typing its name
        mailboxes.getByPlaceholder("Search mailboxes...").clear();
        detail.clickItemButton(mailboxes, "INBOX", "Delete mailbox \"INBOX\"");
        Locator delete = detail.button(app.dialog(), "Delete");
        assertThat(delete).isDisabled();
        app.dialog().getByLabel("Type INBOX to confirm", new Locator.GetByLabelOptions().setExact(true)).fill("INBOX");
        assertThat(delete).isEnabled();
        app.cancel();
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
        assertThat(detail.itemRow(mailboxes, "INBOX", "Clear content of mailbox \"INBOX\"")
            .getByText("Total: 2", new Locator.GetByTextOptions().setExact(true))).isVisible();

        detail.clickItemButton(mailboxes, "INBOX", "Clear content of mailbox \"INBOX\"");
        assertThat(app.dialog()).containsText("Are you sure you want to delete all messages in \"INBOX\"?");
        assertThat(app.dialog()).containsText("All messages of \"INBOX\" are permanently deleted; the folder is kept.");
        detail.confirm("Clear");
        Locator taskLink = app.toast("Task created").getByRole(AriaRole.LINK);
        assertThat(taskLink).isVisible();
        assertThat(taskLink).hasText(AdminApp.TASK_TOAST_LINK);
        String taskId = AdminApp.taskIdOf(taskLink);
        // Follow the link right away: the toast vanishes after a few seconds
        taskLink.click();
        assertThat(page).hasURL(Pattern.compile("/task/" + taskId + "$"));

        assertThat(webAdmin.awaitTask(taskId).path("status").asText()).isEqualTo("completed");
        assertThat(fixtures.messageCount(alice, "INBOX")).isZero();
        detail = UserDetailPage.open(app, alice);
        mailboxes = detail.expand("Mailboxes");
        assertThat(detail.itemRow(mailboxes, "INBOX", "Clear content of mailbox \"INBOX\"")
            .getByText("Total: 0", new Locator.GetByTextOptions().setExact(true))).isVisible();
    }

    @Test
    @DisplayName("UDT-03 Quota: view, edit the limits, remove them")
    void quotaViewUpdateReset(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin) {
        String bob = fixtures.newUser("bob");
        webAdmin.put("/quota/users/" + bob + "/count", "1000").expect(204);
        webAdmin.put("/quota/users/" + bob + "/size", String.valueOf(50L * 1024 * 1024)).expect(204);

        UserDetailPage detail = UserDetailPage.open(app, bob);
        // The summary strip states the quota, and reveals the section
        detail.chip("Quota: 0 B / 50.0 MB (0.0%)").click();
        Locator quota = detail.section("Quota");
        assertThat(detail.toggle("Quota")).hasAttribute("aria-expanded", "true");
        assertThat(quota.getByText("Occupation", new Locator.GetByTextOptions().setExact(true))).isVisible();
        assertThat(quotaRow(quota, "Used")).containsText("Count: 0");
        assertThat(quotaRow(quota, "Ratio")).containsText("Max:");
        assertThat(quota.getByText("Per user limit", new Locator.GetByTextOptions().setExact(true))).isVisible();
        assertThat(quotaRow(quota, "Applied limit")).containsText("Size: 50.0 MB");
        assertThat(quotaRow(quota, "User")).hasText(Pattern.compile("Count: 1,000\\s*Size: 50\\.0 MB"));
        // Where the applied limit comes from, and every level, "—" when it sets nothing
        assertThat(quotaRow(quota, "Applied limit")).containsText("Size: 50.0 MB (user)");
        String domainOfBob = bob.substring(bob.indexOf('@') + 1);
        assertThat(quotaRow(quota, "Domain " + domainOfBob)).hasText(Pattern.compile("Count: —\\s*Size: —"));

        // Both limits are edited together, prefilled with the current ones
        detail.button(quota, "Edit limits").click();
        Locator dialog = detail.dialog();
        assertThat(dialog.getByRole(AriaRole.HEADING)).hasText("Quota limits of " + bob);
        Locator count = limit(dialog, "Message count");
        Locator size = limit(dialog, "Size");
        assertThat(count).hasValue("1000");
        assertThat(size).hasValue("50");
        assertThat(dialog.getByLabel("Unit", new Locator.GetByLabelOptions().setExact(true))).hasValue("MB");

        count.fill("0");
        detail.button(dialog, "Save").click();
        assertThat(app.dialogError()).hasText("A message count must be a whole number of at least 1, or unlimited.");
        count.fill("2000");
        size.fill("100");
        detail.button(dialog, "Save").click();
        app.expectToast("Quota limits updated");
        assertThat(dialog).isHidden();
        assertThat(quotaRow(quota, "User")).hasText(Pattern.compile("Count: 2,000\\s*Size: 100\\.0 MB"));
        assertThat(webAdmin.get("/quota/users/" + bob + "/size").expect(200).json().asLong()).isEqualTo(104857600L);
        assertThat(webAdmin.get("/quota/users/" + bob + "/count").expect(200).json().asLong()).isEqualTo(2000L);

        detail.button(quota, "Remove specific limits").click();
        assertThat(app.dialog()).containsText("Remove the message count and size limits set for \"" + bob
            + "\"? The limits of the domain, or the global ones, will apply again.");
        app.confirm();
        app.expectToast("Specific limits removed");
        // No limit of its own any more: the User row reads "—", and nothing applies
        assertThat(quotaRow(quota, "User")).hasText(Pattern.compile("Count: —\\s*Size: —"));
        assertThat(quotaRow(quota, "Applied limit")).containsText("Size: Unlimited (no limit set)");
        // A ratio of an unlimited quota means nothing: none is shown
        assertThat(quota.getByText("Ratio", new Locator.GetByTextOptions().setExact(true))).hasCount(0);
        assertThat(detail.button(quota, "Remove specific limits")).hasCount(0);
        assertThat(webAdmin.get("/quota/users/" + bob + "/size").status()).isEqualTo(204);
        assertThat(webAdmin.get("/quota/users/" + bob + "/count").status()).isEqualTo(204);

        // Unlimited size, no count limit
        detail.button(quota, "Edit limits").click();
        assertThat(count).hasValue("");
        assertThat(size).hasValue("");
        dialog.getByRole(AriaRole.GROUP, new Locator.GetByRoleOptions().setName("Size").setExact(true))
            .getByRole(AriaRole.CHECKBOX, new Locator.GetByRoleOptions().setName("Unlimited").setExact(true)).click();
        assertThat(size).isDisabled();
        detail.button(dialog, "Save").click();
        app.expectToast("Quota limits updated");
        assertThat(quotaRow(quota, "User")).hasText(Pattern.compile("Count: —\\s*Size: Unlimited"));
        assertThat(webAdmin.get("/quota/users/" + bob + "/size").expect(200).json().asLong()).isEqualTo(-1L);
        assertThat(webAdmin.get("/quota/users/" + bob + "/count").status()).isEqualTo(204);
    }

    /** A limit field of the "Edit limits" dialog: "Message count" or "Size". */
    private static Locator limit(Locator dialog, String name) {
        return dialog.getByRole(AriaRole.SPINBUTTON, new Locator.GetByRoleOptions().setName(name).setExact(true));
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
        assertThat(detail.chip("Aliases: 1")).isVisible();
        Locator aliases = detail.expand("Aliases");
        assertThat(detail.item(aliases, existingAlias)).isVisible();

        addAlias(detail, aliases, newAlias);
        app.expectToast("Alias added successfully");
        assertThat(detail.dialog()).isHidden();
        assertThat(detail.toggle("Aliases", 2)).isVisible();
        assertThat(detail.chip("Aliases: 2")).isVisible();
        assertThat(texts(webAdmin.get("/address/aliases/" + alice).expect(200).json(), "source"))
            .containsExactlyInAnyOrder(existingAlias, newAlias);

        detail.clickItemButton(aliases, newAlias, "Remove alias \"" + newAlias + "\"");
        assertThat(app.dialog()).containsText("Remove alias \"" + newAlias + "\" from " + alice + "?");
        detail.confirm("Remove");
        app.expectToast("Alias removed successfully");
        assertThat(detail.toggle("Aliases", 1)).isVisible();
        assertThat(texts(webAdmin.get("/address/aliases/" + alice).expect(200).json(), "source"))
            .containsExactly(existingAlias);

        // A refusal is shown in the modal, which keeps the typed value
        addAlias(detail, aliases, "not-an-address");
        assertThat(app.dialogError()).containsText("The alias is not an email address");
        assertThat(aliasField(detail)).hasValue("not-an-address");
        app.cancel();
        assertThat(detail.toggle("Aliases", 1)).isVisible();
    }

    private static Locator aliasField(UserDetailPage detail) {
        return detail.dialog().getByLabel("Alias address", new Locator.GetByLabelOptions().setExact(true));
    }

    /** The "+" of the Aliases section, then its modal. */
    private static void addAlias(UserDetailPage detail, Locator aliases, String alias) {
        detail.button(aliases, "Add alias").click();
        assertThat(detail.dialog().getByRole(AriaRole.HEADING)).hasText("Add alias");
        aliasField(detail).fill(alias);
        detail.button(detail.dialog(), "Add").click();
    }

    @Test
    @DisplayName("UDT-05 Forwards and \"Keep a copy in this mailbox\"")
    void forwardsAndUserStillReceives(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin) {
        String brian = fixtures.newUser("brian");
        String charlotte = fixtures.newUser("charlotte");
        String david = fixtures.newUser("david");
        webAdmin.put("/address/forwards/" + brian + "/targets/" + charlotte).expect(204);

        UserDetailPage detail = UserDetailPage.open(app, brian);
        assertThat(detail.toggle("Forwards", 1)).isVisible();
        assertThat(detail.chip("Forwards: 1 (no copy kept)")).isVisible();
        Locator forwards = detail.expand("Forwards");
        assertThat(detail.item(forwards, charlotte)).isVisible();
        // A local destination links to its user page
        assertThat(detail.item(forwards, charlotte).getByRole(AriaRole.LINK)).hasAttribute("href", "/users/user/" + WebAdmin.encode(charlotte));
        Locator keepCopy = forwards.getByRole(AriaRole.CHECKBOX,
            new Locator.GetByRoleOptions().setName("Keep a copy in this mailbox").setExact(true));
        Locator onlyForwarded = forwards.getByText("Mail to " + brian + " is only forwarded: nothing is delivered to this mailbox.");
        assertThat(keepCopy).not().isChecked();
        assertThat(keepCopy).isEnabled();
        assertThat(onlyForwarded).isVisible();

        keepCopy.click();
        app.expectToast("A copy is kept in this mailbox");
        assertThat(keepCopy).isChecked();
        assertThat(onlyForwarded).isHidden();
        // The user's own address is not listed as a forward
        assertThat(detail.item(forwards, brian)).hasCount(0);
        assertThat(detail.toggle("Forwards", 1)).isVisible();
        assertThat(detail.chip("Forwards to " + charlotte)).isVisible();
        assertThat(texts(webAdmin.get("/address/forwards/" + brian).expect(200).json(), "mailAddress"))
            .containsExactlyInAnyOrder(brian, charlotte);

        keepCopy.click();
        app.expectToast("No copy is kept in this mailbox any more");
        assertThat(keepCopy).not().isChecked();
        assertThat(onlyForwarded).isVisible();
        assertThat(texts(webAdmin.get("/address/forwards/" + brian).expect(200).json(), "mailAddress"))
            .containsExactly(charlotte);

        // Adding a forward asks whether to keep a copy, checked by default; the destination is suggested
        detail.button(forwards, "Add forward").click();
        Locator dialog = detail.dialog();
        Locator copyInDialog = dialog.getByRole(AriaRole.CHECKBOX,
            new Locator.GetByRoleOptions().setName("Keep a copy in " + brian + "'s mailbox").setExact(true));
        assertThat(copyInDialog).isChecked();
        Locator destination = dialog.getByRole(AriaRole.COMBOBOX, new Locator.GetByRoleOptions().setName("Destination address").setExact(true));
        destination.fill(david.substring(0, david.indexOf('@')));
        dialog.getByRole(AriaRole.OPTION, new Locator.GetByRoleOptions().setName(david).setExact(true)).click();
        assertThat(destination).hasValue(david);
        detail.button(dialog, "Add").click();
        app.expectToast("Forward added successfully");
        assertThat(dialog).isHidden();
        assertThat(detail.item(forwards, david)).isVisible();
        assertThat(keepCopy).isChecked();
        assertThat(detail.toggle("Forwards", 2)).isVisible();
        assertThat(detail.chip("Forwards: 2")).isVisible();
        assertThat(texts(webAdmin.get("/address/forwards/" + brian).expect(200).json(), "mailAddress"))
            .containsExactlyInAnyOrder(brian, charlotte, david);

        detail.clickItemButton(forwards, david, "Remove forward to \"" + david + "\"");
        assertThat(app.dialog()).containsText("Remove forward to \"" + david + "\" from " + brian + "?");
        detail.confirm("Remove");
        app.expectToast("Forward removed successfully");
        assertThat(detail.item(forwards, david)).hasCount(0);
        assertThat(texts(webAdmin.get("/address/forwards/" + brian).expect(200).json(), "mailAddress"))
            .containsExactlyInAnyOrder(brian, charlotte);

        // Once a copy is kept the question is not asked again; without a copy, unchecked, mail is only forwarded
        detail.button(forwards, "Add forward").click();
        assertThat(copyInDialog).hasCount(0);
        app.cancel();
        keepCopy.click();
        app.expectToast("No copy is kept in this mailbox any more");
        detail.button(forwards, "Add forward").click();
        copyInDialog.click();
        assertThat(dialog.getByText("Mail to " + brian + " will only be forwarded: nothing will be delivered to this mailbox."))
            .isVisible();
        destination.fill(david);
        detail.button(dialog, "Add").click();
        app.expectToast("Forward added successfully");
        assertThat(keepCopy).not().isChecked();
        assertThat(texts(webAdmin.get("/address/forwards/" + brian).expect(200).json(), "mailAddress"))
            .containsExactlyInAnyOrder(charlotte, david);

        UserDetailPage davidDetail = UserDetailPage.open(app, david);
        Locator davidForwards = davidDetail.expand("Forwards");
        Locator davidKeepsCopy = davidForwards.getByRole(AriaRole.CHECKBOX,
            new Locator.GetByRoleOptions().setName("Keep a copy in this mailbox").setExact(true));
        assertThat(davidKeepsCopy).isChecked();
        assertThat(davidKeepsCopy).isDisabled();
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
        detail.confirm("Remove");
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
