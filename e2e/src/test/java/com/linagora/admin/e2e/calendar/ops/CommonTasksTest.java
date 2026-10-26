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
    /** The commands of {@link CommonTasksPage#TASKS}, in the same order. */
    private static final String[] COMMANDS = {
        "curl -XPOST /registeredUsers/tasks?task=importFromLDAP&usersPerSecond=100",
        "curl -XPOST /addressbook/domain-members?task=sync",
        "curl -XPOST /registeredUsers?action=addMissingFields",
        "curl -XPOST /contacts?action=republish&contactsPerSecond=100",
        "curl -XPOST /calendars?task=reindex&eventsPerSecond=100",
        "curl -XPOST /calendars?task=scheduleAlarms&eventsPerSecond=100",
        "curl -XPOST /calendars?task=archive&eventsPerSecond=100",
        "curl -XDELETE /addressbook/domain-members"};
    private static final int ARCHIVAL = 6;
    private static final int DELETE_MEMBERS_CONTACTS = 7;

    /** Reads the task id from the "Task created" toast. */
    /** The task a "Task created" toast names "<task name> — Task <short id>": earlier toasts may still be shown. */
    private static String runningTaskId(AdminApp app, String taskName) {
        Locator link = app.toasts().getByRole(AriaRole.LINK).filter(new Locator.FilterOptions().setHasText(taskName + " — Task "));
        assertThat(link).hasText(AdminApp.TASK_TOAST_LINK);
        return AdminApp.taskIdOf(link);
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
        // Grouped by purpose, each task saying what it does
        assertThat(tasks.groupHeadings()).hasText(CommonTasksPage.GROUPS);
        assertThat(tasks.group("Users and contacts").getByRole(AriaRole.BUTTON,
            new Locator.GetByRoleOptions().setName(AdminApp.RUN_TASK_BUTTON))).hasCount(4);
        assertThat(tasks.group("Cleanup")).containsText("Calendar event archival");
        assertThat(tasks.row("Alarm rescheduling")).containsText("Use when event reminders are not sent.");
        assertThat(tasks.row("Calendar event archival")).containsText("Modifies data");
        assertThat(tasks.row("Delete domain members contacts of all domains")).containsText("Deletes data");
        assertThat(tasks.row("Import LDAP users")).not().containsText("data");

        for (int i = 0; i < CommonTasksPage.TASKS.length; i++) {
            tasks.runButton(CommonTasksPage.TASKS[i]).hover();
            assertThat(page.getByRole(AriaRole.TOOLTIP).first()).hasText(COMMANDS[i]);
        }
        assertThat(app.main().getByText(Pattern.compile("Reindex all data in OpenSearch|Cleanup Trash folder"))).hasCount(0);

        page.mouse().move(0, 0);
        // Green for the safe tasks, orange for the archival that modifies data, red for the deletion
        String green = background(tasks, CommonTasksPage.TASKS[0]);
        String orange = background(tasks, CommonTasksPage.TASKS[ARCHIVAL]);
        String red = background(tasks, CommonTasksPage.TASKS[DELETE_MEMBERS_CONTACTS]);
        assertThat(List.of(green, orange, red)).doesNotHaveDuplicates();
        for (int i = 0; i < ARCHIVAL; i++) {
            assertThat(background(tasks, CommonTasksPage.TASKS[i])).as(CommonTasksPage.TASKS[i]).isEqualTo(green);
        }

        // The filter matches names and descriptions
        tasks.filter().fill("reminders");
        assertThat(tasks.runButtons()).hasCount(1);
        assertThat(tasks.groupHeadings()).hasText(new String[] {"Consistency repair"});
        tasks.filter().fill("zzz");
        assertThat(app.main().getByText("No task matches \"zzz\".")).isVisible();
        assertThat(tasks.runButtons()).hasCount(0);
    }

    @Test
    @DisplayName("CT-02 Import LDAP users")
    void importLdapUsers(AdminApp app, Page page) {
        TaskDialog dialog = CommonTasksPage.open(app).run("Import LDAP users");
        assertThat(dialog.root()).containsText("Registers on the calendar server the LDAP users that are not registered yet.");
        assertThat(dialog.label("usersPerSecond")).hasText("Users per second (optional)");
        assertThat(dialog.param("usersPerSecond")).hasValue("100");
        // Every parameter is optional: the dialog opens on Cancel, so that Enter does not start the task
        assertThat(dialog.cancelButton()).isFocused();
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
        dialog.duration("masterDtStartBefore", "Starting more than", "1", "Years").choose("isNotRecurring", "Yes");
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
        dialog.confirmButton().click();
        assertThat(dialog.root()).isHidden();
        String taskId = runningTaskId(app, "Alarm rescheduling");
        assertThat(webAdmin.awaitTask(taskId).path("status").asText()).isEqualTo("completed");
    }

    @Test
    @DisplayName("CT-05 Other calendar maintenance tasks run")
    void otherCalendarMaintenanceTasksRun(AdminApp app, WebAdmin webAdmin) {
        CommonTasksPage tasks = CommonTasksPage.open(app);

        TaskDialog addMissingFields = tasks.run("Add missing fields to registered users");
        addMissingFields.expectCommand(COMMANDS[2]);
        addMissingFields.confirmButton().click();
        assertThat(addMissingFields.root()).isHidden();
        assertThat(webAdmin.awaitTask(runningTaskId(app, "Add missing fields to registered users")).path("status").asText()).isEqualTo("completed");

        // Reindexing goes through every calendar of the stack for minutes, and the side service
        // runs one task at a time: it would hold up the tasks of every other test. Once accepted,
        // the task is cancelled.
        TaskDialog reindexing = tasks.run("Calendar event reindexing");
        reindexing.confirmButton().click();
        assertThat(reindexing.root()).isHidden();
        String reindex = runningTaskId(app, "Calendar event reindexing");
        assertThat(webAdmin.get("/tasks/" + reindex).expect(200).json().path("type").asText()).isEqualTo("reindex-calendar-events");
        webAdmin.delete("/tasks/" + reindex);
        Awaitility.await().atMost(Duration.ofSeconds(30)).pollInterval(Duration.ofMillis(300)).until(() ->
            List.of("canceled", "completed").contains(webAdmin.get("/tasks/" + reindex).json().path("status").asText()));

        // Archival is not confirmed: it would add an "Archival" calendar to every user of the stack
        TaskDialog dialog = tasks.run("Calendar event archival");
        dialog.expectCommand("curl -XPOST /calendars?task=archive&eventsPerSecond=100");
        // Without any criterion, every event of every user would be archived: the dialog says so
        assertThat(dialog.root().getByRole(AriaRole.STATUS)).hasText(
            "No criterion set: every event of every registered user will be moved to an \"Archival\" calendar.");
        assertThat(dialog.confirmButton("Archive all events")).isVisible();
        app.cancel();

        // Routes missing in the side service of the stack (environment limitation)
        dialog = tasks.run("Domain member synchronization");
        dialog.expectCommand(COMMANDS[1]);
        dialog.confirmButton().click();
        assertThat(dialog.error()).containsText("POST /addressbook/domain-members can not be found");
        app.cancel();

        dialog = tasks.run("Republish all common contacts");
        dialog.expectCommand(COMMANDS[3]);
        dialog.confirmButton().click();
        assertThat(dialog.error()).containsText("POST /contacts can not be found");
        app.cancel();
    }

    @Test
    @DisplayName("CT-06 Delete domain members contacts of all domains")
    void deleteDomainMembersContactsOfAllDomains(AdminApp app, Page page) {
        TaskDialog dialog = CommonTasksPage.open(app).run("Delete domain members contacts of all domains");
        assertThat(dialog.root()).containsText("The \"Domain members\" address book of every domain, except the skipped ones, is emptied.");
        dialog.expectCommand(COMMANDS[7]);
        dialog.fill("ignoredDomains", "example.com");
        dialog.expectCommand(COMMANDS[7] + "?ignoredDomains=example.com");
        dialog.clear("ignoredDomains");
        dialog.expectCommand(COMMANDS[7]);

        // Irreversible: DELETE has to be typed before the red "Delete data" can be clicked
        Locator delete = dialog.confirmButton("Delete data");
        assertThat(delete).isDisabled();
        Locator typed = dialog.root().getByLabel("Type DELETE to confirm");
        typed.fill("delete");
        assertThat(delete).isDisabled();
        typed.fill("DELETE");
        assertThat(delete).isEnabled();

        Request request = page.waitForRequest(r -> r.method().equals("DELETE"), delete::click);
        assertThat(request.url()).endsWith("/addressbook/domain-members");
        // Route missing in the side service of the stack (environment limitation): refused in the dialog
        assertThat(dialog.error()).containsText("DELETE /addressbook/domain-members can not be found");
        assertThat(dialog.root()).isVisible();
        app.cancel();
    }
}
