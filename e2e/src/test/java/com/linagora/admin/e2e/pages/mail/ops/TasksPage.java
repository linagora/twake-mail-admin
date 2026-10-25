package com.linagora.admin.e2e.pages.mail.ops;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.util.List;
import java.util.regex.Pattern;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.AriaRole;

/**
 * The Tasks page: list of WebAdmin tasks, status chips, the filters panel (type, then the dates
 * folded in "Date filters"), sort and the task detail dialog. Filters, sort and page live in the URL.
 */
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
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(Pattern.compile("^(Filters( \\(\\d+ active\\))?|Hide Filters)$")));
    }

    public Locator button(String name) {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(name).setExact(true));
    }

    /** The quick status chips: All, Running, Failed, Completed, Cancelled, each with its count. */
    public Locator statusChips() {
        return app.main().getByRole(AriaRole.GROUP, new Locator.GetByRoleOptions().setName("Status").setExact(true))
            .getByRole(AriaRole.BUTTON);
    }

    /** A status chip, "Failed (2)", by its name without the count. */
    public Locator statusChip(String name) {
        return statusChips().filter(new Locator.FilterOptions().setHasText(Pattern.compile("^" + name + "( \\(\\d+\\))?$")));
    }

    /** The type picker: task names, the raw WebAdmin type as value. */
    public Locator typeFilter() {
        return app.main().getByLabel("Type", new Locator.GetByLabelOptions().setExact(true));
    }

    /** Unfolds "Date filters" in the open filters panel. */
    public TasksPage openDateFilters() {
        Locator details = app.main().getByTestId("tasks-date-filters");
        if (details.getAttribute("open") == null) {
            details.locator("summary").click();
        }
        return this;
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

    /** The button naming the task of a row ("Reindex all mailboxes"): it opens the detail dialog. */
    public Locator taskIdButton(String taskId) {
        return row(taskId).getByRole(AriaRole.BUTTON).first();
    }

    /** A row, by the full task id its muted "type · short id" line carries as tooltip. */
    public Locator row(String taskId) {
        return rows().filter(new Locator.FilterOptions().setHas(app.page().locator("[title='" + taskId + "']")));
    }

    /** The "type · short id" line of every displayed row, in order. */
    public Locator rowTypes() {
        return rows().locator("span.font-mono[title]");
    }

    /** The name of every displayed task, in order: what sorting by type orders. */
    @SuppressWarnings("unchecked")
    public List<String> names() {
        return (List<String>) rows().evaluateAll("rows => rows.map(r => r.querySelector('button').textContent.trim())");
    }

    public Locator startedCompleted(String taskId) {
        return row(taskId).getByTestId("task-started-completed");
    }

    public Locator cancelButton(String taskId) {
        return row(taskId).getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Cancel task").setExact(true));
    }

    /** "Page 2 — 20 result(s)", or "Total: 7" alone when every task fits on one page. */
    public Locator pageLabel() {
        return app.main().getByText(Pattern.compile("^(Page \\d+ — \\d+ result\\(s\\)|Total: \\d+)$"));
    }

    public Locator emptyMessage() {
        return app.main().getByText("No tasks found matching the current filters.");
    }
}
