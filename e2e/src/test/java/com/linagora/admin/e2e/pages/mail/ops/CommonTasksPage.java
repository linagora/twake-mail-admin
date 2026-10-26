package com.linagora.admin.e2e.pages.mail.ops;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.util.regex.Pattern;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.AriaRole;

/**
 * Common Tasks: grouped by purpose, one row per task: its name (with a "(doc)" link), a risk
 * badge unless it is safe, a description, and a Run button coloured after the risk.
 */
public class CommonTasksPage {
    private final AdminApp app;

    public CommonTasksPage(AdminApp app) {
        this.app = app;
    }

    public static CommonTasksPage open(AdminApp app) {
        app.open("/common-tasks");
        CommonTasksPage page = new CommonTasksPage(app);
        assertThat(page.label("Recompute mailbox counters")).isVisible();
        return page;
    }

    public AdminApp app() {
        return app;
    }

    /** The label of a task row ({@code main p}, matched as a prefix: it may end with "(doc)"). */
    public Locator label(String name) {
        return app.main().locator("p").filter(new Locator.FilterOptions()
            .setHasText(Pattern.compile("^" + Regex.quote(name) + "( \\(doc\\))?$")));
    }

    public Locator row(String name) {
        return label(name).locator("xpath=ancestor::div[.//button][1]");
    }

    /** The description shown under the name of a task. */
    public Locator description(String name) {
        return row(name).locator("p").nth(1);
    }

    /** The risk badge of a task: "Modifies data" or "Deletes data"; none for a safe task. */
    public Locator riskBadge(String name) {
        return row(name).getByText(Pattern.compile("^(Modifies data|Deletes data)$"));
    }

    /** A group of tasks ("Search index", "Consistency repair", "Cleanup", "Server"), by its h2. */
    public Locator group(String title) {
        return app.main().getByRole(AriaRole.REGION, new Locator.GetByRoleOptions().setName(title).setExact(true));
    }

    /** The filter on the names and descriptions of the tasks. */
    public Locator filter() {
        return app.main().getByLabel("Filter tasks…", new Locator.GetByLabelOptions().setExact(true));
    }

    public Locator runButton(String name) {
        return row(name).getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(AdminApp.RUN_TASK_BUTTON));
    }

    public CommonTasksPage run(String name) {
        runButton(name).click();
        assertThat(app.dialog()).isVisible();
        return this;
    }

    /** A field of the open task dialog, by its raw key ({@code "messagesPerSecond"}...). */
    public Locator param(String key) {
        return Dialogs.param(app, key);
    }

    public Locator commandPreview() {
        return Dialogs.commandPreview(app);
    }
}
