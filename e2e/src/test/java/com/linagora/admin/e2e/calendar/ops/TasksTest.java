package com.linagora.admin.e2e.calendar.ops;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.regex.Pattern;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.linagora.admin.e2e.CalendarAdminE2ETest;
import com.linagora.admin.e2e.backend.CalendarFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.docker.CalendarStack;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.calendar.ops.TasksPage;
import com.microsoft.playwright.APIResponse;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Route;
import com.microsoft.playwright.options.AriaRole;
import com.microsoft.playwright.options.SelectOption;

/**
 * The task list is global: the tests seed their own tasks (calendar imports into the calendar of
 * their own user) and assert on them, never on the list as a whole.
 */
class TasksTest extends CalendarAdminE2ETest {

    /** A completed then a failed import task of a new user: their ids. */
    private static String[] completedAndFailedTasks(OpsBackend backend, CalendarFixtures fixtures) {
        String user = fixtures.newRegisteredUser("tasks");
        String calendarId = OpsBackend.lastSegment(backend.defaultCalendarUrl(user));
        String completed = backend.importEvents(user, calendarId, OpsBackend.event("ok"));
        assertThat(backend.webAdmin().awaitTask(completed).path("status").asText()).isEqualTo("completed");
        String failed = backend.importEvents(user, calendarId, OpsBackend.brokenEvent());
        assertThat(backend.webAdmin().awaitTask(failed).path("status").asText()).isEqualTo("failed");
        return new String[] {completed, failed};
    }

    /** Whether the values follow the order of the page: String.localeCompare of the browser. */
    private static boolean sorted(AdminApp app, List<String> values, boolean ascending) {
        return (Boolean) app.page().evaluate("([v, asc]) => v.every((t, i) => i === 0 || (asc ? 1 : -1) * v[i - 1].localeCompare(t) <= 0)",
            List.of(values, ascending));
    }

    @Test
    @DisplayName("TASK-01 Task list and detail dialog")
    void taskListAndDetailDialog(AdminApp app, CalendarFixtures fixtures, WebAdmin webAdmin, CalendarStack stack) {
        String[] tasks = completedAndFailedTasks(new OpsBackend(webAdmin, stack), fixtures);
        String completed = tasks[0];
        String failed = tasks[1];

        app.open("/");
        TasksPage list = TasksPage.fromSidebar(app);
        assertThat(list.pagination()).isVisible();
        Locator completedRow = list.row(completed);
        assertThat(completedRow).containsText("calendar-import");
        assertThat(completedRow).containsText("Completed");
        assertThat(completedRow).not().containsText("completed");
        assertThat(completedRow.getByTestId("task-started-completed")).containsText(" → ");
        Locator failedRow = list.row(failed);
        assertThat(failedRow).containsText("Failed");
        assertThat(failedRow.getByTestId("task-started-completed")).containsText(" → ");
        assertThat(completedRow.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Cancel"))).hasCount(0);

        Locator dialog = list.openDetail(completed);
        assertThat(dialog.getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setLevel(2)).first()).containsText("Import events (ICS)");
        // A readable summary: status, type, dates, duration, where it ran, then its details
        assertThat(TasksPage.summaryValue(dialog, "Status")).hasText("Completed");
        assertThat(TasksPage.summaryValue(dialog, "Type")).hasText("Import events (ICS)calendar-import");
        assertThat(TasksPage.summaryValue(dialog, "Duration")).hasText(Pattern.compile("\\d s$"));
        for (String text : new String[] {"Submitted", "Started", "Executed on", "Submitted from", "Details"}) {
            assertThat(dialog.getByText(text, new Locator.GetByTextOptions().setExact(true)).first()).isVisible();
        }
        assertThat(TasksPage.summaryValue(dialog, "Imported events")).hasText("1");
        // The raw JSON is folded
        assertThat(TasksPage.rawJson(dialog)).isHidden();
        assertThat(TasksPage.showRawJson(dialog)).containsText("\"importedEventCount\": 1");
        assertThat(dialog.getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName("Full Details")))
            .hasAttribute("href", "/task/" + completed);
        assertThat(dialog.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Cancel task").setExact(true))).hasCount(0);
        app.page().keyboard().press("Escape");
        assertThat(dialog).isHidden();

        TasksPage.switchLanguage(app, "Français");
        assertThat(completedRow).containsText("Terminée");
        assertThat(failedRow).containsText("Échouée");
        assertThat(app.main().getByText(Pattern.compile("^(Page \\d+ — \\d+ résultat\\(s\\)|Total : \\d+)$"))).isVisible();
        dialog = list.openDetail(failed);
        assertThat(dialog.getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setLevel(2)).first()).containsText("Importer des événements (ICS)");
        assertThat(dialog).containsText("Échouée");
        assertThat(dialog).containsText("Exécutée sur");
        assertThat(dialog.getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName("Détails complets"))).isVisible();
        app.page().keyboard().press("Escape");
        TasksPage.switchLanguage(app, "English");
        assertThat(completedRow).containsText("Completed");
    }

    @Test
    @DisplayName("TASK-02 Task filters and sorting")
    void taskFiltersAndSorting(AdminApp app, CalendarFixtures fixtures, WebAdmin webAdmin, CalendarStack stack) {
        OpsBackend backend = new OpsBackend(webAdmin, stack);
        String since = ZonedDateTime.now(ZoneId.of("Europe/Paris")).minusMinutes(1)
            .format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm"));
        String[] tasks = completedAndFailedTasks(backend, fixtures);
        String completed = tasks[0];
        String failed = tasks[1];

        TasksPage list = TasksPage.open(app).showFilters();
        for (String label : new String[] {"Status", "Type", "Submitted after", "Submitted before", "Started after", "Started before",
            "Completed after", "Completed before", "Failed after", "Failed before"}) {
            assertThat(list.field(label)).isVisible();
        }
        list.field("Status").selectOption(new SelectOption().setLabel("Completed"));
        list.field("Type").fill("calendar-import");
        list.button("Apply").click();
        assertThat(list.row(failed)).hasCount(0);
        assertThat(list.row(completed)).isVisible();
        assertThat(list.rows().filter(new Locator.FilterOptions().setHasNotText("calendar-import"))).hasCount(0);
        assertThat(list.rows().filter(new Locator.FilterOptions().setHasNotText("Completed"))).hasCount(0);

        list.button("Reset").click();
        assertThat(list.field("Type")).hasValue("");
        assertThat(list.row(failed)).isVisible();

        // Only the recent tasks: the sorted pages hold the tasks of this test
        list.field("Submitted after").fill(since);
        list.button("Apply").click();
        assertThat(list.row(failed)).isVisible();

        list.sort().selectOption(new SelectOption().setLabel("Type"));
        assertThat(list.button("Desc ↓")).isVisible();
        assertThat(list.pagination()).hasText(Pattern.compile("^(Page 1 — |Total: )"));
        assertThat(sorted(app, list.types(), false)).as("descending %s", list.types()).isTrue();
        list.button("Desc ↓").click();
        assertThat(list.button("Asc ↑")).isVisible();
        assertThat(sorted(app, list.types(), true)).as("ascending %s", list.types()).isTrue();

        list.sort().selectOption(new SelectOption().setLabel("Completed"));
        List<String> ascending = list.ids();
        assertThat(ascending.indexOf(completed)).isNotNegative().isLessThan(ascending.indexOf(failed));
        list.button("Asc ↑").click();
        assertThat(list.button("Desc ↓")).isVisible();
        List<String> descending = list.ids();
        assertThat(descending.indexOf(failed)).isNotNegative().isLessThan(descending.indexOf(completed));

        String user = fixtures.newRegisteredUser("tasks");
        String newTask = backend.importEvents(user, OpsBackend.lastSegment(backend.defaultCalendarUrl(user)), OpsBackend.event("late"));
        assertThat(list.row(newTask)).hasCount(0);
        list.button("Refresh").click();
        assertThat(list.row(newTask)).isVisible();
    }

    @Test
    @DisplayName("TASK-03 Task detail page")
    void taskDetailPage(AdminApp app, Page page, CalendarFixtures fixtures, WebAdmin webAdmin, CalendarStack stack) {
        String completed = completedAndFailedTasks(new OpsBackend(webAdmin, stack), fixtures)[0];

        TasksPage list = TasksPage.open(app);
        list.openDetail(completed).getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName("Full Details")).click();
        assertThat(page).hasURL(Pattern.compile("/task/" + completed + "$"));

        // Headed by the task, under a breadcrumb back to the list
        assertThat(app.main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setLevel(1))).containsText("Import events (ICS)");
        assertThat(app.main().getByText(Pattern.compile("^Task " + completed + " \\(doc\\)$"))).isVisible();
        assertThat(app.main().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName("doc").setExact(true))).isVisible();
        // The same readable summary as the dialog, the raw JSON on demand
        assertThat(TasksPage.summaryValue(app.main(), "Status")).hasText("Completed");
        // Its name, then its type as WebAdmin names it
        assertThat(TasksPage.summaryValue(app.main(), "Type")).hasText("Import events (ICS)calendar-import");
        assertThat(TasksPage.summaryValue(app.main(), "Imported events")).hasText("1");
        Locator json = TasksPage.showRawJson(app.main());
        assertThat(json).containsText("\"taskId\": \"" + completed + "\"");
        assertThat(json).containsText("\"status\": \"completed\"");
        assertThat(json).containsText("\"type\": \"calendar-import\"");
        Locator cancel = app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Cancel task").setExact(true));
        assertThat(cancel).hasCount(0);

        // A running task offers Cancel: the answer of WebAdmin is altered to observe it
        page.route(Pattern.compile("/tasks/" + completed + "$"), route -> {
            // Fetched by the driver, which does not resolve the host names of the browser
            APIResponse response = route.fetch(new Route.FetchOptions().setUrl(webAdmin.baseUrl() + "/tasks/" + completed));
            route.fulfill(new Route.FulfillOptions().setResponse(response)
                .setBody(response.text().replace("\"status\":\"completed\"", "\"status\":\"inProgress\"")));
        });
        app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Refresh").setExact(true)).click();
        assertThat(json).containsText("\"status\": \"inProgress\"");
        assertThat(TasksPage.summaryValue(app.main(), "Status")).hasText("In Progress");
        assertThat(cancel).isVisible();
        // A running task is followed by itself
        assertThat(app.main().getByRole(AriaRole.STATUS)).hasText("Refreshing every 2 s");
        page.unrouteAll();
        app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Refresh").setExact(true)).click();
        assertThat(json).containsText("\"status\": \"completed\"");
        assertThat(cancel).hasCount(0);
        assertThat(app.main().getByRole(AriaRole.STATUS)).hasCount(0);

        app.main().getByRole(AriaRole.NAVIGATION, new Locator.GetByRoleOptions().setName("Breadcrumb"))
            .getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName("Tasks").setExact(true)).click();
        assertThat(page).hasURL(Pattern.compile("/tasks$"));
    }

    @Test
    @DisplayName("TASK-04 Task detail of an unknown or malformed ID")
    void taskDetailOfUnknownOrMalformedId(AdminApp app) {
        Locator cancel = app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Cancel task").setExact(true));

        app.open("/task/not-a-task");
        assertThat(app.main().getByText("Failed to fetch data: Invalid task id — Invalid UUID string: not-a-task")).isVisible();
        assertThat(app.main()).not().containsText("Request failed with status code");
        assertThat(cancel).hasCount(0);

        String unknown = "2c2d8b52-0000-4000-8000-000000000000";
        app.open("/task/" + unknown);
        assertThat(app.main().getByText("Failed to fetch data: " + unknown + " can not be found")).isVisible();
        assertThat(cancel).hasCount(0);
    }
}
