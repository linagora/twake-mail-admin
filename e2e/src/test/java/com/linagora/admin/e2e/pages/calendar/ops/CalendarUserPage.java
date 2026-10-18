package com.linagora.admin.e2e.pages.calendar.ops;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.AriaRole;

/** The detail page of a calendar user: its Booking Links, Calendars and Tasks sections. */
public class CalendarUserPage {
    private final AdminApp app;
    private final String username;

    private CalendarUserPage(AdminApp app, String username) {
        this.app = app;
        this.username = username;
    }

    public static CalendarUserPage open(AdminApp app, String username) {
        app.open("/users/user/" + URLEncoder.encode(username, StandardCharsets.UTF_8));
        CalendarUserPage page = new CalendarUserPage(app, username);
        assertThat(page.toggle("Calendars")).isVisible();
        return page;
    }

    public String username() {
        return username;
    }

    public AdminApp app() {
        return app;
    }

    /** The title button of a collapsible section, "Booking Links (2)". */
    public Locator toggle(String title) {
        return app.main().getByRole(AriaRole.BUTTON,
            new Locator.GetByRoleOptions().setName(Pattern.compile("^" + Regex.quote(title) + "\\s*(\\(\\d+\\))?$")));
    }

    public BookingLinksSection bookingLinks() {
        toggle("Booking Links").click();
        BookingLinksSection section = new BookingLinksSection(app);
        assertThat(section.createButton()).isVisible();
        return section;
    }

    /** Expands Calendars. */
    public CalendarUserPage expandCalendars() {
        toggle("Calendars").click();
        assertThat(app.button("Create calendar")).isVisible();
        return this;
    }

    public CalendarUserPage createCalendar(String name) {
        app.button("Create calendar").click();
        app.dialog().getByLabel("Name *", new Locator.GetByLabelOptions().setExact(true)).fill(name);
        app.dialog().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Create").setExact(true)).click();
        assertThat(app.dialog()).isHidden();
        app.expectToast("Calendar created");
        return this;
    }

    public CalendarUserPage deleteCalendar(String name) {
        app.main().getByText(name, new Locator.GetByTextOptions().setExact(true))
            .locator("xpath=ancestor::div[.//button[@title='Delete calendar']][1]")
            .getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Delete calendar")).click();
        app.confirm();
        app.expectToast("Calendar deleted");
        return this;
    }

    /** Expands Tasks. */
    public CalendarUserPage expandTasks() {
        toggle("Tasks").click();
        assertThat(app.main().getByText("Archive calendar events", new Locator.GetByTextOptions().setExact(true))).isVisible();
        return this;
    }

    /** Clicks Run next to a user task ("Archive calendar events"...), returns its dialog. */
    public TaskDialog runTask(String name) {
        app.main().getByText(name, new Locator.GetByTextOptions().setExact(true)).locator("xpath=..")
            .getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Run").setExact(true)).click();
        TaskDialog dialog = new TaskDialog(app);
        assertThat(dialog.root()).isVisible();
        return dialog;
    }

    public Locator runButton(String name) {
        return app.main().getByText(name, new Locator.GetByTextOptions().setExact(true)).locator("xpath=..")
            .getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Run").setExact(true));
    }
}
