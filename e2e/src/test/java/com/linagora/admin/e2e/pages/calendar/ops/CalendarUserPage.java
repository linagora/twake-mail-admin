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

    /** Opens a section unless it is open already: the sections remember their state across pages and reloads. */
    public CalendarUserPage expand(String title) {
        Locator toggle = toggle(title);
        if (!"true".equals(toggle.getAttribute("aria-expanded"))) {
            toggle.click();
        }
        assertThat(toggle).hasAttribute("aria-expanded", "true");
        return this;
    }

    public BookingLinksSection bookingLinks() {
        expand("Booking Links");
        BookingLinksSection section = new BookingLinksSection(app);
        assertThat(section.createButton()).isVisible();
        return section;
    }

    /** Expands Calendars. */
    public CalendarUserPage expandCalendars() {
        expand("Calendars");
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
        confirmWith("Delete");
        app.expectToast("Calendar deleted");
        return this;
    }

    /** Expands Tasks. */
    public CalendarUserPage expandTasks() {
        expand("Tasks");
        assertThat(taskRow("Archive calendar events")).isVisible();
        return this;
    }

    /** Clicks the confirm button of the open confirmation, named after its action ("Delete"), and waits for it to close. */
    public CalendarUserPage confirmWith(String label) {
        app.dialog().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(label).setExact(true)).click();
        assertThat(app.dialog()).isHidden();
        return this;
    }

    /** The row of a user task: title, risk badge, description and Run. */
    public Locator taskRow(String name) {
        return app.main().getByText(name, new Locator.GetByTextOptions().setExact(true))
            .locator("xpath=ancestor::*[@data-task-row][1]");
    }

    /** The titles of the user tasks, in display order. */
    public Locator taskTitles() {
        return app.main().locator("[data-task-row] p.font-medium");
    }

    /** Clicks Run next to a user task ("Archive calendar events"...), returns its dialog. */
    public TaskDialog runTask(String name) {
        runButton(name).click();
        TaskDialog dialog = new TaskDialog(app);
        assertThat(dialog.root()).isVisible();
        return dialog;
    }

    public Locator runButton(String name) {
        return taskRow(name).getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(AdminApp.RUN_TASK_BUTTON));
    }
}
