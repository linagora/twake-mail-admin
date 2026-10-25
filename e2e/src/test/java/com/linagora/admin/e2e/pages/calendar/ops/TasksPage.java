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

    /** Opens Tasks by its URL, without the sidebar: folded on a phone. */
    public static TasksPage openByUrl(AdminApp app) {
        app.page().navigate("/tasks");
        TasksPage page = new TasksPage(app);
        assertThat(page.button("Refresh")).isVisible();
        return page;
    }

    public Locator button(String name) {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(name).setExact(true));
    }

    public Locator rows() {
        return app.page().getByTestId("task-row");
    }

    /** A row, by the full task id its muted "type · short id" line carries as tooltip. */
    public Locator row(String taskId) {
        return rows().filter(new Locator.FilterOptions().setHas(app.page().locator("[title='" + taskId + "']")));
    }

    /** The name of every listed task ("Import events (ICS)"), in display order: what sorting by type orders. */
    @SuppressWarnings("unchecked")
    public List<String> types() {
        return (List<String>) rows().evaluateAll("rows => rows.map(r => r.querySelector('button').textContent.trim())");
    }

    /** The id of every listed row, in display order. */
    @SuppressWarnings("unchecked")
    public List<String> ids() {
        return (List<String>) rows().evaluateAll("rows => rows.map(r => r.querySelector('span.font-mono[title]').title)");
    }

    /**
     * The pagination line: "Page 2 — 50 result(s)" with its buttons, or only "Total: 12" when
     * the list fits on one page.
     */
    public Locator pagination() {
        return app.main().getByText(Pattern.compile("^(Page \\d+ — \\d+ result\\(s\\)|Total: \\d+)$"));
    }

    /** The raw JSON of a task, folded under "Raw JSON" in the detail dialog and on the task page. */
    public static Locator rawJson(Locator scope) {
        return scope.locator("details").filter(new Locator.FilterOptions().setHasText(
            Pattern.compile("^(Raw JSON|JSON brut)"))).locator("pre");
    }

    /** Unfolds the raw JSON of a task. */
    public static Locator showRawJson(Locator scope) {
        scope.getByText(Pattern.compile("^(Raw JSON|JSON brut)$")).click();
        Locator json = rawJson(scope);
        assertThat(json).isVisible();
        return json;
    }

    /** A value of the readable summary of a task ("Status", "Type", "Duration"...): the cell after its label. */
    public static Locator summaryValue(Locator scope, String label) {
        return scope.getByText(label, new Locator.GetByTextOptions().setExact(true)).first()
            .locator("xpath=following-sibling::*[1]");
    }

    public Locator field(String label) {
        return app.main().getByLabel(label, new Locator.GetByLabelOptions().setExact(true));
    }

    /** A quick status chip, "Failed (2)", by its name without the count. */
    public Locator statusChip(String name) {
        return app.main().getByRole(AriaRole.GROUP, new Locator.GetByRoleOptions().setName("Status").setExact(true))
            .getByRole(AriaRole.BUTTON).filter(new Locator.FilterOptions().setHasText(
                java.util.regex.Pattern.compile("^" + name + "( \\(\\d+\\))?$")));
    }

    /** Unfolds "Date filters" in the open filters panel. */
    public TasksPage openDateFilters() {
        Locator details = app.main().getByTestId("tasks-date-filters");
        if (details.getAttribute("open") == null) {
            details.locator("summary").click();
        }
        return this;
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
        // The button naming the task: "Import events (ICS)"
        row(taskId).getByRole(AriaRole.BUTTON).first().click();
        assertThat(app.dialog()).isVisible();
        return app.dialog();
    }

    /** Switches the language of the app from the sidebar ("Français", "English"). */
    public static void switchLanguage(AdminApp app, String label) {
        app.sidebar().getByTitle(Pattern.compile("^(Language|Langue)$")).click();
        app.page().getByRole(AriaRole.OPTION, new Page.GetByRoleOptions().setName(label).setExact(true)).click();
    }
}
