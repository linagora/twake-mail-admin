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
import com.microsoft.playwright.Request;

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
        assertThat(dialog.getByRole(com.microsoft.playwright.options.AriaRole.HEADING)).hasText("Rename user");
        assertThat(dialog).containsText("Current username: " + ren1);
        assertThat(dialog).containsText("The new username must be an existing account: renaming only migrates "
            + "the data of the current user to it.");
        Locator newUsername = dialog.getByLabel("New username", new Locator.GetByLabelOptions().setExact(true));
        assertThat(newUsername).isVisible();
        // Force and resume are for recovering a failed rename: tucked away
        Locator force = dialog.getByLabel("Force", new Locator.GetByLabelOptions().setExact(true));
        assertThat(force).isHidden();
        detail.openAdvanced("Advanced options");
        assertThat(force).isVisible();
        assertThat(dialog.getByLabel("Resume from step", new Locator.GetByLabelOptions().setExact(true))).isVisible();
        assertThat(detail.commandPreview()).hasText("Command: curl -XPOST /users/" + ren1 + "/rename/{newUser}?action=rename");

        detail.clickStartTask();
        assertThat(app.dialogError()).hasText("New username is required");
        assertThat(app.dialog()).isVisible();
        assertThat(renameCalls).isEmpty();

        newUsername.fill(ren2);
        detail.startTask();
        JsonNode task = webAdmin.awaitTask(detail.taskIdFromToast("Task created"));
        assertThat(task.path("status").asText()).as(task.toString()).isEqualTo("completed");
        assertThat(task.path("type").asText()).isEqualTo("UsernameChangeTask");
        Awaitility.await().atMost(Duration.ofSeconds(20)).untilAsserted(() ->
            assertThat(webAdmin.get("/users/" + ren2 + "/mailboxes").expect(200).body()).contains("Renamed-box"));

        String ghost = "ghost-" + ren1;
        dialog = tasks.run("Rename user");
        newUsername.fill(ghost);
        detail.clickStartTask();
        assertThat(app.dialogError()).containsText("'newUser' parameter should be an existing user");
        assertThat(app.dialogError()).not().containsText("{");
        assertThat(app.dialog()).isVisible();
        assertThat(newUsername).hasValue(ghost);
        app.cancel();
    }

    @Test
    @DisplayName("UDT-20 Delete all mailboxes")
    void deleteAllMailboxes(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin, Page page) {
        String user = fixtures.newUser("delmbx");
        webAdmin.put("/users/" + user + "/mailboxes/INBOX").expect(204);
        webAdmin.put("/users/" + user + "/mailboxes/Work").expect(204);
        // Another user of the same domain, who must keep its mailboxes
        String bystander = withTwoMailboxes(webAdmin, fixtures.newUser("keep"));

        MailUserDetailPage detail = new MailUserDetailPage(app).open(user);
        detail.tasks().open().run("Delete all mailboxes");
        assertThat(app.dialog()).containsText("Are you sure you want to delete ALL mailboxes for \"" + user
            + "\"? This cannot be undone.");
        assertThat(app.dialog()).containsText("Every mailbox of " + user + " and all the messages they contain are permanently "
            + "deleted. This cannot be undone.");
        // Typing the username (in any case) is required first
        Locator delete = detail.dialogButton("Delete all mailboxes");
        assertThat(delete).isDisabled();
        app.dialog().getByLabel("Type " + user + " to confirm", new Locator.GetByLabelOptions().setExact(true)).fill(user.toUpperCase());
        assertThat(delete).isEnabled();
        Request sent = page.waitForRequest(
            request -> request.method().equals("DELETE") && request.url().contains("/mailboxes"), delete::click);
        assertThat(sent.url()).endsWith("/users/" + user.replace("@", "%40") + "/mailboxes");
        app.expectToast("All mailboxes deleted successfully");
        assertThat(webAdmin.get("/users/" + user + "/mailboxes").expect(200).json().size()).isZero();
        assertThat(webAdmin.get("/users/" + bystander + "/mailboxes").expect(200).json().size()).isEqualTo(2);
    }

    @Test
    @DisplayName("UDT-20 Delete user data")
    void deleteUserData(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin, Page page) {
        String user = fixtures.newUser("deldata");
        webAdmin.put("/users/" + user + "/mailboxes/INBOX").expect(204);
        // Another user of the same domain, who must keep its data
        String bystander = withTwoMailboxes(webAdmin, fixtures.newUser("keep"));

        MailUserDetailPage detail = new MailUserDetailPage(app).open(user);
        Locator dialog = detail.tasks().open().run("Delete user data");
        assertThat(dialog.getByRole(com.microsoft.playwright.options.AriaRole.HEADING)).hasText("Delete all data of " + user);
        assertThat(dialog).containsText("All mailboxes, messages, identities, labels, vacation and settings of " + user
            + " are permanently deleted. The account itself is kept. This cannot be undone.");
        detail.openAdvanced("Advanced: resume an interrupted deletion");
        assertThat(dialog.getByLabel("Resume from step", new Locator.GetByLabelOptions().setExact(true))).hasValue("");
        assertThat(detail.commandPreview()).hasText(Pattern.compile("action=deleteData$"));
        Locator delete = detail.dialogButton("Delete user data");
        assertThat(delete).isDisabled();
        dialog.getByLabel("Type " + user + " to confirm", new Locator.GetByLabelOptions().setExact(true)).fill(user);
        Request sent = page.waitForRequest(
            request -> request.method().equals("POST") && request.url().contains("action=deleteData"), delete::click);
        assertThat(sent.url()).endsWith("/users/" + user.replace("@", "%40") + "?action=deleteData");
        JsonNode task = webAdmin.awaitTask(detail.taskIdFromToast("Task created"));
        assertThat(task.path("status").asText()).as(task.toString()).isEqualTo("completed");
        assertThat(task.path("type").asText()).isEqualTo("DeleteUserDataTask");
        assertThat(webAdmin.get("/users/" + user + "/mailboxes").expect(200).json().size()).isZero();
        assertThat(webAdmin.get("/users/" + bystander + "/mailboxes").expect(200).json().size()).isEqualTo(2);
    }

    /** Gives the user an INBOX and a Work mailbox. */
    private static String withTwoMailboxes(WebAdmin webAdmin, String user) {
        webAdmin.put("/users/" + user + "/mailboxes/INBOX").expect(204);
        webAdmin.put("/users/" + user + "/mailboxes/Work").expect(204);
        return user;
    }
}
