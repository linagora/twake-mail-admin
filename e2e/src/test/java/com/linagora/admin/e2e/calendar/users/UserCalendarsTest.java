package com.linagora.admin.e2e.calendar.users;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.regex.Pattern;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;

import com.fasterxml.jackson.databind.JsonNode;
import com.linagora.admin.e2e.CalendarAdminE2ETest;
import com.linagora.admin.e2e.backend.CalendarFixtures;
import com.linagora.admin.e2e.backend.Ids;
import com.linagora.admin.e2e.docker.Locks;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.calendar.users.CollectionForm;
import com.linagora.admin.e2e.pages.calendar.users.CollectionSection;
import com.linagora.admin.e2e.pages.calendar.users.UserDetailPage;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.assertions.LocatorAssertions;
import com.microsoft.playwright.options.AriaRole;

// Server wide tasks (archival of every user...) add calendars to every user: counts would move.
@ResourceLock(value = Locks.CALENDAR_SERVER_TASKS, mode = ResourceAccessMode.READ)
class UserCalendarsTest extends CalendarAdminE2ETest {
    private static final String[] OWNED_ROW_BUTTONS = {"Export the calendar (ICS)", "Import events (ICS)",
        "Delegation (invitees)", "Private calendar", "Edit calendar", "Delete calendar"};
    private static final String MAIN_CALENDAR_UNDELETABLE = "The main calendar cannot be deleted";

    @Test
    @DisplayName("UCAL-01 Create a calendar")
    void createCalendar(AdminApp app, CalendarFixtures fixtures) {
        DavSeeds seeds = new DavSeeds(fixtures);
        String user = seeds.newUser("c3ucal01");
        CollectionSection calendars = new UserDetailPage(app).open(user).calendars().expand();
        assertThat(calendars.groupHeading("Owner")).hasText(Pattern.compile("\\(1\\)$"));

        calendars.createButton().click();
        CollectionForm form = new CollectionForm(app);
        assertThat(form.title()).hasText("Create calendar");
        assertThat(form.createButton()).isDisabled();
        form.name().fill("QA Cal");
        form.colorCode().fill("#ff0000");
        form.description().fill("QA");
        assertThat(form.createButton()).isEnabled();
        form.createButton().click();

        app.expectToast("Calendar created");
        assertThat(form.dialog()).isHidden();
        assertThat(calendars.groupHeading("Owner")).hasText(Pattern.compile("\\(2\\)$"));
        Locator row = calendars.rowInGroup("Owner", "QA Cal");
        assertThat(row.getByTitle("#ff0000")).hasCSS("background-color", "rgb(255, 0, 0)");
        assertThat(row.getByText("QA", new Locator.GetByTextOptions().setExact(true))).isVisible();
        assertThat(CollectionSection.counter(row, "Events")).hasText("0");
        for (String button : OWNED_ROW_BUTTONS) {
            assertThat(CollectionSection.button(row, button)).isEnabled();
        }

        JsonNode created = seeds.calendarNamed(user, "QA Cal").orElseThrow();
        assertThat(created.path("apple:color").asText()).isEqualTo("#ff0000");
        assertThat(created.path("caldav:description").asText()).isEqualTo("QA");
    }

    @Test
    @DisplayName("UCAL-02 Edit a calendar")
    void editCalendar(AdminApp app, CalendarFixtures fixtures) {
        DavSeeds seeds = new DavSeeds(fixtures);
        String user = seeds.newUser("c3ucal02");
        seeds.createCalendar(user, "QA Cal", "#ff0000", "QA");
        CollectionSection calendars = new UserDetailPage(app).open(user).calendars().expand();

        CollectionSection.button(calendars.row("QA Cal"), "Edit calendar").click();
        CollectionForm form = new CollectionForm(app);
        assertThat(form.title()).hasText("Edit calendar — QA Cal");
        assertThat(form.name()).hasValue("QA Cal");
        assertThat(form.colorCode()).hasValue("#ff0000");
        assertThat(form.description()).hasValue("QA");
        form.name().fill("");
        assertThat(form.saveButton()).isDisabled();
        form.name().fill("QA Cal 2");
        form.colorCode().fill("#00ff00");
        form.description().fill("QA 2");
        form.saveButton().click();

        app.expectToast("Calendar updated");
        assertThat(form.dialog()).isHidden();
        Locator row = calendars.row("QA Cal 2");
        assertThat(row.getByTitle("#00ff00")).hasCSS("background-color", "rgb(0, 255, 0)");
        assertThat(row.getByText("QA 2", new Locator.GetByTextOptions().setExact(true))).isVisible();
        assertThat(calendars.rows("QA Cal")).hasCount(0);

        JsonNode updated = seeds.calendarNamed(user, "QA Cal 2").orElseThrow();
        assertThat(updated.path("apple:color").asText()).isEqualTo("#00ff00");
        assertThat(updated.path("caldav:description").asText()).isEqualTo("QA 2");
    }

    @Test
    @DisplayName("UCAL-03 Delete a calendar")
    void deleteCalendar(AdminApp app, CalendarFixtures fixtures) {
        DavSeeds seeds = new DavSeeds(fixtures);
        String user = seeds.newUser("c3ucal03");
        seeds.createCalendar(user, "QA Cal 2");
        CollectionSection calendars = new UserDetailPage(app).open(user).calendars().expand();
        calendars.expectCount(2);

        CollectionSection.button(calendars.row("QA Cal 2"), "Delete calendar").click();
        assertThat(app.dialog().getByText("Do you really want to delete the calendar \"QA Cal 2\"?")).isVisible();
        CollectionSection.confirmWith(app, "Delete");

        app.expectToast("Calendar deleted");
        assertThat(calendars.rows("QA Cal 2")).hasCount(0);
        calendars.expectCount(1);
        assertThat(seeds.calendarNamed(user, "QA Cal 2")).isEmpty();
    }

    @Test
    @DisplayName("UCAL-04 Calendar public visibility")
    void calendarPublicVisibility(AdminApp app, CalendarFixtures fixtures) {
        DavSeeds seeds = new DavSeeds(fixtures);
        String user = seeds.newUser("c3ucal04");
        CollectionSection calendars = new UserDetailPage(app).open(user).calendars().expand();
        Locator row = calendars.row("Main calendar");

        CollectionSection.button(row, "Private calendar").click();
        Locator dialog = app.dialog();
        assertThat(dialog.getByRole(AriaRole.HEADING)).hasText("Public visibility — Main calendar");
        assertThat(radio(dialog, "Private")).isChecked();
        assertThat(radio(dialog, "Public")).not().isChecked();
        radio(dialog, "Public").check();
        CollectionSection.button(dialog, "Save").click();

        app.expectToast("Visibility updated");
        assertThat(dialog).isHidden();
        assertThat(CollectionSection.button(row, "Public calendar (read)")).isVisible();
        assertThat(CollectionSection.button(row, "Private calendar")).hasCount(0);
        assertThat(isPublic(seeds.calendarNamed(user, "#default").orElseThrow())).isTrue();

        CollectionSection.button(row, "Public calendar (read)").click();
        assertThat(radio(dialog, "Public")).isChecked();
        radio(dialog, "Private").check();
        CollectionSection.button(dialog, "Save").click();

        app.expectToast("Visibility updated");
        assertThat(dialog).isHidden();
        assertThat(CollectionSection.button(row, "Private calendar")).isVisible();
        assertThat(isPublic(seeds.calendarNamed(user, "#default").orElseThrow())).isFalse();
    }

    @Test
    @DisplayName("UCAL-07 Import, count and export calendar events")
    void importCountAndExportEvents(AdminApp app, CalendarFixtures fixtures) {
        DavSeeds seeds = new DavSeeds(fixtures);
        String user = seeds.newUser("c3ucal07");
        CollectionSection calendars = new UserDetailPage(app).open(user).calendars().expand();
        Locator row = calendars.row("Main calendar");
        Locator counter = CollectionSection.counter(row, "Events");
        assertThat(counter).hasText("0");

        String uid = Ids.unique("c3ucal07-event");
        String taskId = calendars.importFile(row, "events.ics", "text/calendar", DavSeeds.ics(uid, "QA event"));
        JsonNode task = fixtures.webAdmin().awaitTask(taskId);
        assertThat(task.path("status").asText()).isEqualTo("completed");
        assertThat(task.path("type").asText()).isEqualTo("calendar-import");
        // The row re-reads its counter once it saw the task end (polled every 2 s), no reload
        assertThat(counter).hasText("1", new LocatorAssertions.HasTextOptions().setTimeout(30_000));

        CollectionSection.Exported exported = calendars.export(CollectionSection.button(row, "Export the calendar (ICS)"));
        assertThat(exported.fileName()).isEqualTo("Main_calendar.ics");
        assertThat(exported.content()).contains("UID:" + uid).contains("SUMMARY:QA event");
    }

    @Test
    @DisplayName("UCAL-08 Calendar colour validation")
    void calendarColourValidation(AdminApp app, CalendarFixtures fixtures) {
        DavSeeds seeds = new DavSeeds(fixtures);
        String user = seeds.newUser("c3ucal08");
        CollectionSection calendars = new UserDetailPage(app).open(user).calendars().expand();

        calendars.createButton().click();
        CollectionForm form = new CollectionForm(app);
        form.name().fill("QA Colour");
        for (String invalid : new String[] {"notacolor", "#12345"}) {
            form.colorCode().fill(invalid);
            assertThat(form.colorCode()).hasAttribute("aria-invalid", "true");
            assertThat(form.colorError()).isVisible();
            assertThat(form.createButton()).isDisabled();
            assertThat(form.colorPicker()).hasValue("#007fd8");
        }
        form.colorCode().fill("#00ff0080");
        assertValid(form);
        assertThat(form.colorPicker()).hasValue("#00ff00");
        assertThat(form.createButton()).isEnabled();
        form.colorCode().fill("");
        assertValid(form);
        assertThat(form.createButton()).isEnabled();

        form.colorCode().fill("#00ff00");
        form.createButton().click();
        app.expectToast("Calendar created");
        assertThat(form.dialog()).isHidden();
        assertThat(seeds.calendarNamed(user, "QA Colour").orElseThrow().path("apple:color").asText()).isEqualTo("#00ff00");

        CollectionSection.button(calendars.row("QA Colour"), "Edit calendar").click();
        form.colorCode().fill("red; x");
        assertThat(form.colorCode()).hasAttribute("aria-invalid", "true");
        assertThat(form.colorError()).isVisible();
        assertThat(form.saveButton()).isDisabled();
        form.colorCode().fill("#0000ff");
        assertValid(form);
        form.saveButton().click();
        app.expectToast("Calendar updated");
        assertThat(form.dialog()).isHidden();
        assertThat(seeds.calendarNamed(user, "QA Colour").orElseThrow().path("apple:color").asText()).isEqualTo("#0000ff");
    }

    @Test
    @DisplayName("UCAL-09 The main calendar cannot be deleted")
    void mainCalendarCannotBeDeleted(AdminApp app, Page page, CalendarFixtures fixtures) {
        DavSeeds seeds = new DavSeeds(fixtures);
        String user = seeds.newUser("c3ucal09");
        seeds.createCalendar(user, "QA Extra");
        CollectionSection calendars = new UserDetailPage(app).open(user).calendars().expand();

        Locator mainDelete = CollectionSection.button(calendars.row("Main calendar"), "Delete calendar");
        assertThat(mainDelete).isDisabled();
        // The disabled button gets no pointer event: its wrapper carries the hint
        Locator mainDeleteHint = mainDelete.locator("xpath=..");
        assertThat(mainDeleteHint).hasAccessibleDescription(MAIN_CALENDAR_UNDELETABLE);
        mainDeleteHint.hover();
        assertThat(page.getByRole(AriaRole.TOOLTIP)).hasText(MAIN_CALENDAR_UNDELETABLE);
        mainDelete.click(new Locator.ClickOptions().setForce(true));
        assertThat(app.dialog()).hasCount(0);

        Locator extraDelete = CollectionSection.button(calendars.row("QA Extra"), "Delete calendar");
        assertThat(extraDelete).isEnabled();
        extraDelete.click();
        assertThat(app.dialog().getByText("Do you really want to delete the calendar \"QA Extra\"?")).isVisible();
        app.cancel();
        assertThat(seeds.calendarNamed(user, "#default")).isPresent();
    }

    private static Locator radio(Locator dialog, String label) {
        return dialog.getByRole(AriaRole.RADIO, new Locator.GetByRoleOptions().setName(Pattern.compile("^" + label)));
    }

    private static void assertValid(CollectionForm form) {
        assertThat(form.colorCode()).hasAttribute("aria-invalid", "false");
        assertThat(form.colorError()).isHidden();
    }

    static boolean isPublic(JsonNode collection) {
        for (JsonNode ace : collection.path("acl")) {
            if (ace.path("principal").asText().equals("{DAV:}authenticated")
                && ace.path("privilege").asText().matches("\\{DAV:\\}(read|write|all)")) {
                return true;
            }
        }
        return false;
    }
}
