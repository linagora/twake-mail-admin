package com.linagora.admin.e2e.pages.calendar.ops;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.util.regex.Pattern;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.AriaRole;

/** Common Tasks of the Calendar flavour: server wide maintenance tasks, each with a Run button. */
public class CommonTasksPage {
    public static final String[] TASKS = {
        "Import LDAP users", "Domain member synchronization", "Calendar event reindexing", "Calendar event archival",
        "Alarm rescheduling", "Add missing fields to registered users", "Republish all common contacts",
        "Delete domain members contacts of all domains"};

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

    /** The Run button of a task, by its name. */
    public Locator runButton(String task) {
        return app.main().getByText(Pattern.compile("^" + Regex.quote(task) + "( \\(doc\\))?$")).locator("xpath=..")
            .getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Run").setExact(true));
    }

    public Locator runButtons() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Run").setExact(true));
    }

    public TaskDialog run(String task) {
        // A closed dialog gives the focus back to its Run button, whose tooltip then opens over
        // its neighbours: the focus is moved away first
        app.heading().click();
        runButton(task).click();
        TaskDialog dialog = new TaskDialog(app);
        assertThat(dialog.root()).containsText("Do you want to run task " + task + "?");
        return dialog;
    }
}
