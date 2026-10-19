package com.linagora.admin.e2e.calendar.ops;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import org.awaitility.Awaitility;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.ResourceLock;

import com.linagora.admin.e2e.CalendarAdminE2ETest;
import com.linagora.admin.e2e.backend.CalendarFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.docker.CalendarStack;
import com.linagora.admin.e2e.docker.Locks;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.calendar.ops.TasksPage;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

/**
 * Cancelling real tasks of the side service from the UI. A reindexing at one event per second
 * stays in progress, and the side service runs one task at a time: a second one waits behind it.
 * Both hold up the server wide tasks of the other classes, hence the lock, and are cancelled as
 * soon as possible (through WebAdmin if the test fails half way).
 */
@ResourceLock(Locks.CALENDAR_SERVER_TASKS)
class TaskCancelTest extends CalendarAdminE2ETest {
    private static final String REINDEX = "/calendars?task=reindex&eventsPerSecond=1";

    private static String status(WebAdmin webAdmin, String taskId) {
        return webAdmin.get("/tasks/" + taskId).expect(200).json().path("status").asText();
    }

    private static void awaitStatus(WebAdmin webAdmin, String taskId, String expected) {
        Awaitility.await().atMost(Duration.ofSeconds(30)).pollInterval(Duration.ofMillis(300))
            .until(() -> expected.equals(status(webAdmin, taskId)));
    }

    private static Locator cancelButton(Locator scope) {
        return scope.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Cancel").setExact(true));
    }

    @Test
    @DisplayName("TASK-05 Cancel a waiting task from the list and a running one from its page")
    void cancelWaitingAndRunningTasks(AdminApp app, Page page, CalendarFixtures fixtures, WebAdmin webAdmin, CalendarStack stack) {
        OpsBackend backend = new OpsBackend(webAdmin, stack);
        String user = fixtures.newRegisteredUser("cancel");
        String calendarId = OpsBackend.lastSegment(backend.defaultCalendarUrl(user));
        assertThat(webAdmin.awaitTask(backend.importEvents(user, calendarId, OpsBackend.events(40))).path("status").asText())
            .isEqualTo("completed");

        List<String> deletes = new CopyOnWriteArrayList<>();
        page.onRequest(request -> {
            if (request.method().equals("DELETE") && request.url().contains("/tasks/")) {
                deletes.add(request.url());
            }
        });
        String running = webAdmin.post(REINDEX, "").expect(201).json().path("taskId").asText();
        String waiting = webAdmin.post(REINDEX, "").expect(201).json().path("taskId").asText();
        try {
            awaitStatus(webAdmin, running, "inProgress");
            assertThat(status(webAdmin, waiting)).isEqualTo("waiting");

            // From the Tasks list, on a phone: the Cancel button sits in another cell of the row
            page.setViewportSize(390, 844);
            TasksPage list = TasksPage.openByUrl(app);
            Locator row = list.row(waiting);
            assertThat(row).containsText("Waiting");
            assertThat(cancelButton(row)).isVisible();

            // Dismissing the confirmation sends nothing
            cancelButton(row).click();
            assertThat(app.dialog()).containsText("Cancel task \"" + waiting + "\" (reindex-calendar-events)?");
            app.cancel();
            assertThat(cancelButton(row)).isVisible();
            assertThat(deletes).isEmpty();
            assertThat(status(webAdmin, waiting)).isEqualTo("waiting");

            cancelButton(row).click();
            assertThat(app.dialog()).containsText("Cancel task \"" + waiting + "\" (reindex-calendar-events)?");
            app.confirm();
            app.expectToast("Task cancelled");
            assertThat(deletes).hasSize(1);
            assertThat(deletes.get(0)).endsWith("/tasks/" + waiting);
            // A queued task is only marked (WebAdmin spells it canceledRequested): the worker drops
            // it once the running one is over
            awaitStatus(webAdmin, waiting, "canceledRequested");
            list.button("Refresh").click();
            assertThat(row).containsText("Cancel Requested");
            assertThat(cancelButton(row)).hasCount(0);
            assertThat(status(webAdmin, running)).isEqualTo("inProgress");

            // From the task page, on a desktop
            page.setViewportSize(1280, 800);
            app.open("/task/" + running);
            Locator json = app.main().locator("pre");
            assertThat(json).containsText("\"status\": \"inProgress\"");
            Locator cancel = cancelButton(app.main());
            cancel.click();
            assertThat(app.dialog()).containsText("Cancel task \"" + running + "\" (reindex-calendar-events)?");
            app.confirm();
            app.expectToast("Task cancelled");
            assertThat(deletes).hasSize(2);
            assertThat(deletes.get(1)).endsWith("/tasks/" + running);
            awaitStatus(webAdmin, running, "canceled");
            app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Refresh").setExact(true)).click();
            assertThat(json).containsText("\"status\": \"canceled\"");
            assertThat(cancel).hasCount(0);

            // The waiting task, dropped in turn, ends cancelled without ever starting
            awaitStatus(webAdmin, waiting, "canceled");
            list = TasksPage.open(app);
            row = list.row(waiting);
            assertThat(row).containsText("Cancelled");
            assertThat(row.getByTestId("task-started-completed")).containsText("— → ");
            assertThat(cancelButton(row)).hasCount(0);
            assertThat(list.row(running)).containsText("Cancelled");
            assertThat(list.row(running).getByTestId("task-started-completed")).containsText(" → ");
            assertThat(cancelButton(list.row(running))).hasCount(0);
        } finally {
            for (String task : new String[] {waiting, running}) {
                if (List.of("waiting", "inProgress").contains(status(webAdmin, task))) {
                    webAdmin.delete("/tasks/" + task);
                }
            }
        }
    }
}
