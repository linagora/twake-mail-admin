package com.linagora.admin.e2e.pages.calendar.ops;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.util.regex.Pattern;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.AriaRole;

/**
 * Common Tasks of the Calendar flavour: server wide maintenance tasks grouped by purpose, each
 * row with its name, risk badge, description and a Run button coloured by its risk.
 */
public class CommonTasksPage {
    /** The groups, in display order. */
    public static final String[] GROUPS = {"Users and contacts", "Search index", "Consistency repair", "Cleanup"};

    /** The tasks, in display order: group after group. */
    public static final String[] TASKS = {
        "Import LDAP users", "Domain member synchronization", "Add missing fields to registered users",
        "Republish all common contacts",
        "Calendar event reindexing",
        "Alarm rescheduling",
        "Calendar event archival", "Delete domain members contacts of all domains"};

    private final AdminApp app;

    private CommonTasksPage(AdminApp app) {
        this.app = app;
    }

    public static CommonTasksPage open(AdminApp app) {
        app.open("/");
        app.navigate("Common Tasks");
        CommonTasksPage page = new CommonTasksPage(app);
        assertThat(page.runButton(TASKS[0])).isVisible();
        return page;
    }

    /** The headings of the task groups, in display order. */
    public Locator groupHeadings() {
        return app.main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setLevel(2));
    }

    /** The group of tasks under a heading. */
    public Locator group(String name) {
        return app.main().getByRole(AriaRole.REGION, new Locator.GetByRoleOptions().setName(name).setExact(true));
    }

    public Locator filter() {
        return app.main().getByPlaceholder("Filter tasks…");
    }

    /** The row of a task, by its name: name, "(doc)", risk badge, description, Run. */
    public Locator row(String task) {
        return app.main().getByText(Pattern.compile("^" + Regex.quote(task) + "( \\(doc\\))?$"))
            .locator("xpath=ancestor::*[@data-task-row][1]");
    }

    /** The Run button of a task, by its name. */
    public Locator runButton(String task) {
        return row(task).getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(AdminApp.RUN_TASK_BUTTON));
    }

    public Locator runButtons() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(AdminApp.RUN_TASK_BUTTON));
    }

    /** Clicks Run next to a task and returns its dialog, titled after the task. */
    public TaskDialog run(String task) {
        // A closed dialog gives the focus back to its Run button, whose tooltip then opens over
        // its neighbours: the focus is moved away first
        app.heading().click();
        runButton(task).click();
        TaskDialog dialog = new TaskDialog(app);
        assertThat(dialog.title()).hasText(task);
        return dialog;
    }
}
