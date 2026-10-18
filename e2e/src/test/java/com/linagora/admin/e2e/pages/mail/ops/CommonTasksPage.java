package com.linagora.admin.e2e.pages.mail.ops;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.util.regex.Pattern;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.AriaRole;

/** Common Tasks: one row per task, a label (with a "(doc)" link) and a Run button. */
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

    public Locator runButton(String name) {
        return row(name).getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Run").setExact(true));
    }

    public CommonTasksPage run(String name) {
        runButton(name).click();
        assertThat(app.dialog()).isVisible();
        return this;
    }

    public Locator param(String key) {
        return app.dialog().getByLabel(key + ":", new Locator.GetByLabelOptions().setExact(true));
    }

    public Locator commandPreview() {
        return app.dialog().getByText(Pattern.compile("^Command: "));
    }
}
