package com.linagora.admin.e2e.mail.ops;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.ResourceLock;

import com.fasterxml.jackson.databind.JsonNode;
import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.docker.Locks;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.ops.CommonTasksPage;
import com.linagora.admin.e2e.pages.mail.ops.Dialogs;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Response;
import com.microsoft.playwright.options.AriaRole;

/**
 * Server wide maintenance tasks. The stack holds the users of every other test, so the tasks
 * rate limited per user or per message (1 user/s...) would hold the single task worker of
 * tmail-backend for minutes: once WebAdmin has accepted them, the test cancels them.
 */
@ResourceLock(Locks.MAIL_SERVER_TASKS)
@ResourceLock(Locks.MAIL_TASKS)
class CommonTasksTest extends MailAdminE2ETest {
    private static final List<String> TASK_NAMES = List.of(
        "Reindex all data in OpenSearch (fix outdated mode)", "Reindex all data in OpenSearch (reindex all mode)",
        "Per user reindexing (one task per user)", "Fix mailbox inconsistencies", "Fix message inconsistencies",
        "Recompute mailbox counters", "Recompute mailbox quota", "Fix mapping denormalization", "Cleanup JMAP uploads",
        "Blob garbage collection", "Reindex contacts from sent mailbox", "Purge Deleted Messages",
        "Populate Email Query View", "Reload certificates", "Reposition system rights on all Team Mailbox folders",
        "Cleanup Trash folder (all users)", "Cleanup Spam folder (all users)", "Cleaning up old tasks");

    /** Starts the task of the open dialog and returns the WebAdmin answer to the request it sends. */
    private static Response confirmTask(AdminApp app, String method, String pathPrefix) {
        return confirmTask(app, method, pathPrefix, Dialogs.START_TASK);
    }

    private static Response confirmTask(AdminApp app, String method, String pathPrefix, String confirmLabel) {
        Response response = app.page().waitForResponse(
            r -> r.request().method().equals(method) && r.url().contains(pathPrefix), () -> Dialogs.confirmWith(app, confirmLabel));
        assertThat(response.status()).isEqualTo(201);
        return response;
    }

    /** The path and query of a request, as sent by the browser. */
    private static String pathOf(Response response) {
        String url = response.url();
        return url.substring(url.indexOf('/', url.indexOf("://") + 3));
    }

    private static String taskIdOf(Response response) {
        try {
            return WebAdmin.JSON.readTree(response.text()).path("taskId").asText();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static void expectTaskToast(AdminApp app, String taskId) {
        // The toast names the task and leads to its page
        assertThat(app.toast("Task created").locator("a[href='/task/" + taskId + "']")).hasText(AdminApp.TASK_TOAST_LINK);
    }

    @Test
    @DisplayName("CT-01 Run a common task with parameters")
    void runCommonTaskWithParameters(AdminApp app, Page page, WebAdmin webAdmin) {
        app.open("/");
        app.navigate("Common Tasks");
        CommonTasksPage commonTasks = new CommonTasksPage(app);
        for (String name : TASK_NAMES) {
            assertThat(commonTasks.label(name)).isVisible();
            assertThat(commonTasks.runButton(name)).isVisible();
        }
        assertThat(app.main().getByPlaceholder("port (optional)")).isVisible();
        assertThat(app.main().getByLabel("days", new Locator.GetByLabelOptions().setExact(true))).hasValue("30");

        // Grouped by purpose
        assertThat(commonTasks.group("Search index").getByText("Reindex all data in OpenSearch (fix outdated mode)")).isVisible();
        assertThat(commonTasks.group("Consistency repair").getByText("Recompute mailbox counters")).isVisible();
        assertThat(commonTasks.group("Cleanup").getByText("Blob garbage collection")).isVisible();
        assertThat(commonTasks.group("Server").getByText("Reload certificates")).isVisible();
        // Each task says when to use it, and how much it changes
        assertThat(commonTasks.description("Recompute mailbox counters"))
            .hasText("Use when the unread or total counts of mailboxes look wrong. Recounts every mailbox.");
        assertThat(commonTasks.riskBadge("Recompute mailbox counters")).hasCount(0);
        assertThat(commonTasks.riskBadge("Fix mailbox inconsistencies")).hasText("Modifies data");
        // Only unreferenced or expired data: run with care, without a word to type
        assertThat(commonTasks.riskBadge("Blob garbage collection")).hasText("Modifies data");
        assertThat(commonTasks.riskBadge("Purge Deleted Messages")).hasText("Modifies data");
        // The filter matches the names and the descriptions
        commonTasks.filter().fill("unread");
        assertThat(commonTasks.label("Recompute mailbox counters")).isVisible();
        assertThat(commonTasks.label("Blob garbage collection")).hasCount(0);
        commonTasks.filter().fill("");
        assertThat(commonTasks.label("Blob garbage collection")).isVisible();

        commonTasks.run("Recompute mailbox counters");
        // The dialog is titled after its task and repeats its description
        assertThat(app.dialog().getByRole(AriaRole.HEADING)).hasText("Recompute mailbox counters");
        assertThat(app.dialog().getByText("Use when the unread or total counts of mailboxes look wrong. Recounts every mailbox.",
            new Locator.GetByTextOptions().setExact(true))).isVisible();
        assertThat(commonTasks.param("trustMessageProjection")).not().isChecked();
        assertThat(commonTasks.param("trustMessageProjection")).hasAttribute("role", "checkbox");
        assertThat(commonTasks.commandPreview()).hasText("Command: curl -XPOST /mailboxes?task=RecomputeMailboxCounters");
        Response response = confirmTask(app, "POST", "/mailboxes?");
        assertThat(pathOf(response)).isEqualTo("/mailboxes?task=RecomputeMailboxCounters");
        String taskId = taskIdOf(response);

        Locator toastLink = app.toast("Task created").locator("a[href='/task/" + taskId + "']");
        assertThat(toastLink).hasText("Recompute mailbox counters — Task " + taskId.substring(0, 8));
        toastLink.click();
        assertThat(page).hasURL(Pattern.compile("/task/" + taskId + "$"));
        JsonNode task = webAdmin.awaitTask(taskId);
        assertThat(task.path("status").asText()).isEqualTo("completed");
        app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Refresh").setExact(true)).click();
        // A readable summary: status, type, then the details of the task; the raw JSON on demand
        assertThat(app.main().getByText("Completed", new Locator.GetByTextOptions().setExact(true)).first()).isVisible();
        assertThat(app.main().getByText("recompute-mailbox-counters", new Locator.GetByTextOptions().setExact(true)).first()).isVisible();
        assertThat(app.main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setName("Details").setExact(true))).isVisible();
        assertThat(app.main().getByText("Processed mailboxes", new Locator.GetByTextOptions().setExact(true))).isVisible();
        app.main().getByText("Raw JSON", new Locator.GetByTextOptions().setExact(true)).click();
        Locator raw = app.main().locator("details pre");
        assertThat(raw).isVisible();
        assertThat(raw).containsText("\"status\": \"completed\"");
        assertThat(raw).containsText("\"processedMailboxes\"");
    }

    private record CommonTask(String name, String description, String preview, String method, String request, boolean rateLimited) {
    }

    @Test
    @DisplayName("CT-02 Other common tasks")
    void otherCommonTasks(AdminApp app, WebAdmin webAdmin) {
        List<CommonTask> commonTasks = List.of(
            new CommonTask("Recompute mailbox quota", "Use when a user's quota usage looks wrong. Recounts every user's usage.", "curl -XPOST /quota/users?task=RecomputeCurrentQuotas&usersPerSecond=1",
                "POST", "/quota/users?task=RecomputeCurrentQuotas&usersPerSecond=1", true),
            new CommonTask("Fix mailbox inconsistencies", "Use when mailboxes are missing, duplicated or cannot be opened. Every other service must be stopped first.", "curl -XPOST /mailboxes?task=SolveInconsistencies&maxIterations=5",
                "POST", "/mailboxes?task=SolveInconsistencies&maxIterations=5", false),
            new CommonTask("Fix mapping denormalization", "Use when an alias or forward is ignored although it is listed. Rewrites the mapping lookup tables.", "curl -XPOST /cassandra/mappings?action=SolveInconsistencies",
                "POST", "/cassandra/mappings?action=SolveInconsistencies", false),
            new CommonTask("Cleanup JMAP uploads", "Deletes expired JMAP uploads: attachments sent to the server but never used in a mail.", "curl -XDELETE /jmap/uploads?scope=expired",
                "DELETE", "/jmap/uploads?scope=expired", false),
            new CommonTask("Purge Deleted Messages", "Permanently deletes the messages of the Deleted Messages Vault whose retention period is over.", "curl -XDELETE /deletedMessages?scope=expired",
                "DELETE", "/deletedMessages?scope=expired", false),
            new CommonTask("Populate Email Query View", "Use after enabling the email query view. Fills it from the existing messages; moderate load.", "curl -XPOST /mailboxes?task=populateEmailQueryView&messagesPerSecond=10",
                "POST", "/mailboxes?task=populateEmailQueryView&messagesPerSecond=10", true),
            new CommonTask("Reindex contacts from sent mailbox", "Fills the recipient autocompletion of every user from the mails they sent.", "curl -XPOST /mailboxes?task=ContactIndexing&usersPerSecond=1",
                "POST", "/mailboxes?task=ContactIndexing&usersPerSecond=1", true),
            new CommonTask("Reindex all data in OpenSearch (fix outdated mode)", "Use when searches miss recent mails. Reindexes only outdated documents; moderate load.", "curl -XPOST /mailboxes?task=reIndex&mode=fixOutdated&messagesPerSecond=50",
                "POST", "/mailboxes?task=reIndex&mode=fixOutdated&messagesPerSecond=50", true));

        CommonTasksPage page = CommonTasksPage.open(app);
        List<String> started = new ArrayList<>();
        try {
            for (CommonTask commonTask : commonTasks) {
                page.run(commonTask.name());
                assertThat(app.dialog().getByRole(AriaRole.HEADING)).hasText(commonTask.name());
                assertThat(app.dialog().getByText(commonTask.description(), new Locator.GetByTextOptions().setExact(true))).isVisible();
                assertThat(page.commandPreview()).hasText("Command: " + commonTask.preview());
                String path = commonTask.request().substring(0, commonTask.request().indexOf('?') + 1);
                if (commonTask.name().equals("Purge Deleted Messages")) {
                    // The consequence is spelled out, no word to type
                    assertThat(app.dialog()).containsText("can no longer be restored");
                    assertThat(Dialogs.typeToConfirmField(app)).hasCount(0);
                }
                Response response = confirmTask(app, commonTask.method(), path);
                assertThat(pathOf(response)).isEqualTo(commonTask.request());
                String taskId = taskIdOf(response);
                started.add(taskId);
                expectTaskToast(app, taskId);
                if (commonTask.rateLimited()) {
                    assertThat(OpsBackend.cancelIfRunning(webAdmin, taskId).path("status").asText())
                        .as(commonTask.name()).isIn("completed", "canceled");
                }
            }
            for (int i = 0; i < commonTasks.size(); i++) {
                if (!commonTasks.get(i).rateLimited()) {
                    JsonNode task = webAdmin.awaitTask(started.get(i));
                    assertThat(task.path("status").asText()).as(commonTasks.get(i).name() + ": " + task).isEqualTo("completed");
                }
            }
        } finally {
            started.forEach(taskId -> OpsBackend.cancelIfRunning(webAdmin, taskId));
        }
    }

    @Test
    @DisplayName("CT-03 Per user reindexing")
    void perUserReindexing(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin) {
        String user = fixtures.newUser();

        CommonTasksPage page = CommonTasksPage.open(app);
        page.run("Per user reindexing (one task per user)");
        // WebAdmin schedules the task of every user before answering: give it time
        Response response = app.page().waitForResponse(
            r -> r.request().method().equals("POST") && r.url().contains("/users?action=reindex"),
            new Page.WaitForResponseOptions().setTimeout(90_000), () -> Dialogs.clickWith(app, Dialogs.START_TASK));
        JsonNode body;
        try {
            body = WebAdmin.JSON.readTree(response.text());
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
        JsonNode taskIds = body.path("taskIds");
        int planned = taskIds.size();
        int errors = body.path("erroredUsers").size();
        assertThat(app.dialog()).isHidden();
        app.expectToast(planned + " planned tasks, " + errors + " errors.");
        // One task per user of the whole stack: cancel them, they would hold the task worker
        List<String> ids = new ArrayList<>();
        taskIds.forEach(id -> ids.add(id.asText()));
        ids.parallelStream().forEach(id -> webAdmin.delete("/tasks/" + id));

        assertThat(errors).isZero();
        assertThat(planned).isGreaterThan(2);
        assertThat(taskIds.has(user)).isTrue();
        JsonNode task = OpsBackend.task(webAdmin, taskIds.path(user).asText());
        assertThat(task.path("type").asText()).isEqualTo("user-reindexing");
        assertThat(task.path("additionalInformation").path("username").asText()).isEqualTo(user);
    }

    @Test
    @DisplayName("CT-04 Reload certificates, reposition rights, cleanup old tasks")
    void reloadCertificatesRepositionRightsCleanupOldTasks(AdminApp app, WebAdmin webAdmin) {
        CommonTasksPage page = CommonTasksPage.open(app);

        page.runButton("Reload certificates").click();
        assertThat(app.dialog().getByRole(AriaRole.HEADING)).hasText("Reload Certificates");
        assertThat(app.dialog()).containsText("Reload server certificates for all ports?");
        app.confirm();
        assertThat(app.toasts()).containsText(Pattern.compile("Certificates reloaded successfully|Error reloading certificates"));

        page.runButton("Reposition system rights on all Team Mailbox folders").click();
        assertThat(app.dialog().getByRole(AriaRole.HEADING)).hasText("Reposition System Rights");
        app.confirm();
        assertThat(app.toasts()).containsText(Pattern.compile("System rights repositioned successfully|Error repositioning system rights"));

        Locator days = app.main().getByLabel("days", new Locator.GetByLabelOptions().setExact(true));
        Locator run = page.runButton("Cleaning up old tasks");
        Locator invalid = page.row("Cleaning up old tasks").getByRole(AriaRole.ALERT);
        for (String value : List.of("0", "-3", "1.5", "")) {
            days.fill(value);
            assertThat(invalid).hasText("Enter a number of days greater than 0");
            assertThat(run).isDisabled();
        }
        days.fill("1");
        assertThat(invalid).hasCount(0);
        assertThat(run).isEnabled();
        run.click();
        assertThat(app.dialog().getByRole(AriaRole.HEADING)).hasText("Cleanup Old Tasks");
        assertThat(app.dialog()).containsText("Delete all tasks older than 1 day(s)?");
        Response response = app.page().waitForResponse(
            r -> r.request().method().equals("DELETE") && r.url().contains("/tasks?"), app::confirm);
        assertThat(pathOf(response)).isEqualTo("/tasks?olderThan=1day");
        app.expectToast("Old tasks (>1 days) cleaned up");

        Instant dayAgo = Instant.now().minus(1, ChronoUnit.DAYS).minus(1, ChronoUnit.MINUTES);
        DateTimeFormatter webAdminDate = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSSZ");
        webAdmin.get("/tasks").expect(200).json().forEach(task ->
            assertThat(OffsetDateTime.parse(task.path("submitDate").asText(), webAdminDate).toInstant()).isAfter(dayAgo));
    }

    @Test
    @DisplayName("CT-05 Blob garbage collection and Trash/Spam cleanup (all users)")
    void blobGarbageCollectionAndCleanups(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin) {
        String user = fixtures.newUser();
        fixtures.sendMail(user, user, "kept", "Untouched by the cleanups");
        fixtures.awaitMessageCount(user, "INBOX", 1);

        CommonTasksPage page = CommonTasksPage.open(app);
        page.run("Blob garbage collection");
        assertThat(app.dialog().getByRole(AriaRole.HEADING)).hasText("Blob garbage collection");
        assertThat(app.dialog()).containsText("Stored blobs that no message references any more are permanently deleted from the object storage.");
        assertThat(page.param("expectedBlobCount")).hasValue("1000000");
        assertThat(page.param("associatedProbability")).hasValue("0.01");
        // Only unreferenced blobs: started like any task, without a word to type
        assertThat(Dialogs.typeToConfirmField(app)).hasCount(0);
        Response refused = app.page().waitForResponse(
            r -> r.request().method().equals("DELETE") && r.url().contains("/blobs?"), Dialogs.button(app, Dialogs.START_TASK)::click);
        assertThat(pathOf(refused)).isEqualTo("/blobs?scope=unreferenced&associatedProbability=0.01&expectedBlobCount=1000000");
        if (refused.status() == 201) {
            assertThat(app.dialog()).isHidden();
            OpsBackend.cancelIfRunning(webAdmin, taskIdOf(refused));
        } else {
            // This backend has no blob garbage collection route: the refusal stays in the dialog
            assertThat(app.dialogError()).containsText("DELETE /blobs can not be found");
            assertThat(app.dialog()).isVisible();
            assertThat(page.param("expectedBlobCount")).hasValue("1000000");
            assertThat(app.toasts().getByText("Run", new Locator.GetByTextOptions().setExact(true))).hasCount(0);
            app.cancel();
        }

        for (String folder : List.of("Trash", "Spam")) {
            page.run("Cleanup " + folder + " folder (all users)");
            assertThat(page.param("olderThan")).hasValue("5d");
            Response response = confirmTask(app, "DELETE", "/messages?");
            assertThat(pathOf(response)).isEqualTo("/messages?olderThan=5d&mailbox=" + folder + "&useSavedDate=");
            String taskId = taskIdOf(response);
            expectTaskToast(app, taskId);
            assertThat(OpsBackend.cancelIfRunning(webAdmin, taskId).path("status").asText()).isIn("completed", "canceled");
        }
        assertThat(fixtures.messageCount(user, "INBOX")).isEqualTo(1);
    }

    @Test
    @DisplayName("CT-06 Clearing a rate parameter removes it from the Command preview")
    void clearingRateParameterRemovesItFromPreview(AdminApp app, WebAdmin webAdmin) {
        CommonTasksPage page = CommonTasksPage.open(app);

        page.run("Per user reindexing (one task per user)");
        assertThat(page.commandPreview()).hasText("Command: curl -XPOST /users?action=reindex&mode=rebuildAll&messagesPerSecond=50");
        page.param("messagesPerSecond").fill("");
        assertThat(page.commandPreview()).hasText("Command: curl -XPOST /users?action=reindex&mode=rebuildAll");
        app.cancel();

        page.run("Cleanup Trash folder (all users)");
        assertThat(page.commandPreview()).hasText("Command: curl -XDELETE \"/messages?olderThan=5d&mailbox=Trash&useSavedDate\"");
        page.param("olderThan").fill("");
        assertThat(page.commandPreview()).hasText("Command: curl -XDELETE \"/messages?mailbox=Trash&useSavedDate\"");
        app.cancel();

        page.run("Reindex all data in OpenSearch (fix outdated mode)");
        page.param("messagesPerSecond").fill("");
        assertThat(page.commandPreview()).hasText("Command: curl -XPOST /mailboxes?task=reIndex&mode=fixOutdated");
        page.param("messagesPerSecond").fill("20");
        assertThat(page.commandPreview()).hasText("Command: curl -XPOST /mailboxes?task=reIndex&mode=fixOutdated&messagesPerSecond=20");
        Response response = confirmTask(app, "POST", "/mailboxes?");
        assertThat(pathOf(response)).isEqualTo("/mailboxes?task=reIndex&mode=fixOutdated&messagesPerSecond=20");
        OpsBackend.cancelIfRunning(webAdmin, taskIdOf(response));
    }
}
