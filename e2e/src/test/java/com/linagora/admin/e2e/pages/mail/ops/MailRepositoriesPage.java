package com.linagora.admin.e2e.pages.mail.ops;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.util.regex.Pattern;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.AriaRole;

/** Mail Repositories: the list of repositories, their bulk actions and the creation dialog. */
public class MailRepositoriesPage {
    /** Names of the bulk actions of a repository, {@code %s} being its path. */
    public static final String REPROCESS_ALL = "Reprocess all mails of \"%s\"";
    public static final String MOVE_ALL = "Move all mails of \"%s\" to another repository";
    public static final String CLEAR_ALL = "Clear all mails of \"%s\"";

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

    /** The link of a repository, named by its path; its mail count is a pill next to it. */
    public Locator link(String path) {
        return app.main().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName(path).setExact(true));
    }

    /** The link of a repository holding {@code count} mails: its heading reads "path Mails: count". */
    public Locator link(String path, long count) {
        return app.main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions()
                .setName(path + " Mails: " + count).setExact(true))
            .getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName(path).setExact(true));
    }

    /** The mail count pill of a repository ("Mails: 3"). */
    public Locator count(String path) {
        return row(path).getByLabel(Pattern.compile("^Mails: \\d+$"));
    }

    /** The headings of the listed repositories, in display order. */
    public Locator headings() {
        return app.main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setLevel(4));
    }

    /** The search field of the toolbar, filtering the repositories by path. */
    public Locator filter() {
        return app.main().getByPlaceholder("Filter repositories…");
    }

    /** The card of a repository: its link, its encoded id and its actions. */
    public Locator row(String path) {
        return link(path).locator("xpath=ancestor::div[.//button][1]");
    }

    /** A bulk action of a repository ({@link #REPROCESS_ALL}...), named after its path. */
    public Locator action(String path, String action) {
        return row(path).getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(String.format(action, path)).setExact(true));
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

    /** A field of a task confirmation dialog, by its raw key ({@code "queue"}, {@code "limit"}...). */
    public Locator param(String key) {
        return Dialogs.param(app, key);
    }

    /** The {@code Command: curl ...} preview of the open dialog. */
    public Locator commandPreview() {
        return Dialogs.commandPreview(app);
    }
}
