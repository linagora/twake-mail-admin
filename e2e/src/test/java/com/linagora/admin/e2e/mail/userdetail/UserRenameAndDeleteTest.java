package com.linagora.admin.e2e.mail.userdetail;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.regex.Pattern;

import org.awaitility.Awaitility;
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

class UserRenameAndDeleteTest extends MailAdminE2ETest {

    @Test
    @DisplayName("UDT-19 Rename a user")
    void renameUser(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin, Page page) {
        String ren1 = fixtures.newUser("ren1");
        String ren2 = fixtures.newUser("ren2");
        webAdmin.put("/users/" + ren1 + "/mailboxes/INBOX").expect(204);
        webAdmin.put("/users/" + ren1 + "/mailboxes/Renamed-box").expect(204);
        List<String> renameCalls = new CopyOnWriteArrayList<>();
        page.onRequest(request -> {
            if (request.url().contains("/rename/")) {
                renameCalls.add(request.url());
            }
        });

        MailUserDetailPage detail = new MailUserDetailPage(app).open(ren1);
        UserTasksSection tasks = detail.tasks().open();
        Locator dialog = tasks.run("Rename user");
        assertThat(dialog.getByRole(com.microsoft.playwright.options.AriaRole.HEADING)).hasText("Rename User");
        assertThat(dialog).containsText("Current username: " + ren1);
        assertThat(dialog).containsText("The new username must be an existing account: renaming only migrates "
            + "the data of the current user to it.");
        assertThat(dialog.getByLabel("New username:")).isVisible();
        assertThat(dialog.getByLabel("Force")).isVisible();
        assertThat(dialog.getByLabel("Resume from step:")).isVisible();
        assertThat(detail.commandPreview()).hasText("Command: curl -XPOST /users/" + ren1 + "/rename/{newUser}?action=rename");

        app.clickConfirm();
        assertThat(app.dialogError()).hasText("New username is required");
        assertThat(app.dialog()).isVisible();
        assertThat(renameCalls).isEmpty();

        dialog.getByLabel("New username:").fill(ren2);
        app.confirm();
        JsonNode task = webAdmin.awaitTask(detail.taskIdFromToast("Task created"));
        assertThat(task.path("status").asText()).as(task.toString()).isEqualTo("completed");
        assertThat(task.path("type").asText()).isEqualTo("UsernameChangeTask");
        Awaitility.await().atMost(Duration.ofSeconds(20)).untilAsserted(() ->
            assertThat(webAdmin.get("/users/" + ren2 + "/mailboxes").expect(200).body()).contains("Renamed-box"));

        String ghost = "ghost-" + ren1;
        dialog = tasks.run("Rename user");
        dialog.getByLabel("New username:").fill(ghost);
        app.clickConfirm();
        assertThat(app.dialogError()).containsText("'newUser' parameter should be an existing user");
        assertThat(app.dialogError()).not().containsText("{");
        assertThat(app.dialog()).isVisible();
        assertThat(dialog.getByLabel("New username:")).hasValue(ghost);
        app.cancel();
    }

    @Test
    @DisplayName("UDT-20 Delete all mailboxes")
    void deleteAllMailboxes(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin) {
        String user = fixtures.newUser("delmbx");
        webAdmin.put("/users/" + user + "/mailboxes/INBOX").expect(204);
        webAdmin.put("/users/" + user + "/mailboxes/Work").expect(204);

        MailUserDetailPage detail = new MailUserDetailPage(app).open(user);
        detail.tasks().open().run("Delete all mailboxes");
        assertThat(app.dialog()).containsText("Are you sure you want to delete ALL mailboxes for \"" + user
            + "\"? This cannot be undone.");
        app.confirm();
        app.expectToast("All mailboxes deleted successfully");
        assertThat(webAdmin.get("/users/" + user + "/mailboxes").expect(200).json().size()).isZero();
    }

    @Test
    @DisplayName("UDT-20 Delete user data")
    void deleteUserData(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin) {
        String user = fixtures.newUser("deldata");
        webAdmin.put("/users/" + user + "/mailboxes/INBOX").expect(204);

        MailUserDetailPage detail = new MailUserDetailPage(app).open(user);
        Locator dialog = detail.tasks().open().run("Delete user data");
        assertThat(dialog.getByLabel("Resume from step:")).hasValue("");
        assertThat(detail.commandPreview()).hasText(Pattern.compile("action=deleteData$"));
        app.confirm();
        JsonNode task = webAdmin.awaitTask(detail.taskIdFromToast("Task created"));
        assertThat(task.path("status").asText()).as(task.toString()).isEqualTo("completed");
        assertThat(task.path("type").asText()).isEqualTo("DeleteUserDataTask");
        assertThat(webAdmin.get("/users/" + user + "/mailboxes").expect(200).json().size()).isZero();
    }
}
