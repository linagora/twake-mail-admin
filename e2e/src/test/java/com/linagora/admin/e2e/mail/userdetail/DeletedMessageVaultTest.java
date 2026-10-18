package com.linagora.admin.e2e.mail.userdetail;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.regex.Pattern;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.userdetail.Regex;
import com.linagora.admin.e2e.pages.mail.userdetail.CriteriaBuilder;
import com.linagora.admin.e2e.pages.mail.userdetail.DeletedVaultSection;
import com.linagora.admin.e2e.pages.mail.userdetail.MailUserDetailPage;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Request;
import com.microsoft.playwright.options.AriaRole;

class DeletedMessageVaultTest extends MailAdminE2ETest {

    @Test
    @DisplayName("UDT-15 Deleted message vault: search and restore")
    void searchAndRestore(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin) {
        String user = fixtures.newUser("vault");
        // A deleted message: in this environment the deletion dead-letters instead of reaching the vault
        webAdmin.put("/users/" + user + "/mailboxes/INBOX").expect(204);
        fixtures.sendMail("sender@e2e.test", user, "Quarterly report", "numbers");
        org.awaitility.Awaitility.await().atMost(java.time.Duration.ofSeconds(30))
            .until(() -> fixtures.messageCount(user, "INBOX") == 1);
        JsonNode clear = webAdmin.runTask("DELETE", "/users/" + user + "/mailboxes/INBOX/messages", null);
        assertThat(clear.path("status").asText()).isEqualTo("completed");
        // The vault may or may not get the message: this environment dead-letters part of the
        // DeletedMessageVaultListenerGroup events. The test holds whatever the vault answers.

        MailUserDetailPage detail = new MailUserDetailPage(app).open(user);
        DeletedVaultSection vault = detail.deletedVault().open();

        vault.searchButton().click();
        assertThat(vault.found()).isVisible();
        assertThat(vault.table().getByRole(AriaRole.COLUMNHEADER)).hasText(new String[] {
            "#", "Subject", "Sender", "Recipients", "Delivery date", "Deletion date", "Attachment", "Size",
            "Message ID", "Actions"});

        CriteriaBuilder criteria = vault.criteria();
        criteria.addCriterion().field(0, "Subject").operator(0, "Contains");
        criteria.textValues().first().fill("Lunch");
        vault.searchButton().click();
        assertThat(vault.found()).hasText("0 message(s) found");
        assertThat(app.main().getByText("No messages match the criteria.")).isVisible();

        criteria.textValues().first().fill("Quarterly");
        vault.searchButton().click();
        assertThat(vault.found()).hasText(java.util.regex.Pattern.compile("^[01] message\\(s\\) found$"));
        String found = vault.found().textContent();
        String count = found.substring(0, found.indexOf(' '));

        vault.restoreButton().click();
        assertThat(app.dialog()).containsText("Restore " + count + " message(s) for " + user
            + "? This will enqueue a background task.");
        app.confirm();
        String taskId = detail.taskIdFromToast("Restore task started");
        JsonNode task = webAdmin.awaitTask(taskId);
        assertThat(task.path("status").asText()).as(task.toString()).isEqualTo("completed");
        // Whatever the vault held is back in the user's mailboxes
        int restored = task.path("additionalInformation").path("successfulRestoreCount").asInt();
        assertThat(restored).as(task.toString()).isEqualTo(Integer.parseInt(count));
        if (restored > 0) {
            org.awaitility.Awaitility.await().atMost(java.time.Duration.ofSeconds(20)).until(() ->
                fixtures.messageCount(user, "Restored-Messages") == restored);
        }
    }

    @Test
    @DisplayName("UDT-26 Deleted Message Vault: incomplete criteria block Search and Restore")
    void incompleteCriteriaBlockSearchAndRestore(AdminApp app, MailFixtures fixtures, Page page) {
        String user = fixtures.newUser("vault");
        MailUserDetailPage detail = new MailUserDetailPage(app).open(user);
        DeletedVaultSection vault = detail.deletedVault().open();
        CriteriaBuilder criteria = vault.criteria();

        assertThat(vault.searchButton()).isEnabled();
        assertThat(vault.restoreButton()).isEnabled();

        criteria.addCriterion();
        assertThat(criteria.incompleteMessage()).isVisible();
        assertThat(vault.searchButton()).isDisabled();
        assertThat(vault.restoreButton()).isDisabled();

        criteria.field(0, "Subject").operator(0, "Contains");
        assertThat(criteria.incompleteMessage()).isVisible();
        assertThat(vault.searchButton()).isDisabled();
        assertThat(vault.restoreButton()).isDisabled();

        criteria.textValues().first().fill("Quarterly");
        assertThat(criteria.incompleteMessage()).isHidden();
        assertThat(vault.searchButton()).isEnabled();
        assertThat(vault.restoreButton()).isEnabled();
        Request search = page.waitForRequest(
            request -> request.method().equals("POST") && request.url().contains("/deletedMessages/users/"),
            () -> vault.searchButton().click());
        assertThat(search.postData())
            .contains("{\"fieldName\":\"subject\",\"operator\":\"contains\",\"value\":\"Quarterly\"}")
            .doesNotContain("\"criteria\":[]");
        assertThat(vault.found()).isVisible();

        // hasAttachment is complete as soon as its operator is chosen (value false)
        criteria.addCriterion().field(1, "Has attachment").operator(1, "Equals");
        assertThat(criteria.checkboxValues()).not().isChecked();
        assertThat(criteria.incompleteMessage()).isHidden();
        assertThat(vault.searchButton()).isEnabled();

        criteria.addCriterion();
        assertThat(criteria.incompleteMessage()).isVisible();
        assertThat(vault.searchButton()).isDisabled();
        criteria.removeButtons().nth(2).click();
        assertThat(criteria.fields()).hasCount(2);
        assertThat(criteria.incompleteMessage()).isHidden();
        assertThat(vault.searchButton()).isEnabled();
        assertThat(vault.restoreButton()).isEnabled();
    }

    @Test
    @DisplayName("UDT-26 Restore deleted messages task: an incomplete criterion keeps the dialog open")
    void incompleteCriteriaInRestoreTaskDialog(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin, Page page) {
        String user = fixtures.newUser("vault");
        MailUserDetailPage detail = new MailUserDetailPage(app).open(user);
        List<String> restoreCalls = new CopyOnWriteArrayList<>();
        page.onRequest(request -> {
            if (request.method().equals("POST") && request.url().contains("/deletedMessages/users/")) {
                restoreCalls.add(request.postData());
            }
        });

        detail.tasks().open().run("Restore deleted messages");
        CriteriaBuilder criteria = new CriteriaBuilder(page, app.dialog());
        assertThat(detail.commandPreview()).hasText("Command: curl -XPOST /deletedMessages/users/" + user
            + "?action=restore -d '{\"combinator\":\"and\",\"criteria\":[]}'");

        criteria.addCriterion();
        app.clickConfirm();
        assertThat(app.dialog()).isVisible();
        assertThat(app.dialog().getByText(CriteriaBuilder.INCOMPLETE)).hasCount(1);
        assertThat(criteria.incompleteMessage()).isVisible();

        criteria.field(0, "Subject").operator(0, "Contains");
        criteria.textValues().first().fill("Quarterly");
        assertThat(criteria.incompleteMessage()).isHidden();
        assertThat(detail.commandPreview()).hasText(Pattern.compile(Regex.escape(
            "\"criteria\":[{\"fieldName\":\"subject\",\"operator\":\"contains\",\"value\":\"Quarterly\"}]")));
        assertThat(restoreCalls).isEmpty();

        app.confirm();
        String taskId = detail.taskIdFromToast("Task created");
        assertThat(restoreCalls).hasSize(1);
        assertThat(restoreCalls.get(0)).contains("\"value\":\"Quarterly\"");
        assertThat(webAdmin.awaitTask(taskId).path("status").asText()).isEqualTo("completed");
    }
}
