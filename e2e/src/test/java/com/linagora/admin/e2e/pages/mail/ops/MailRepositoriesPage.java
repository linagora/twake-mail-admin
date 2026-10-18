package com.linagora.admin.e2e.pages.mail.ops;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.util.regex.Pattern;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.AriaRole;

/** Mail Repositories: the list of repositories, their bulk actions and the creation dialog. */
public class MailRepositoriesPage {
    public static final String REPROCESS_ALL = "Reprocess all mails";
    public static final String MOVE_ALL = "Move all mails to another repository";
    public static final String CLEAR_ALL = "Clear all mails";

    private final AdminApp app;

    public MailRepositoriesPage(AdminApp app) {
        this.app = app;
    }

    public static MailRepositoriesPage open(AdminApp app) {
        app.open("/mail-repositories");
        MailRepositoriesPage page = new MailRepositoriesPage(app);
        assertThat(page.newRepositoryButton()).isVisible();
        return page;
    }

    public AdminApp app() {
        return app;
    }

    /** The link of a repository, {@code "var/mail/error (3)"}. */
    public Locator link(String path) {
        return app.main().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions()
            .setName(Pattern.compile("^" + Regex.quote(path) + " \\(\\d+\\)$")));
    }

    public Locator link(String path, long count) {
        return app.main().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions()
            .setName(path + " (" + count + ")").setExact(true));
    }

    /** The card of a repository: its link, its encoded id and its actions. */
    public Locator row(String path) {
        return link(path).locator("xpath=ancestor::div[.//button][1]");
    }

    public Locator action(String path, String action) {
        return row(path).getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(action).setExact(true));
    }

    public Locator newRepositoryButton() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("New repository"));
    }

    // ---- creation dialog ----

    public Locator pathField() {
        return app.dialog().getByLabel("Repository path");
    }

    public Locator protocolField() {
        return app.dialog().getByLabel("Protocol");
    }

    /** A labelled field of a task confirmation dialog ({@code "queue"}, {@code "limit"}...). */
    public Locator param(String key) {
        return app.dialog().getByLabel(key + ":", new Locator.GetByLabelOptions().setExact(true));
    }

    /** The {@code Command: curl ...} preview of the open dialog. */
    public Locator commandPreview() {
        return app.dialog().getByText(Pattern.compile("^Command: "));
    }
}
