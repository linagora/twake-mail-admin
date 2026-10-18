package com.linagora.admin.e2e.calendar.ops;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.regex.Pattern;

import org.awaitility.Awaitility;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.linagora.admin.e2e.CalendarAdminE2ETest;
import com.linagora.admin.e2e.backend.CalendarFixtures;
import com.linagora.admin.e2e.backend.Ids;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.docker.CalendarStack;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.calendar.ops.BookingLinksSection;
import com.linagora.admin.e2e.pages.calendar.ops.BookingLinksSection.Form;
import com.linagora.admin.e2e.pages.calendar.ops.CalendarUserPage;
import com.linagora.admin.e2e.pages.calendar.ops.Regex;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

class BookingLinksTest extends CalendarAdminE2ETest {

    @Test
    @DisplayName("BOOK-01 Create a booking link")
    void createBookingLink(AdminApp app, CalendarFixtures fixtures, WebAdmin webAdmin, CalendarStack stack) {
        OpsBackend backend = new OpsBackend(webAdmin, stack);
        String user = fixtures.newRegisteredUser("book");
        String calendarUrl = backend.defaultCalendarUrl(user);

        BookingLinksSection links = CalendarUserPage.open(app, user).bookingLinks();
        Form form = links.openCreate();
        assertThat(form.root().getByText("Calendar *", new Locator.GetByTextOptions().setExact(true))).isVisible();
        assertThat(form.root().getByText("Duration (minutes) *", new Locator.GetByTextOptions().setExact(true))).isVisible();
        assertThat(form.name()).isVisible();
        assertThat(form.description()).isVisible();
        assertThat(form.color()).isVisible();
        assertThat(form.calendarOptions()).hasCount(2);
        assertThat(form.create()).isDisabled();

        form.selectCalendar("#default");
        assertThat(form.create()).isEnabled();
        form.name().fill("Intro call");
        form.description().fill("A first contact");
        form.duration().fill("45");
        assertThat(form.active()).isChecked();
        form.autoAccept().check();
        form.button("Add rule").click();
        form.day(0).selectOption("MON");
        form.start(0).fill("09:00");
        form.end(0).fill("12:00");
        form.timeZone(0).fill("Europe/Paris");
        form.create().click();

        app.expectToast("Booking link created");
        assertThat(form.root()).isHidden();
        assertThat(app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(Pattern.compile("^Booking Links\\s*\\(1\\)$")))).isVisible();

        JsonNode link = backend.bookingLinks(user).get(0);
        String publicId = link.path("publicId").asText();
        assertThat(link.path("durationMinutes").asInt()).isEqualTo(45);
        assertThat(link.path("active").asBoolean()).isTrue();
        assertThat(link.path("autoAccept").asBoolean()).isTrue();
        assertThat(link.path("name").asText()).isEqualTo("Intro call");
        assertThat(link.path("calendarUrl").asText()).isEqualTo(calendarUrl);
        JsonNode rule = link.path("availabilityRules").get(0);
        assertThat(rule.path("dayOfWeek").asText()).isEqualTo("MON");
        assertThat(rule.path("start").asText()).isEqualTo("09:00");
        assertThat(rule.path("end").asText()).isEqualTo("12:00");
        assertThat(rule.path("timeZone").asText()).isEqualTo("Europe/Paris");

        Locator row = links.row(publicId);
        assertThat(row).containsText("Intro call");
        assertThat(row).containsText("A first contact");
        assertThat(row).containsText("#default");
        assertThat(row).containsText("45 min");
        assertThat(row).containsText("· 1 rule");
        assertThat(row).containsText("· Auto-accept bookings");
        for (String action : new String[] {"Delete associated events", "Reset public ID", "Duplicate booking link", "Edit booking link", "Delete booking link"}) {
            assertThat(links.rowAction(publicId, action)).isVisible();
        }
    }

    @Test
    @DisplayName("BOOK-02 Edit a booking link and its rules")
    void editBookingLinkAndRules(AdminApp app, CalendarFixtures fixtures, WebAdmin webAdmin, CalendarStack stack) {
        OpsBackend backend = new OpsBackend(webAdmin, stack);
        String user = fixtures.newRegisteredUser("book");
        String publicId = backend.createIntroCall(user, "Intro call");

        BookingLinksSection links = CalendarUserPage.open(app, user).bookingLinks();
        assertThat(links.row(publicId)).containsText("· 1 rule");
        Form form = links.openEdit(publicId);
        form.duration().fill("30");
        form.active().uncheck();
        form.button("Duplicate rule").click();
        assertThat(form.day(1)).hasValue("MON");
        form.day(1).selectOption("WED");
        form.save().click();

        app.expectToast("Booking link updated");
        assertThat(form.root()).isHidden();
        assertThat(links.row(publicId)).containsText("Inactive ·");
        assertThat(links.row(publicId)).containsText("30 min");
        assertThat(links.row(publicId)).containsText("· 2 rules");
        JsonNode link = backend.bookingLink(user, publicId);
        assertThat(link.path("active").asBoolean()).isFalse();
        assertThat(link.path("durationMinutes").asInt()).isEqualTo(30);
        assertThat(link.path("availabilityRules")).hasSize(2);
        assertThat(link.path("availabilityRules").get(1).path("dayOfWeek").asText()).isEqualTo("WED");

        form = links.openEdit(publicId);
        form.button("Remove all rules").click();
        assertThat(form.root().getByText("All rules will be removed on save.")).isVisible();
        form.save().click();

        app.expectToast("Booking link updated");
        assertThat(links.row(publicId)).not().containsText("rule");
        JsonNode cleared = backend.bookingLink(user, publicId).path("availabilityRules");
        assertThat(cleared.isMissingNode() || cleared.isNull() || cleared.isEmpty()).as("rules %s", cleared).isTrue();
    }

    @Test
    @DisplayName("BOOK-03 Duplicate a booking link")
    void duplicateBookingLink(AdminApp app, CalendarFixtures fixtures, WebAdmin webAdmin, CalendarStack stack) {
        OpsBackend backend = new OpsBackend(webAdmin, stack);
        String user = fixtures.newRegisteredUser("book");
        String publicId = backend.createIntroCall(user, "Intro call");
        String calendarUrl = backend.defaultCalendarUrl(user);

        BookingLinksSection links = CalendarUserPage.open(app, user).bookingLinks();
        Form form = links.openDuplicate(publicId);
        assertThat(form.root().getByRole(AriaRole.HEADING)).hasText("Create booking link");
        assertThat(form.calendar()).hasValue(calendarUrl);
        assertThat(form.name()).hasValue("Intro call (copy)");
        assertThat(form.description()).hasValue("A first contact");
        assertThat(form.duration()).hasValue("45");
        assertThat(form.active()).isChecked();
        assertThat(form.autoAccept()).isChecked();
        assertThat(form.color()).hasValue("#00aa88");
        assertThat(form.day(0)).hasValue("MON");
        assertThat(form.start(0)).hasValue("09:00");
        assertThat(form.end(0)).hasValue("12:00");
        assertThat(form.timeZone(0)).hasValue("Europe/Paris");
        form.create().click();

        app.expectToast("Booking link created");
        assertThat(app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(Pattern.compile("^Booking Links\\s*\\(2\\)$")))).isVisible();
        JsonNode all = backend.bookingLinks(user);
        assertThat(all).hasSize(2);
        JsonNode copy = all.get(0).path("publicId").asText().equals(publicId) ? all.get(1) : all.get(0);
        assertThat(copy.path("publicId").asText()).isNotEqualTo(publicId);
        assertThat(copy.path("name").asText()).isEqualTo("Intro call (copy)");
        assertThat(copy.path("calendarUrl").asText()).isEqualTo(calendarUrl);
        assertThat(copy.path("durationMinutes").asInt()).isEqualTo(45);
        assertThat(copy.path("autoAccept").asBoolean()).isTrue();
        assertThat(copy.path("color").asText()).isEqualToIgnoringCase("#00aa88");
        assertThat(copy.path("availabilityRules")).hasSize(1);
        assertThat(links.row(copy.path("publicId").asText())).containsText("Intro call (copy)");
    }

    @Test
    @DisplayName("BOOK-04 Reset the public ID")
    void resetPublicId(AdminApp app, CalendarFixtures fixtures, WebAdmin webAdmin, CalendarStack stack) {
        OpsBackend backend = new OpsBackend(webAdmin, stack);
        String user = fixtures.newRegisteredUser("book");
        String publicId = backend.createIntroCall(user, "Intro call");

        BookingLinksSection links = CalendarUserPage.open(app, user).bookingLinks();
        links.rowAction(publicId, "Reset public ID").click();
        assertThat(app.dialog()).containsText("Generate a new public ID for the booking link \"Intro call\"? The current one will be invalidated.");
        app.confirm();

        app.expectToast("Public ID reset");
        JsonNode all = backend.bookingLinks(user);
        assertThat(all).hasSize(1);
        String newId = all.get(0).path("publicId").asText();
        assertThat(newId).isNotEqualTo(publicId);
        assertThat(links.row(newId)).containsText("Intro call");
        assertThat(app.main().getByText(publicId, new Locator.GetByTextOptions().setExact(true))).hasCount(0);
    }

    @Test
    @DisplayName("BOOK-05 Delete booked events and delete a link")
    void deleteBookedEventsAndLink(AdminApp app, Page page, CalendarFixtures fixtures, WebAdmin webAdmin, CalendarStack stack) {
        OpsBackend backend = new OpsBackend(webAdmin, stack);
        String user = fixtures.newRegisteredUser("book");
        String publicId = backend.createIntroCall(user, "Intro call");

        BookingLinksSection links = CalendarUserPage.open(app, user).bookingLinks();
        links.rowAction(publicId, "Delete associated events").click();
        assertThat(app.dialog()).containsText("Delete every calendar event created through the booking link \"Intro call\"?");
        app.confirm();

        Locator taskLink = app.toast("Task started").getByRole(AriaRole.LINK);
        assertThat(taskLink).hasText(Pattern.compile("^Task [0-9a-f-]{36}$"));
        String taskId = taskLink.textContent().substring("Task ".length());
        taskLink.click();
        assertThat(page).hasURL(Pattern.compile("/task/" + taskId + "$"));
        assertThat(webAdmin.awaitTask(taskId).path("status").asText()).isEqualTo("completed");

        links = CalendarUserPage.open(app, user).bookingLinks();
        links.rowAction(publicId, "Delete booking link").click();
        assertThat(app.dialog()).containsText("Do you really want to delete the booking link \"Intro call\"?");
        app.confirm();

        app.expectToast("Booking link deleted");
        assertThat(app.main().getByText(publicId, new Locator.GetByTextOptions().setExact(true))).hasCount(0);
        assertThat(app.main().getByText("No booking link.")).isVisible();
        assertThat(backend.bookingLinks(user)).isEmpty();
    }

    @Test
    @DisplayName("BOOK-06 Only bookable calendars are offered")
    void onlyBookableCalendarsAreOffered(AdminApp app, CalendarFixtures fixtures, WebAdmin webAdmin, CalendarStack stack) {
        OpsBackend backend = new OpsBackend(webAdmin, stack);
        String owner = fixtures.newRegisteredUser("charlotte");
        String bob = fixtures.newRegisteredUser("bob");
        backend.calendars(bob);
        String ownerMain = OpsBackend.lastSegment(backend.defaultCalendarUrl(owner));
        String writable = backend.createCalendar(owner, "Writable");
        backend.share(owner, ownerMain, bob, "dav:read");
        backend.share(owner, writable, bob, "dav:read-write");
        String room = "Room " + Ids.suffix(6);
        String resourceId = backend.createResource(room, bob);
        try {
            Awaitility.await().atMost(Duration.ofSeconds(20)).until(() -> backend.calendars(bob).size() >= 4);

            Form form = CalendarUserPage.open(app, bob).bookingLinks().openCreate();
            assertThat(form.calendarOptions()).hasText(new String[] {"Select a calendar…", "#default", "Writable"});
            form.selectCalendar("Writable");
            assertThat(form.calendar()).hasValue(Pattern.compile("^/calendars/" + Regex.quote(OpsBackend.lastSegment(backend.defaultCalendarUrl(bob))) + "/"));
            assertThat(form.calendar().locator("option", new Locator.LocatorOptions().setHasText(room))).hasCount(0);
            form.cancel();
        } finally {
            backend.deleteResource(resourceId);
        }
    }

    @Test
    @DisplayName("BOOK-07 Duration field validation")
    void durationFieldValidation(AdminApp app, CalendarFixtures fixtures, WebAdmin webAdmin, CalendarStack stack) {
        OpsBackend backend = new OpsBackend(webAdmin, stack);
        String user = fixtures.newRegisteredUser("book");
        String publicId = backend.createIntroCall(user, "Intro call");

        BookingLinksSection links = CalendarUserPage.open(app, user).bookingLinks();
        Form form = links.openCreate();
        form.selectCalendar("#default");
        assertThat(form.create()).isEnabled();

        form.duration().clear();
        assertThat(form.duration()).hasValue("");
        assertThat(form.durationError()).isVisible();
        assertThat(form.create()).isDisabled();
        for (String invalid : new String[] {"0", "-5", "1.5"}) {
            form.duration().fill(invalid);
            assertThat(form.durationError()).isVisible();
            assertThat(form.create()).isDisabled();
        }
        form.duration().clear();
        form.duration().pressSequentially("45");
        assertThat(form.duration()).hasValue("45");
        assertThat(form.durationError()).isHidden();
        assertThat(form.create()).isEnabled();
        form.cancel();

        form = links.openEdit(publicId);
        form.duration().clear();
        assertThat(form.durationError()).isVisible();
        assertThat(form.save()).isDisabled();
        form.duration().pressSequentially("90");
        assertThat(form.duration()).hasValue("90");
        assertThat(form.save()).isEnabled();
        form.save().click();

        app.expectToast("Booking link updated");
        assertThat(links.row(publicId)).containsText("90 min");
        assertThat(backend.bookingLink(user, publicId).path("durationMinutes").asInt()).isEqualTo(90);
    }

    @Test
    @DisplayName("BOOK-08 Calendar dropdown follows the Calendars section")
    void calendarDropdownFollowsCalendarsSection(AdminApp app, CalendarFixtures fixtures, WebAdmin webAdmin, CalendarStack stack) {
        OpsBackend backend = new OpsBackend(webAdmin, stack);
        String user = fixtures.newRegisteredUser("book");
        String publicId = backend.createIntroCall(user, "Intro call");

        CalendarUserPage userPage = CalendarUserPage.open(app, user);
        BookingLinksSection links = userPage.bookingLinks();
        Form form = links.openCreate();
        assertThat(form.calendarOptions()).hasText(new String[] {"Select a calendar…", "#default"});
        form.cancel();

        userPage.expandCalendars().createCalendar("QA Bookable");

        form = links.openCreate();
        assertThat(form.calendarOptions()).hasText(new String[] {"Select a calendar…", "#default", "QA Bookable"});
        form.cancel();
        form = links.openEdit(publicId);
        assertThat(form.calendar().locator("option", new Locator.LocatorOptions().setHasText("QA Bookable"))).hasCount(1);
        form.cancel();

        userPage.deleteCalendar("QA Bookable");
        form = links.openCreate();
        assertThat(form.calendarOptions()).hasText(new String[] {"Select a calendar…", "#default"});
        form.cancel();
    }
}
