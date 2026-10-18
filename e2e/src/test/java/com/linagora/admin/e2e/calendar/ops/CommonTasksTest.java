package com.linagora.admin.e2e.calendar.ops;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Pattern;

import org.awaitility.Awaitility;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.ResourceLock;

import com.fasterxml.jackson.databind.JsonNode;
import com.linagora.admin.e2e.CalendarAdminE2ETest;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.docker.Locks;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.calendar.ops.CommonTasksPage;
import com.linagora.admin.e2e.pages.calendar.ops.TaskDialog;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Request;
import com.microsoft.playwright.Route;
import com.microsoft.playwright.options.AriaRole;

/**
 * Server wide tasks of the side service. The class holds the lock of those tasks. Calendar event
 * archival is never confirmed: with any criteria it creates an "Archival" calendar for every
 * registered user, which would break the tests counting calendars. LDAP import, domain member
 * synchronization, common contacts republication and domain members contacts deletion are routes
 * the side service of the stack lacks (environment limitation of the plan): their refusal is asserted.
 */
@ResourceLock(Locks.CALENDAR_SERVER_TASKS)
class CommonTasksTest extends CalendarAdminE2ETest {
    private static final String[] COMMANDS = {
        "curl -XPOST /registeredUsers/tasks?task=importFromLDAP&usersPerSecond=100",
        "curl -XPOST /addressbook/domain-members?task=sync",
        "curl -XPOST /calendars?task=reindex&eventsPerSecond=100",
        "curl -XPOST /calendars?task=archive&eventsPerSecond=100",
        "curl -XPOST /calendars?task=scheduleAlarms&eventsPerSecond=100",
        "curl -XPOST /registeredUsers?action=addMissingFields",
        "curl -XPOST /contacts?action=republish&contactsPerSecond=100",
        "curl -XDELETE /addressbook/domain-members"};

    /** Reads the task id from the "Task is running" toast. */
    private static String runningTaskId(AdminApp app) {
        Locator link = app.toast("Task is running").getByRole(AriaRole.LINK);
        assertThat(link).hasText(Pattern.compile("^Task [0-9a-f-]{36}$"));
        return link.textContent().substring("Task ".length());
    }

    /** Records the task submissions of the page (POST / DELETE on WebAdmin). */
    private static List<String> submissions(Page page) {
        List<String> requests = new CopyOnWriteArrayList<>();
        page.onRequest(request -> {
            if (request.method().equals("POST") || request.method().equals("DELETE")) {
                requests.add(request.method() + " " + request.url());
            }
        });
        return requests;
    }

    /** Tasks of WebAdmin whose type contains {@code needle}, ignoring case. */
    private static long tasksOfType(WebAdmin webAdmin, String needle) {
        long count = 0;
        for (JsonNode task : webAdmin.get("/tasks").expect(200).json()) {
            if (task.path("type").asText().toLowerCase().contains(needle)) {
                count++;
            }
        }
        return count;
    }

    private static String background(CommonTasksPage tasks, String task) {
        return (String) tasks.runButton(task).evaluate("b => getComputedStyle(b).backgroundColor");
    }

    @Test
    @DisplayName("CT-01 Calendar common tasks listed")
    void calendarCommonTasksListed(AdminApp app, Page page) {
        CommonTasksPage tasks = CommonTasksPage.open(app);
        assertThat(app.main().getByText("Common tasks for data maintenance of a Twake Calendar server")).isVisible();
        assertThat(tasks.runButtons()).hasCount(CommonTasksPage.TASKS.length);

        for (int i = 0; i < CommonTasksPage.TASKS.length; i++) {
            tasks.runButton(CommonTasksPage.TASKS[i]).hover();
            assertThat(page.getByRole(AriaRole.TOOLTIP).first()).hasText(COMMANDS[i]);
        }
        assertThat(app.main().getByText(Pattern.compile("Reindex all data in OpenSearch|Cleanup Trash folder"))).hasCount(0);

        page.mouse().move(0, 0);
        // The destructive task is the only one with another colour (red)
        String red = background(tasks, CommonTasksPage.TASKS[7]);
        for (int i = 0; i < 7; i++) {
            assertThat(background(tasks, CommonTasksPage.TASKS[i])).as(CommonTasksPage.TASKS[i])
                .isEqualTo(background(tasks, CommonTasksPage.TASKS[0])).isNotEqualTo(red);
        }
    }

    @Test
    @DisplayName("CT-02 Import LDAP users")
    void importLdapUsers(AdminApp app, Page page) {
        TaskDialog dialog = CommonTasksPage.open(app).run("Import LDAP users");
        assertThat(dialog.title()).hasText("Run");
        assertThat(dialog.param("usersPerSecond")).hasValue("100");
        dialog.expectCommand(COMMANDS[0]);

        Request request = page.waitForRequest(r -> r.method().equals("POST") && r.url().contains("/registeredUsers/tasks"),
            () -> dialog.confirmButton().click());
        assertThat(request.url()).endsWith("/registeredUsers/tasks?task=importFromLDAP&usersPerSecond=100");
        // Route missing in the side service of the stack (environment limitation): refused in the dialog
        assertThat(dialog.error()).containsText("POST /registeredUsers/tasks can not be found");
        assertThat(dialog.root()).isVisible();
        app.cancel();
    }

    @Test
    @DisplayName("CT-03 Task parameters reflected in the command preview")
    void taskParametersReflectedInCommandPreview(AdminApp app, Page page) {
        List<String> submitted = submissions(page);
        CommonTasksPage tasks = CommonTasksPage.open(app);

        TaskDialog dialog = tasks.run("Calendar event reindexing");
        dialog.expectCommand("curl -XPOST /calendars?task=reindex&eventsPerSecond=100");
        dialog.fill("eventsPerSecond", "20");
        dialog.expectCommand("curl -XPOST /calendars?task=reindex&eventsPerSecond=20");
        app.cancel();

        dialog = tasks.run("Calendar event reindexing");
        dialog.clear("eventsPerSecond");
        dialog.expectCommand("curl -XPOST /calendars?task=reindex");
        app.cancel();

        dialog = tasks.run("Calendar event archival");
        dialog.duration("masterDtStartBefore", "1", "Years").choose("isNotRecurring", "true");
        dialog.expectCommand("curl -XPOST /calendars?task=archive&masterDtStartBefore=1y&isNotRecurring=true&eventsPerSecond=100");
        app.cancel();

        dialog = tasks.run("Import LDAP users");
        dialog.clear("usersPerSecond");
        dialog.expectCommand("curl -XPOST /registeredUsers/tasks?task=importFromLDAP");
        app.cancel();

        assertThat(submitted).isEmpty();
    }

    @Test
    @DisplayName("CT-04 Rejected task keeps the dialog open with the error")
    void rejectedTaskKeepsDialogOpen(AdminApp app, Page page, WebAdmin webAdmin) {
        long alarmTasks = tasksOfType(webAdmin, "alarm");
        TaskDialog dialog = CommonTasksPage.open(app).run("Alarm rescheduling");
        dialog.fill("eventsPerSecond", "abc");

        // Holds the request to observe the pending state
        AtomicReference<Route> held = new AtomicReference<>();
        Pattern alarms = Pattern.compile("/calendars\\?task=scheduleAlarms");
        page.route(alarms, held::set);
        dialog.confirmButton().click();
        assertThat(dialog.confirmButton()).isDisabled();
        assertThat(dialog.cancelButton()).isDisabled();
        page.unroute(alarms);
        held.get().resume();

        assertThat(dialog.error()).containsText("Illegal value supplied for query parameter 'eventsPerSecond', expecting an integer");
        assertThat(dialog.root()).isVisible();
        assertThat(dialog.param("eventsPerSecond")).hasValue("abc");
        assertThat(tasksOfType(webAdmin, "alarm")).isEqualTo(alarmTasks);

        dialog.fill("eventsPerSecond", "10");
        app.confirm();
        String taskId = runningTaskId(app);
        assertThat(webAdmin.awaitTask(taskId).path("status").asText()).isEqualTo("completed");
    }

    @Test
    @DisplayName("CT-05 Other calendar maintenance tasks run")
    void otherCalendarMaintenanceTasksRun(AdminApp app, WebAdmin webAdmin) {
        CommonTasksPage tasks = CommonTasksPage.open(app);

        tasks.run("Add missing fields to registered users");
        app.confirm();
        assertThat(webAdmin.awaitTask(runningTaskId(app)).path("status").asText()).isEqualTo("completed");

        // Reindexing goes through every calendar of the stack for minutes, and the side service
        // runs one task at a time: it would hold up the tasks of every other test. Once accepted,
        // the task is cancelled.
        tasks.run("Calendar event reindexing");
        app.confirm();
        String reindex = runningTaskId(app);
        assertThat(webAdmin.get("/tasks/" + reindex).expect(200).json().path("type").asText()).isEqualTo("reindex-calendar-events");
        webAdmin.delete("/tasks/" + reindex);
        Awaitility.await().atMost(Duration.ofSeconds(30)).pollInterval(Duration.ofMillis(300)).until(() ->
            List.of("canceled", "completed").contains(webAdmin.get("/tasks/" + reindex).json().path("status").asText()));

        // Archival is not confirmed: it would add an "Archival" calendar to every user of the stack
        TaskDialog dialog = tasks.run("Calendar event archival");
        dialog.expectCommand("curl -XPOST /calendars?task=archive&eventsPerSecond=100");
        app.cancel();

        // Routes missing in the side service of the stack (environment limitation)
        dialog = tasks.run("Domain member synchronization");
        dialog.expectCommand(COMMANDS[1]);
        dialog.confirmButton().click();
        assertThat(dialog.error()).containsText("POST /addressbook/domain-members can not be found");
        app.cancel();

        dialog = tasks.run("Republish all common contacts");
        dialog.expectCommand(COMMANDS[6]);
        dialog.confirmButton().click();
        assertThat(dialog.error()).containsText("POST /contacts can not be found");
        app.cancel();
    }

    @Test
    @DisplayName("CT-06 Delete domain members contacts of all domains")
    void deleteDomainMembersContactsOfAllDomains(AdminApp app, Page page) {
        TaskDialog dialog = CommonTasksPage.open(app).run("Delete domain members contacts of all domains");
        dialog.expectCommand(COMMANDS[7]);
        dialog.fill("ignoredDomains", "example.com");
        dialog.expectCommand(COMMANDS[7] + "?ignoredDomains=example.com");
        dialog.clear("ignoredDomains");
        dialog.expectCommand(COMMANDS[7]);

        Request request = page.waitForRequest(r -> r.method().equals("DELETE"), () -> dialog.confirmButton().click());
        assertThat(request.url()).endsWith("/addressbook/domain-members");
        // Route missing in the side service of the stack (environment limitation): refused in the dialog
        assertThat(dialog.error()).containsText("DELETE /addressbook/domain-members can not be found");
        assertThat(dialog.root()).isVisible();
        app.cancel();
    }
}
