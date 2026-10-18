package com.linagora.admin.e2e.pages.mail.ops;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.util.regex.Pattern;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.AriaRole;

/** The Tasks page: list of WebAdmin tasks, filters, sort and the task detail dialog. */
public class TasksPage {
    private final AdminApp app;

    public TasksPage(AdminApp app) {
        this.app = app;
    }

    public static TasksPage open(AdminApp app) {
        app.open("/tasks");
        TasksPage page = new TasksPage(app);
        assertThat(page.refreshButton()).isVisible();
        return page;
    }

    public AdminApp app() {
        return app;
    }

    public Locator refreshButton() {
        return button("Refresh");
    }

    public Locator filtersButton() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(Pattern.compile("^(Filters|Hide Filters)$")));
    }

    public Locator button(String name) {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(name).setExact(true));
    }

    public Locator statusFilter() {
        return app.main().getByLabel("Status", new Locator.GetByLabelOptions().setExact(true));
    }

    public Locator typeFilter() {
        return app.main().getByLabel("Type", new Locator.GetByLabelOptions().setExact(true));
    }

    public Locator dateFilter(String label) {
        return app.main().getByLabel(label, new Locator.GetByLabelOptions().setExact(true));
    }

    public TasksPage applyFilters() {
        button("Apply").click();
        return this;
    }

    public Locator sortField() {
        return app.main().getByLabel("Sort:", new Locator.GetByLabelOptions().setExact(true));
    }

    public Locator sortDirection() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(Pattern.compile("^(Asc|Desc) ")));
    }

    public Locator rows() {
        return app.main().getByTestId("task-row");
    }

    /** The task ID button of a row: it opens the detail dialog. */
    public Locator taskIdButton(String taskId) {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(taskId).setExact(true));
    }

    public Locator row(String taskId) {
        return rows().filter(new Locator.FilterOptions().setHas(app.page().getByRole(AriaRole.BUTTON,
            new com.microsoft.playwright.Page.GetByRoleOptions().setName(taskId).setExact(true))));
    }

    /** The type of every displayed row, in order. */
    public Locator rowTypes() {
        return rows().locator("span[title]");
    }

    public Locator startedCompleted(String taskId) {
        return row(taskId).getByTestId("task-started-completed");
    }

    public Locator cancelButton(String taskId) {
        return row(taskId).getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Cancel").setExact(true));
    }

    public Locator pageLabel() {
        return app.main().getByText(Pattern.compile("^Page \\d+ — \\d+ result\\(s\\)$"));
    }

    public Locator emptyMessage() {
        return app.main().getByText("No tasks found matching the current filters.");
    }
}
