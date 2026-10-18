package com.linagora.admin.e2e.pages.calendar.ops;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.util.List;
import java.util.regex.Pattern;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

/** The Tasks page: the task list of WebAdmin, its filters, sorting and detail dialog. */
public class TasksPage {
    private final AdminApp app;

    private TasksPage(AdminApp app) {
        this.app = app;
    }

    /** Opens Tasks from the sidebar, the app being already open. */
    public static TasksPage fromSidebar(AdminApp app) {
        app.navigate("Tasks");
        TasksPage page = new TasksPage(app);
        assertThat(page.button("Refresh")).isVisible();
        return page;
    }

    public static TasksPage open(AdminApp app) {
        app.open("/");
        return fromSidebar(app);
    }

    public Locator button(String name) {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(name).setExact(true));
    }

    public Locator rows() {
        return app.page().getByTestId("task-row");
    }

    public Locator row(String taskId) {
        return rows().filter(new Locator.FilterOptions().setHasText(taskId));
    }

    /** The type of every listed row, in display order. */
    @SuppressWarnings("unchecked")
    public List<String> types() {
        return (List<String>) rows().evaluateAll("rows => rows.map(r => r.querySelector('span[title]').title)");
    }

    /** The id of every listed row, in display order. */
    @SuppressWarnings("unchecked")
    public List<String> ids() {
        return (List<String>) rows().evaluateAll("rows => rows.map(r => r.querySelector('button').textContent.trim())");
    }

    public Locator pagination() {
        return app.main().getByText(Pattern.compile("^Page \\d+ — \\d+ result\\(s\\)$"));
    }

    public Locator field(String label) {
        return app.main().getByLabel(label, new Locator.GetByLabelOptions().setExact(true));
    }

    public TasksPage showFilters() {
        button("Filters").click();
        assertThat(button("Apply")).isVisible();
        return this;
    }

    public Locator sort() {
        return field("Sort:");
    }

    /** Opens the detail dialog of a task by clicking its ID. */
    public Locator openDetail(String taskId) {
        row(taskId).getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(taskId).setExact(true)).click();
        assertThat(app.dialog()).isVisible();
        return app.dialog();
    }

    /** Switches the language of the app from the sidebar ("Français", "English"). */
    public static void switchLanguage(AdminApp app, String label) {
        app.sidebar().getByTitle(Pattern.compile("^(Language|Langue)$")).click();
        app.page().getByRole(AriaRole.OPTION, new Page.GetByRoleOptions().setName(label).setExact(true)).click();
    }
}
