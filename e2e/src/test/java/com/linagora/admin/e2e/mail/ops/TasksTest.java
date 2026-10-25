package com.linagora.admin.e2e.mail.ops;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
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
import com.linagora.admin.e2e.pages.mail.ops.TasksPage;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

/**
 * The task list is server wide: the tests start their own tasks, on their own users, and look
 * for them (by ID, or with filters narrowing the list to the window of the test).
 */
@ResourceLock(Locks.MAIL_TASKS)
class TasksTest extends MailAdminE2ETest {
    private static final DateTimeFormatter DATETIME_LOCAL = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    /** A quick task of a user of the test. */
    private static String reindexTask(WebAdmin webAdmin, String user) {
        return OpsBackend.startTask(webAdmin, "POST", "/users/" + WebAdmin.encode(user) + "/mailboxes?task=reIndex");
    }

    private static String clearInboxTask(WebAdmin webAdmin, String user) {
        webAdmin.put("/users/" + WebAdmin.encode(user) + "/mailboxes/INBOX");
        return OpsBackend.startTask(webAdmin, "DELETE", "/users/" + WebAdmin.encode(user) + "/mailboxes/INBOX/messages");
    }

    /** A task lasting about 30 s: the reindexing of 30 messages at one message per second. */
    private static String slowTask(MailFixtures fixtures) {
        String user = fixtures.newUser("slow");
        for (int i = 0; i < 30; i++) {
            fixtures.sendMail(user, user, "slow " + i, "body " + i);
        }
        org.awaitility.Awaitility.await().atMost(java.time.Duration.ofSeconds(30))
            .until(() -> fixtures.webAdmin().get("/users/" + user + "/mailboxes/INBOX/messageCount").status() == 200
                && fixtures.messageCount(user, "INBOX") == 30);
        return OpsBackend.startTask(fixtures.webAdmin(), "POST",
            "/users/" + WebAdmin.encode(user) + "/mailboxes?task=reIndex&messagesPerSecond=1");
    }

    /** A "Submitted after" value a few seconds before now, in the time zone of the browser. */
    private static String justBefore() {
        return ZonedDateTime.now(ZoneId.of("Europe/Paris")).minusSeconds(5).format(DATETIME_LOCAL);
    }

    /** The date format of the task list, computed by the browser. */
    private static String formatted(Page page, String isoDate) {
        return (String) page.evaluate("d => { const dt = new Date(d); return `${dt.toLocaleDateString('en')} ${dt.toLocaleTimeString('en')}`; }", isoDate);
    }

    @Test
    @DisplayName("TSK-01 Task list, detail dialog and full details page")
    void listDetailAndFullDetails(AdminApp app, Page page, MailFixtures fixtures, WebAdmin webAdmin) {
        String taskId = reindexTask(webAdmin, fixtures.newUser());
        JsonNode task = webAdmin.awaitTask(taskId);
        assertThat(task.path("status").asText()).isEqualTo("completed");

        TasksPage tasks = TasksPage.open(app);
        tasks.refreshButton().click();
        for (String column : List.of("#", "Task", "Status", "Submitted", "Started / Completed", "Actions")) {
            assertThat(app.main().getByTestId("tasks-header").getByText(column, new Locator.GetByTextOptions().setExact(true))).isVisible();
        }
        assertThat(tasks.pageLabel()).isVisible();
        Locator row = tasks.row(taskId);
        assertThat(row).containsText("Completed");
        assertThat(row).not().containsText("completed");
        // Named as its button reads, then its type and the start of its id, muted
        assertThat(row.getByRole(AriaRole.BUTTON).first()).hasText("Reindex all mailboxes");
        assertThat(row.getByTitle(taskId, new Locator.GetByTitleOptions().setExact(true))).hasText("user-reindexing · " + taskId.substring(0, 8));
        Locator startedCompleted = tasks.startedCompleted(taskId);
        assertThat(startedCompleted).hasAttribute("title", formatted(page, task.path("startedDate").asText())
            + " → " + formatted(page, task.path("completedDate").asText()));
        assertThat(tasks.cancelButton(taskId)).hasCount(0);

        // A click on the row opens the detail
        row.getByTitle(taskId).click();
        assertThat(app.dialog().getByRole(AriaRole.HEADING).first()).containsText("Reindex all mailboxes");
        for (String label : List.of("Status", "Type", "Submitted", "Started", "Duration", "Executed on", "Submitted from")) {
            assertThat(app.dialog().getByText(label, new Locator.GetByTextOptions().setExact(true))).isVisible();
        }
        // The status pill and the "Completed" date label
        assertThat(app.dialog().getByText("Completed", new Locator.GetByTextOptions().setExact(true))).hasCount(2);
        assertThat(app.dialog()).containsText(task.path("executedOn").asText());
        // The additional information as labelled values, the raw JSON folded
        assertThat(app.dialog().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setName("Details").setExact(true))).isVisible();
        assertThat(app.dialog().getByText("Raw JSON", new Locator.GetByTextOptions().setExact(true))).isVisible();
        assertThat(app.dialog().locator("details pre")).isHidden();
        assertThat(app.dialog().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Cancel task").setExact(true))).hasCount(0);

        app.dialog().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName("Full Details")).click();
        assertThat(page).hasURL(Pattern.compile("/task/" + taskId + "$"));
        // Headed by the task as its button reads, its id below
        assertThat(app.main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setLevel(1)))
            .containsText("Reindex all mailboxes");
        assertThat(app.main().getByText("Task " + taskId, new Locator.GetByTextOptions().setExact(false)).first()).isVisible();
        assertThat(app.main().getByText("user-reindexing", new Locator.GetByTextOptions().setExact(true)).first()).isVisible();
        assertThat(app.main().getByText("Completed", new Locator.GetByTextOptions().setExact(true)).first()).isVisible();
        app.main().getByText("Raw JSON", new Locator.GetByTextOptions().setExact(true)).click();
        Locator json = app.main().locator("details pre");
        assertThat(json).isVisible();
        assertThat(json).containsText("\"taskId\": \"" + taskId + "\"");
        assertThat(readJson(json.textContent()))
            .isEqualTo(webAdmin.get("/tasks/" + taskId).expect(200).json());
        assertThat(json).containsText(task.path("submitDate").asText());
        assertThat(app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Cancel task").setExact(true))).hasCount(0);
        assertThat(app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Refresh").setExact(true))).isVisible();
        assertThat(tasksBreadcrumb(app)).hasAttribute("href", "/tasks");

        // Keyboard: Enter and Space on the task ID open the same dialog, Escape gives the focus back
        page.goBack();
        Locator idButton = tasks.taskIdButton(taskId);
        idButton.focus();
        page.keyboard().press("Enter");
        assertThat(app.dialog().getByRole(AriaRole.HEADING).first()).containsText("Reindex all mailboxes");
        page.keyboard().press("Escape");
        assertThat(app.dialog()).isHidden();
        assertThat(idButton).isFocused();
        page.keyboard().press(" ");
        assertThat(app.dialog().getByRole(AriaRole.HEADING).first()).containsText("Reindex all mailboxes");
        page.keyboard().press("Escape");
        assertThat(app.dialog()).isHidden();
        assertThat(idButton).isFocused();
    }

    private static JsonNode readJson(String text) {
        try {
            return WebAdmin.JSON.readTree(text);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @Test
    @DisplayName("TSK-02 Task filters and sort")
    void filtersAndSort(AdminApp app, Page page, MailFixtures fixtures, WebAdmin webAdmin) {
        String user = fixtures.newUser();
        String submittedAfter = justBefore();
        String reindex = reindexTask(webAdmin, user);
        String clear = clearInboxTask(webAdmin, user);
        String cancelled = slowTask(fixtures);
        assertThat(OpsBackend.cancelIfRunning(webAdmin, cancelled).path("status").asText()).isEqualTo("canceled");
        assertThat(webAdmin.awaitTask(reindex).path("status").asText()).isEqualTo("completed");
        assertThat(webAdmin.awaitTask(clear).path("status").asText()).isEqualTo("completed");

        TasksPage tasks = TasksPage.open(app);
        // Quick status chips, always visible, each with its count
        assertThat(tasks.statusChips()).hasText(new Pattern[] {
            Pattern.compile("^All \\(\\d+\\)$"), Pattern.compile("^Running \\(\\d+\\)$"), Pattern.compile("^Failed \\(\\d+\\)$"),
            Pattern.compile("^Completed \\(\\d+\\)$"), Pattern.compile("^Cancelled \\(\\d+\\)$")});
        tasks.filtersButton().click();
        assertThat(tasks.filtersButton()).hasText("Hide Filters");
        // The dates are folded away
        assertThat(tasks.dateFilter("Submitted after")).isHidden();
        tasks.openDateFilters();
        for (String date : List.of("Submitted after", "Submitted before", "Started after", "Started before",
            "Completed after", "Completed before", "Failed after", "Failed before")) {
            assertThat(tasks.dateFilter(date)).isVisible();
        }

        tasks.dateFilter("Submitted after").fill(submittedAfter);
        tasks.applyFilters();
        tasks.statusChip("Completed").click();
        assertThat(tasks.statusChip("Completed")).hasAttribute("aria-pressed", "true");
        assertThat(tasks.row(cancelled)).hasCount(0);
        assertThat(tasks.row(reindex)).isVisible();
        assertThat(tasks.row(clear)).isVisible();
        assertThat(tasks.rows().filter(new Locator.FilterOptions().setHasNot(
            page.getByText("Completed", new Page.GetByTextOptions().setExact(true))))).hasCount(0);

        // The type picker lists task names; the raw type goes to WebAdmin
        assertThat(tasks.typeFilter().locator("option[value='user-reindexing']")).not().hasText("user-reindexing");
        tasks.typeFilter().selectOption("user-reindexing");
        tasks.applyFilters();
        assertThat(tasks.row(clear)).hasCount(0);
        assertThat(tasks.row(reindex)).isVisible();
        assertThat(tasks.rowTypes().filter(new Locator.FilterOptions().setHasNotText("user-reindexing"))).hasCount(0);

        tasks.statusChip("Cancelled").click();
        assertThat(tasks.row(cancelled)).isVisible();
        assertThat(tasks.row(cancelled)).containsText("Cancelled");
        assertThat(tasks.row(reindex)).hasCount(0);
        assertThat(app.main().getByText(Pattern.compile("^Error:"))).hasCount(0);
        // The filters are in the URL: kept on reload
        assertThat(page).hasURL(Pattern.compile("[?&]status=canceled(&|$)"));
        assertThat(page).hasURL(Pattern.compile("[?&]type=user-reindexing(&|$)"));
        page.reload();
        assertThat(tasks.statusChip("Cancelled")).hasAttribute("aria-pressed", "true");
        assertThat(tasks.row(cancelled)).isVisible();
        assertThat(tasks.row(reindex)).hasCount(0);
        // Running covers waiting, in progress and cancel requested
        tasks.statusChip("Running").click();
        assertThat(tasks.row(cancelled)).hasCount(0);
        assertThat(app.main().getByText(Pattern.compile("^Error:"))).hasCount(0);

        // A type nobody ran, read back from the URL
        app.open("/tasks?type=no-such-task-type");
        assertThat(tasks.emptyMessage()).isVisible();

        tasks.filtersButton().click();
        tasks.button("Reset").click();
        assertThat(tasks.row(reindex)).isVisible();
        assertThat(tasks.row(clear)).isVisible();
        assertThat(tasks.row(cancelled)).isVisible();
        assertThat(tasks.typeFilter()).hasValue("");
        assertThat(tasks.statusChip("All")).hasAttribute("aria-pressed", "true");
        tasks.filtersButton().click();
        assertThat(tasks.filtersButton()).hasText("Filters");
        assertThat(tasks.typeFilter()).hasCount(0);

        // Sort by type, both ways: compare with the order of the browser (localeCompare)
        tasks.sortField().selectOption("type");
        assertThat(tasks.sortDirection()).hasText("Desc ↓");
        assertSorted(page, tasks, false);
        tasks.sortDirection().click();
        assertThat(tasks.sortDirection()).hasText("Asc ↑");
        assertSorted(page, tasks, true);
    }

    @Test
    // useFetchData keeps the answer to the last request: a slow unfiltered list (thousands of
    // tasks) landing after the filtered one is ignored
    @DisplayName("TSK-02 A filter applied while the previous list loads is not overwritten by it")
    void staleListDoesNotOverwriteFilter(AdminApp app, Page page, MailFixtures fixtures, WebAdmin webAdmin) {
        String user = fixtures.newUser();
        String reindex = reindexTask(webAdmin, user);
        String clear = clearInboxTask(webAdmin, user);
        webAdmin.awaitTask(reindex);
        webAdmin.awaitTask(clear);

        TasksPage tasks = TasksPage.open(app);
        assertThat(tasks.row(clear)).isVisible();
        List<com.microsoft.playwright.Route> held = new java.util.ArrayList<>();
        page.route(url -> url.endsWith("/tasks"), held::add);
        page.waitForRequest(request -> request.url().endsWith("/tasks"), () -> tasks.refreshButton().click());

        tasks.filtersButton().click();
        tasks.typeFilter().selectOption("user-reindexing");
        tasks.applyFilters();
        assertThat(tasks.row(reindex)).isVisible();
        assertThat(tasks.row(clear)).hasCount(0);

        assertThat(held).hasSize(1);
        page.waitForResponse(response -> response.url().endsWith("/tasks"), () -> held.get(0).resume());
        assertThat(tasks.typeFilter()).hasValue("user-reindexing");
        assertThat(tasks.row(clear)).hasCount(0);
    }

    private static void assertSorted(Page page, TasksPage tasks, boolean ascending) {
        org.awaitility.Awaitility.await().atMost(java.time.Duration.ofSeconds(10)).untilAsserted(() -> {
            List<String> types = tasks.names();
            assertThat(types).isNotEmpty();
            @SuppressWarnings("unchecked")
            List<String> expected = (List<String>) page.evaluate(
                "([types, asc]) => [...types].sort((a, b) => asc ? a.localeCompare(b) : b.localeCompare(a))",
                List.of(types, ascending));
            assertThat(types).isEqualTo(expected);
        });
    }

    @Test
    @DisplayName("TSK-03 Cancel a running task")
    void cancelRunningTask(AdminApp app, Page page, MailFixtures fixtures, WebAdmin webAdmin) {
        String taskId = slowTask(fixtures);
        try {
            app.open("/task/" + taskId);
            assertThat(app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Cancel task").setExact(true))).isVisible();

            TasksPage tasks = TasksPage.open(app);
            tasks.cancelButton(taskId).click();
            assertThat(app.dialog().getByRole(AriaRole.HEADING)).hasText("Cancel Task");
            // Named as its button reads, with its target and its id
            assertThat(app.dialog()).containsText("Cancel \"Reindex all mailboxes\" for ");
            assertThat(app.dialog()).containsText("(task " + taskId + ")");
            app.confirm("Cancel task");
            app.expectToast("Task cancelled");
            assertThat(tasks.row(taskId)).containsText(Pattern.compile("Cancel Requested|Cancelled"));
            assertThat(OpsBackend.cancelIfRunning(webAdmin, taskId).path("status").asText()).isEqualTo("canceled");
            tasks.refreshButton().click();
            assertThat(tasks.row(taskId)).containsText("Cancelled");
            assertThat(tasks.cancelButton(taskId)).hasCount(0);
        } finally {
            OpsBackend.cancelIfRunning(webAdmin, taskId);
        }
    }

    @Test
    @DisplayName("TSK-04 End date of cancelled and failed tasks")
    void endDateOfCancelledTasks(AdminApp app, Page page, MailFixtures fixtures, WebAdmin webAdmin) {
        String submittedAfter = justBefore();
        String cancelledId = slowTask(fixtures);
        JsonNode cancelled = OpsBackend.cancelIfRunning(webAdmin, cancelledId);
        assertThat(cancelled.path("status").asText()).isEqualTo("canceled");
        // Completed after the cancellation
        String completedId = reindexTask(webAdmin, fixtures.newUser());
        assertThat(webAdmin.awaitTask(completedId).path("status").asText()).isEqualTo("completed");

        TasksPage tasks = TasksPage.open(app);
        // A task cancelled while waiting never started
        String started = cancelled.path("startedDate").isTextual() ? formatted(page, cancelled.path("startedDate").asText()) : "—";
        String expected = started + " → "
            + formatted(page, cancelled.path("canceledDate").asText());
        assertThat(tasks.startedCompleted(cancelledId)).containsText(expected);
        assertThat(tasks.startedCompleted(cancelledId)).hasAttribute("title", expected);

        // Failed tasks, if any, show their end date too
        tasks.statusChip("Failed").click();
        assertThat(tasks.row(cancelledId)).hasCount(0);
        assertThat(tasks.rows().getByTestId("task-started-completed").filter(new Locator.FilterOptions().setHasNotText("→"))).hasCount(0);

        // Sorted by end date, the cancelled task sits among the others by its cancellation date
        tasks.statusChip("All").click();
        tasks.filtersButton().click();
        tasks.typeFilter().selectOption("user-reindexing");
        tasks.openDateFilters();
        tasks.dateFilter("Submitted after").fill(submittedAfter);
        tasks.applyFilters();
        assertThat(tasks.dateFilter("Submitted after")).hasValue(submittedAfter);
        tasks.sortField().selectOption("completedDate");
        assertThat(tasks.sortDirection()).hasText("Desc ↓");
        assertBefore(tasks, completedId, cancelledId);
        tasks.sortDirection().click();
        assertThat(tasks.sortDirection()).hasText("Asc ↑");
        assertBefore(tasks, cancelledId, completedId);
    }

    private static void assertBefore(TasksPage tasks, String first, String second) {
        org.awaitility.Awaitility.await().atMost(java.time.Duration.ofSeconds(10)).untilAsserted(() -> {
            // The full id of each row, carried by its muted "type · short id" line
            List<String> ids = tasks.rows().locator("span.font-mono[title]").evaluateAll("spans => spans.map(s => s.title)")
                instanceof List<?> list ? list.stream().map(String::valueOf).toList() : List.of();
            assertThat(ids).as("%d rows", ids.size()).contains(first, second);
            assertThat(ids.indexOf(first)).isLessThan(ids.indexOf(second));
        });
    }

    @Test
    @DisplayName("TSK-05 Task page for an unknown or malformed task ID")
    void unknownOrMalformedTaskId(AdminApp app) {
        app.open("/task/not-a-task");
        assertThat(app.main().getByText("Error: Failed to fetch data: Invalid task id — Invalid UUID string: not-a-task")).isVisible();
        assertNoCancel(app);

        String unknown = "a1b2c3d4-c464-11f1-ad63-c75c21872971";
        app.open("/task/" + unknown);
        assertThat(app.main().getByText("Error: Failed to fetch data: " + unknown + " can not be found")).isVisible();
        assertThat(app.main().getByText(Pattern.compile("Request failed with status code"))).hasCount(0);
        assertNoCancel(app);
    }

    /** The breadcrumb of the task page, leading back to the Tasks list. */
    private static Locator tasksBreadcrumb(AdminApp app) {
        return app.main().getByRole(AriaRole.NAVIGATION, new Locator.GetByRoleOptions().setName("Breadcrumb"))
            .getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName("Tasks").setExact(true));
    }

    private static void assertNoCancel(AdminApp app) {
        assertThat(app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Refresh").setExact(true))).isVisible();
        assertThat(tasksBreadcrumb(app)).isVisible();
        assertThat(app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Cancel task").setExact(true))).hasCount(0);
    }
}
