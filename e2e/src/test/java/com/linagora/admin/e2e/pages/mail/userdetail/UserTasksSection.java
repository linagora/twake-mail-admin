package com.linagora.admin.e2e.pages.mail.userdetail;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.util.List;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.AriaRole;

/** The "Tasks" section of a user detail page: one row per task, each with a "Run" button. */
public class UserTasksSection {
    public static final List<String> ROWS = List.of(
        "Reindex all mailboxes", "Subscribe to all mailboxes", "Recompute JMAP fast view projection",
        "Restore deleted messages", "Cleanup user Trash folder", "Cleanup user Spam folder",
        "Provision templates", "Tier user data", "Rename user", "Delete all mailboxes", "Delete user data");

    private final MailUserDetailPage detail;

    UserTasksSection(MailUserDetailPage detail) {
        this.detail = detail;
    }

    public UserTasksSection open() {
        detail.sectionToggle("Tasks").click();
        assertThat(row(ROWS.get(0))).isVisible();
        return this;
    }

    /** The row of a task, by its label: the label, its risk, its description and its "Run" button. */
    public Locator row(String label) {
        return detail.main().locator("div")
            .filter(new Locator.FilterOptions().setHas(detail.page().getByText(label, new com.microsoft.playwright.Page.GetByTextOptions().setExact(true))))
            .filter(new Locator.FilterOptions().setHas(detail.page().getByRole(AriaRole.BUTTON,
                new com.microsoft.playwright.Page.GetByRoleOptions().setName(AdminApp.RUN_TASK_BUTTON))))
            .last();
    }

    public Locator labels() {
        return detail.main().getByText(java.util.regex.Pattern.compile(
            "^(" + String.join("|", ROWS) + ")$"));
    }

    public Locator runButton(String label) {
        return row(label).getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(AdminApp.RUN_TASK_BUTTON));
    }

    /** Clicks "Run" on a row and waits for its dialog. */
    public Locator run(String label) {
        runButton(label).click();
        assertThat(detail.app().dialog()).isVisible();
        return detail.app().dialog();
    }

    /** Hovers "Run" and returns its tooltip showing {@code text} (the previous tooltip may still be fading out). */
    public Locator tooltip(String label, String text) {
        runButton(label).hover();
        return detail.page().getByRole(AriaRole.TOOLTIP).filter(new Locator.FilterOptions().setHasText(text)).first();
    }
}
