package com.linagora.admin.e2e.pages.mail.userdetail;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

/**
 * The detail page of a user of the mail console ({@code /users/user/<username>}): a stack of
 * collapsible sections, each opened by clicking its title.
 */
public class MailUserDetailPage {
    private static final Pattern TASK_LINK = Pattern.compile("Task ([0-9a-f-]{36})");

    private final AdminApp app;

    public MailUserDetailPage(AdminApp app) {
        this.app = app;
    }

    public static String path(String username) {
        return "/users/user/" + WebAdmin.encode(username);
    }

    public MailUserDetailPage open(String username) {
        app.open(path(username));
        assertThat(usernameLabel()).hasText("Username: " + username);
        return this;
    }

    public AdminApp app() {
        return app;
    }

    public Page page() {
        return app.page();
    }

    public Locator main() {
        return app.main();
    }

    public Locator usernameLabel() {
        return app.main().getByText(Pattern.compile("^Username: "));
    }

    /** The title of a section, "Aliases (2)": its accessible name starts with {@code title}. */
    public Locator sectionToggle(String title) {
        return app.main().getByRole(AriaRole.BUTTON,
            new Locator.GetByRoleOptions().setName(Pattern.compile("^" + Regex.escape(title) + "( ?\\(\\d+\\))?$")));
    }

    /** The section title once its count is loaded, e.g. "Aliases (2)". */
    public Locator sectionToggle(String title, int count) {
        return app.main().getByRole(AriaRole.BUTTON,
            new Locator.GetByRoleOptions().setName(Pattern.compile("^" + Regex.escape(title) + " ?\\(" + count + "\\)$")));
    }

    public MailUserDetailPage toggle(String title) {
        sectionToggle(title).click();
        return this;
    }

    /** An icon button of the page, named by its tooltip ("Add alias", "Search messages"...). */
    public Locator iconButton(String name) {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(name).setExact(true));
    }

    public Locator button(String name) {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(name).setExact(true));
    }

    public Locator searchMessagesLink() {
        return app.main().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName("Search messages").setExact(true));
    }

    public UserTasksSection tasks() {
        return new UserTasksSection(this);
    }

    public DeletedVaultSection deletedVault() {
        return new DeletedVaultSection(this);
    }

    /** Reads the id of the task out of the "Task created" toast, which vanishes after a few seconds. */
    public String taskIdFromToast(String title) {
        Locator link = app.toast(title).getByRole(AriaRole.LINK);
        assertThat(link).isVisible();
        String text = link.textContent().trim();
        Matcher matcher = TASK_LINK.matcher(text);
        if (!matcher.find()) {
            throw new IllegalStateException("No task id in " + text);
        }
        return matcher.group(1);
    }

    /** The "Command: curl ..." preview of the open task dialog. */
    public Locator commandPreview() {
        return app.dialog().getByText(Pattern.compile("^Command: "));
    }
}
