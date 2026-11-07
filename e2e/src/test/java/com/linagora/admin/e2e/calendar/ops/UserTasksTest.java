package com.linagora.admin.e2e.calendar.ops;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Pattern;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.linagora.admin.e2e.CalendarAdminE2ETest;
import com.linagora.admin.e2e.backend.CalendarFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.docker.CalendarStack;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.calendar.ops.CalendarUserPage;
import com.linagora.admin.e2e.pages.calendar.ops.TaskDialog;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Route;
import com.microsoft.playwright.options.AriaRole;

class UserTasksTest extends CalendarAdminE2ETest {
    private static final String[] ARCHIVE_PARAMS = {
        "createdBefore", "lastModifiedBefore", "masterDtStartBefore", "isRejected", "isNotRecurring", "eventsPerSecond"};

    /** Reads the id of the task linked by the "Task created" toast. */
    static String runningTaskId(AdminApp app) {
        Locator link = app.toast("Task created").getByRole(AriaRole.LINK);
        assertThat(link).hasText(AdminApp.TASK_TOAST_LINK);
        return AdminApp.taskIdOf(link);
    }

    /**
     * Lists the calendars of a new user once, which provisions its main calendar: done concurrently
     * by the archival task, it can create a second #default (known side-service issue, see the
     * plan) on which the archival fails.
     */
    static void provisionCalendars(OpsBackend backend, String user) {
        assertThat(backend.calendars(user)).hasSize(1);
    }

    @Test
    @DisplayName("UTASK-01 Archive a user's calendar events")
    void archiveUserCalendarEvents(AdminApp app, Page page, CalendarFixtures fixtures, WebAdmin webAdmin, CalendarStack stack) {
        String user = fixtures.newRegisteredUser("utask");
        provisionCalendars(new OpsBackend(webAdmin, stack), user);

        CalendarUserPage userPage = CalendarUserPage.open(app, user).expandTasks();
        // Republish first, then the tasks that modify and delete data, each stating its risk
        assertThat(userPage.taskTitles()).hasText(new String[] {"Republish common contacts", "Archive calendar events", "Delete user data"});
        assertThat(userPage.taskRow("Republish common contacts")).not().containsText("Modifies data");
        assertThat(userPage.taskRow("Archive calendar events")).containsText("Modifies data");
        assertThat(userPage.taskRow("Delete user data")).containsText("Deletes data");

        TaskDialog dialog = userPage.runTask("Archive calendar events");
        assertThat(dialog.title()).hasText("Archive Calendar Events");
        for (String key : ARCHIVE_PARAMS) {
            assertThat(dialog.param(key)).isVisible();
        }
        assertThat(dialog.label("createdBefore")).hasText("Created more than (optional)");
        for (String duration : new String[] {"Created more than", "Last modified more than", "Starting more than"}) {
            assertThat(dialog.root().getByRole(AriaRole.COMBOBOX, new Locator.GetByRoleOptions().setName(duration + " unit"))).isVisible();
        }
        dialog.expectCommand("curl -XPOST /calendars/" + user + "?task=archive&eventsPerSecond=100");
        // Without any criterion every event is archived: a warning, and a red button saying so
        assertThat(dialog.root().getByRole(AriaRole.STATUS)).hasText(
            "No criterion set: every event of " + user + " will be moved to an \"Archival\" calendar.");
        assertThat(dialog.confirmButton("Archive all events")).isVisible();
        assertThat(dialog.confirmButton()).hasCount(0);

        dialog.duration("createdBefore", "Created more than", "30", "Days").choose("isRejected", "Yes").fill("eventsPerSecond", "50");
        dialog.expectCommand("curl -XPOST /calendars/" + user + "?task=archive&createdBefore=30d&isRejected=true&eventsPerSecond=50");
        assertThat(dialog.root().getByRole(AriaRole.STATUS)).hasCount(0);
        assertThat(dialog.confirmButton("Archive all events")).hasCount(0);
        dialog.confirmButton().click();
        assertThat(dialog.root()).isHidden();

        String taskId = runningTaskId(app);
        AdminApp.follow(app.toast("Task created").getByRole(AriaRole.LINK));
        assertThat(page).hasURL(Pattern.compile("/task/" + taskId + "$"));
        assertThat(webAdmin.awaitTask(taskId).path("status").asText()).isEqualTo("completed");
    }

    @Test
    @DisplayName("UTASK-02 Republish a user's common contacts")
    void republishUserCommonContacts(AdminApp app, CalendarFixtures fixtures) {
        String user = fixtures.newRegisteredUser("utask");

        TaskDialog dialog = CalendarUserPage.open(app, user).expandTasks().runTask("Republish common contacts");
        assertThat(dialog.title()).hasText("Republish Common Contacts");
        assertThat(dialog.param("contactsPerSecond")).hasValue("100");
        dialog.expectCommand("curl -XPOST /users/" + user + "/contacts?action=republish&contactsPerSecond=100");
        dialog.confirmButton().click();

        // The side service of the stack lacks the route (environment limitation, see the plan): the
        // refusal is shown inside the dialog, which stays open
        assertThat(dialog.error()).containsText("POST /users/" + user.replace("@", "%40") + "/contacts can not be found");
        assertThat(dialog.root()).isVisible();
        app.cancel();
    }

    @Test
    @DisplayName("UTASK-03 Delete a user's data")
    void deleteUserData(AdminApp app, Page page, CalendarFixtures fixtures, WebAdmin webAdmin, CalendarStack stack) {
        OpsBackend backend = new OpsBackend(webAdmin, stack);
        String user = fixtures.newRegisteredUser("utask");
        backend.calendars(user);

        CalendarUserPage userPage = CalendarUserPage.open(app, user).expandTasks();
        TaskDialog dialog = userPage.runTask("Delete user data");
        assertThat(dialog.title()).hasText("Delete all data of " + user);
        // What is lost, counted by the page, then the user to type before the data can be wiped
        assertThat(dialog.root()).containsText("Calendars: 1");
        assertThat(dialog.root()).containsText("Every calendar, event, address book, contact and booking link of this user will be deleted.");
        assertThat(dialog.root()).containsText("This user's cards are also removed from the \"Domain members\" address book of their domain.");
        dialog.expectCommand("curl -XPOST /users/" + user + "?action=deleteData");
        dialog.root().getByText("Advanced: resume an interrupted deletion").click();
        Locator fromStep = dialog.root().getByLabel("Resume from step", new Locator.GetByLabelOptions().setExact(true));
        assertThat(fromStep).hasValue("");
        assertThat(fromStep).hasAttribute("placeholder", "e.g. DavCalendarDeletionTaskStep");
        // The preview follows the typed step; it is cleared so that the whole deletion below runs
        fromStep.fill("DavDomainMemberDeletionTaskStep");
        dialog.expectCommand("curl -XPOST /users/" + user + "?action=deleteData&fromStep=DavDomainMemberDeletionTaskStep");
        fromStep.fill("");
        dialog.expectCommand("curl -XPOST /users/" + user + "?action=deleteData");
        Locator delete = dialog.confirmButton("Delete user data");
        assertThat(delete).isDisabled();
        dialog.root().getByLabel("Type " + user + " to confirm").fill(user.toUpperCase());
        assertThat(delete).isEnabled();
        delete.click();
        assertThat(dialog.root()).isHidden();

        String taskId = runningTaskId(app);
        assertThat(webAdmin.awaitTask(taskId).path("status").asText()).isEqualTo("completed");
        assertThat(backend.registeredUser(user)).isNull();
        assertThat(webAdmin.get("/users/" + user + "/calendars").status()).isEqualTo(404);

        page.reload();
        assertThat(app.main().getByText("This user is not registered")).isVisible();
    }

    @Test
    @DisplayName("UTASK-04 A refused user task keeps its dialog open")
    void refusedUserTaskKeepsDialogOpen(AdminApp app, Page page, CalendarFixtures fixtures, WebAdmin webAdmin, CalendarStack stack) {
        OpsBackend backend = new OpsBackend(webAdmin, stack);
        String user = fixtures.newRegisteredUser("utask");
        provisionCalendars(backend, user);
        CalendarUserPage userPage = CalendarUserPage.open(app, user).expandTasks();

        TaskDialog dialog = userPage.runTask("Archive calendar events");
        dialog.duration("createdBefore", "Created more than", "30", "Days").fill("eventsPerSecond", "abc");

        // Holds the request to observe the pending state
        AtomicReference<Route> held = new AtomicReference<>();
        Pattern archive = Pattern.compile("/calendars/[^?]+\\?task=archive");
        page.route(archive, held::set);
        dialog.confirmButton().click();
        assertThat(dialog.confirmButton()).isDisabled();
        assertThat(dialog.cancelButton()).isDisabled();
        page.unroute(archive);
        held.get().resume();

        assertThat(dialog.error()).containsText("Illegal value supplied for query parameter 'eventsPerSecond', expecting an integer");
        assertThat(dialog.root()).isVisible();
        assertThat(dialog.param("createdBefore")).hasValue("30");
        assertThat(dialog.param("eventsPerSecond")).hasValue("abc");
        assertThat(backend.tasksMentioning(user)).isEmpty();

        dialog.fill("eventsPerSecond", "50");
        dialog.confirmButton().click();
        assertThat(dialog.root()).isHidden();
        String taskId = runningTaskId(app);
        assertThat(webAdmin.awaitTask(taskId).path("status").asText()).isEqualTo("completed");

        dialog = userPage.runTask("Republish common contacts");
        dialog.confirmButton().click();
        assertThat(dialog.error()).containsText("can not be found");
        assertThat(dialog.root()).isVisible();
        app.cancel();
    }
}
