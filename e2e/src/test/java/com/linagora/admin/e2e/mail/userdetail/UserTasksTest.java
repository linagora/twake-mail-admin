package com.linagora.admin.e2e.mail.userdetail;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.LinkedHashMap;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.userdetail.MailUserDetailPage;
import com.linagora.admin.e2e.pages.mail.userdetail.UserTasksSection;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Request;
import com.microsoft.playwright.options.AriaRole;

class UserTasksTest extends MailAdminE2ETest {

    @Test
    @DisplayName("UDT-17 User tasks: every dialog previews its curl command")
    void taskDialogsPreviewTheirCommand(AdminApp app, MailFixtures fixtures) {
        String user = fixtures.newUser("tasks");
        MailUserDetailPage detail = new MailUserDetailPage(app).open(user);
        UserTasksSection tasks = detail.tasks().open();

        assertThat(tasks.labels()).hasText(UserTasksSection.ROWS.toArray(String[]::new));
        assertThat(tasks.tooltip("Subscribe to all mailboxes", "curl -XPOST /users/" + user + "/mailboxes?task=subscribeAll")).isVisible();
        assertThat(tasks.tooltip("Delete all mailboxes", "curl -XDELETE /users/" + user + "/mailboxes")).isVisible();

        Map<String, String> commands = new LinkedHashMap<>();
        commands.put("Reindex all mailboxes", "curl -XPOST /users/" + user + "/mailboxes?task=reIndex&messagesPerSecond=50");
        commands.put("Subscribe to all mailboxes", "curl -XPOST /users/" + user + "/mailboxes?task=subscribeAll");
        commands.put("Recompute JMAP fast view projection",
            "curl -XPOST /users/" + user + "/mailboxes?task=recomputeFastViewProjectionItems&messagesPerSecond=10");
        commands.put("Restore deleted messages", "curl -XPOST /deletedMessages/users/" + user
            + "?action=restore -d '{\"combinator\":\"and\",\"criteria\":[]}'");
        commands.put("Cleanup user Trash folder", "curl -XDELETE \"/messages?olderThan=5d&mailbox=Trash&user=" + user + "&useSavedDate\"");
        commands.put("Cleanup user Spam folder", "curl -XDELETE \"/messages?olderThan=5d&mailbox=Spam&user=" + user + "&useSavedDate\"");
        commands.put("Provision templates", "curl -XPOST /users/" + user + "/templates?action=provision&from={sourceUser}");
        commands.put("Tier user data", "curl -XPOST /users/" + user + "/data?tiering=30d&messagesPerSecond=50");
        commands.put("Rename user", "curl -XPOST /users/" + user + "/rename/{newUser}?action=rename");
        commands.put("Delete all mailboxes", "curl -XDELETE /users/" + user + "/mailboxes");
        commands.put("Delete user data", "curl -XPOST /users/" + user + "?action=deleteData");
        assertThat(commands.keySet()).containsExactlyElementsOf(UserTasksSection.ROWS);

        commands.forEach((label, command) -> {
            tasks.run(label);
            assertThat(detail.commandPreview()).hasText("Command: " + command);
            switch (label) {
                case "Provision templates" -> {
                    String domain = user.substring(user.indexOf('@') + 1);
                    Locator source = app.dialog().getByLabel("Source user", new Locator.GetByLabelOptions().setExact(true));
                    Locator folder = app.dialog().getByLabel("Folder name", new Locator.GetByLabelOptions().setExact(true));
                    Locator startTask = detail.dialogButton("Start task");
                    // WebAdmin refuses a source of another domain and a folder other than Templates (400)
                    source.fill("alice@other.example");
                    assertThat(app.dialog()).containsText("The source account must belong to " + domain);
                    assertThat(startTask).isDisabled();
                    source.fill("alice@" + domain);
                    folder.fill("INBOX");
                    assertThat(app.dialog()).containsText("The folder must be Templates or one of its sub-folders");
                    assertThat(startTask).isDisabled();
                    folder.fill(" Templates.Marketing ");
                    assertThat(startTask).isEnabled();
                    assertThat(detail.commandPreview()).hasText("Command: curl -XPOST /users/" + user
                        + "/templates?action=provision&from=alice@" + domain + "&folderName=Templates.Marketing");
                }
                case "Rename user" -> {
                    app.dialog().getByLabel("New username", new Locator.GetByLabelOptions().setExact(true)).fill("x@example.com");
                    detail.openAdvanced("Advanced options");
                    app.dialog().getByLabel("Force", new Locator.GetByLabelOptions().setExact(true)).check();
                    assertThat(detail.commandPreview()).hasText("Command: curl -XPOST /users/" + user
                        + "/rename/x@example.com?action=rename&force");
                }
                case "Delete user data" -> {
                    detail.openAdvanced("Advanced: resume an interrupted deletion");
                    app.dialog().getByLabel("Resume from step", new Locator.GetByLabelOptions().setExact(true)).fill("MailboxUserDeletionTaskStep");
                    assertThat(detail.commandPreview()).hasText("Command: curl -XPOST /users/" + user
                        + "?action=deleteData&fromStep=MailboxUserDeletionTaskStep");
                }
                default -> {
                }
            }
            app.cancel();
        });
    }

    @Test
    @DisplayName("UDT-17 User tasks: reindex, subscribe all, recompute fast view")
    void reindexSubscribeAllRecomputeFastView(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin, Page page) {
        String user = fixtures.newUser("tasks");
        webAdmin.put("/users/" + user + "/mailboxes/INBOX").expect(204);
        MailUserDetailPage detail = new MailUserDetailPage(app).open(user);
        UserTasksSection tasks = detail.tasks().open();

        Locator dialog = tasks.run("Reindex all mailboxes");
        assertThat(dialog.getByRole(AriaRole.HEADING)).hasText("Reindex all mailboxes");
        // Parameters in plain language, the raw key next to them
        assertThat(param(dialog, "Speed limit")).hasValue("50");
        assertThat(dialog).containsText("messages/s");
        param(dialog, "Reindex mode").click();
        page.getByRole(AriaRole.OPTION, new Page.GetByRoleOptions().setName("Fix outdated documents only").setExact(true)).click();
        assertThat(detail.commandPreview()).hasText("Command: curl -XPOST /users/" + user
            + "/mailboxes?task=reIndex&messagesPerSecond=50&mode=fixOutdated");
        Request reindex = page.waitForRequest(request -> request.url().contains("task=reIndex"), detail::startTask);
        assertThat(reindex.url()).contains("mode=fixOutdated").contains("messagesPerSecond=50");
        expectCompleted(webAdmin, detail.taskIdFromToast("Task created"));

        tasks.run("Subscribe to all mailboxes");
        detail.startTask();
        expectCompleted(webAdmin, detail.taskIdFromToast("Task created"));

        tasks.run("Recompute JMAP fast view projection");
        detail.startTask();
        expectCompleted(webAdmin, detail.taskIdFromToast("Task created"));
    }

    @Test
    @DisplayName("UDT-18 User tasks: cleanup Trash / Spam, tier data")
    void cleanupTrashSpamAndTierData(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin) {
        String user = fixtures.newUser("tasks");
        webAdmin.put("/users/" + user + "/mailboxes/INBOX").expect(204);
        webAdmin.put("/users/" + user + "/mailboxes/Trash").expect(204);
        webAdmin.put("/users/" + user + "/mailboxes/Spam").expect(204);
        MailUserDetailPage detail = new MailUserDetailPage(app).open(user);
        UserTasksSection tasks = detail.tasks().open();

        for (String folder : new String[] {"Trash", "Spam"}) {
            Locator dialog = tasks.run("Cleanup user " + folder + " folder");
            assertThat(param(dialog, "Older than")).hasValue("5d");
            detail.startTask();
            expectCompleted(webAdmin, detail.taskIdFromToast("Task created"));
        }

        Locator dialog = tasks.run("Tier user data");
        Locator amount = param(dialog, "Messages older than");
        assertThat(amount).hasValue("30");
        assertThat(dialog.getByRole(AriaRole.COMBOBOX, new Locator.GetByRoleOptions().setName("Messages older than unit"))).hasText("Days");
        assertThat(detail.commandPreview()).hasText("Command: curl -XPOST /users/" + user + "/data?tiering=30d&messagesPerSecond=50");
        detail.startTask();
        expectCompleted(webAdmin, detail.taskIdFromToast("Task created"));

        dialog = tasks.run("Tier user data");
        amount = param(dialog, "Messages older than");
        amount.fill("");
        detail.clickStartTask();
        assertThat(app.dialogError()).hasText("Retention period is required");
        assertThat(app.dialog()).isVisible();
        assertThat(param(dialog, "Speed limit")).hasValue("50");
        amount.fill("7");
        assertThat(app.dialogError()).hasCount(0);
        assertThat(detail.commandPreview()).hasText("Command: curl -XPOST /users/" + user + "/data?tiering=7d&messagesPerSecond=50");
        app.cancel();
    }

    /** A parameter of a task dialog, by its plain-language label ("Speed limit", optionally followed by "(optional)"). */
    private static Locator param(Locator dialog, String label) {
        return dialog.getByLabel(java.util.regex.Pattern.compile("^" + com.linagora.admin.e2e.pages.mail.userdetail.Regex.escape(label)
            + "( \\(optional\\)| \\*)?$"));
    }

    private static void expectCompleted(WebAdmin webAdmin, String taskId) {
        JsonNode task = webAdmin.awaitTask(taskId);
        assertThat(task.path("status").asText()).as(task.toString()).isEqualTo("completed");
    }
}
