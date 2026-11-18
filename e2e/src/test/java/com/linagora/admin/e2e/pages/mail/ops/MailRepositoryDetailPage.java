package com.linagora.admin.e2e.pages.mail.ops;

import java.util.regex.Pattern;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

/** The detail (headed by the repository path) and extended views of a mail repository. */
public class MailRepositoryDetailPage {
    /** The per mail actions, their accessible names carrying the mail key: {@code Delete email "<key>"}. */
    public static final String DOWNLOAD = "Download email \"%s\"";
    public static final String REPROCESS = "Reprocess email \"%s\"";
    public static final String MOVE = "Move email \"%s\" to another repository";
    public static final String DELETE = "Delete email \"%s\"";
    /** The hover tooltip of the per mail Delete buttons, the same on every row. */
    private static final String DELETE_TOOLTIP = "Delete email";

    private final AdminApp app;

    public MailRepositoryDetailPage(AdminApp app) {
        this.app = app;
    }

    public AdminApp app() {
        return app;
    }

    /** The h1 of the detail page: the repository path, under a breadcrumb back to the list. */
    public Locator title(String path) {
        return app.main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions()
            .setName(path).setExact(true).setLevel(1));
    }

    /** The breadcrumb link back to a parent page ("Mail Repositories", or the repository from the extended view). */
    public Locator breadcrumb(String label) {
        return app.main().getByRole(AriaRole.NAVIGATION, new Locator.GetByRoleOptions().setName("Breadcrumb"))
            .getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName(label).setExact(true));
    }

    public Locator extendedTitle() {
        return app.main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setName("Extended View").setExact(true));
    }

    public Locator extendedViewLink() {
        return app.main().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName("Extended view").setExact(true));
    }

    // ---- filters ----

    public Locator filtersToggle() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(Pattern.compile("^Filters")));
    }

    public Locator senderFilter() {
        return app.main().getByPlaceholder("alice@domain.org");
    }

    public Locator recipientFilter() {
        return app.main().getByPlaceholder("bob@domain.org");
    }

    public Locator updatedBeforeFilter() {
        return app.main().getByPlaceholder("1d, 2h, 30m");
    }

    public Locator updatedAfterFilter() {
        return app.main().getByPlaceholder("7d, 2h, 30m");
    }

    public Locator applyFilters() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Apply").setExact(true));
    }

    public Locator resetFilters() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Reset").setExact(true));
    }

    // ---- pagination ----

    /**
     * The page label: {@code "Page 2 / 3 — Total: 450"}; {@code "Total: 4"} alone when every mail
     * fits on one page, the pagination buttons then being hidden.
     */
    public Locator pageLabel(String label) {
        return app.main().getByText(label, new Locator.GetByTextOptions().setExact(true));
    }

    /** A pagination button: First, Previous, Next, Last. */
    public Locator pager(String name) {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(name).setExact(true));
    }

    // ---- mails ----

    /** The mail rows of the simple view: {@code "<n> / <key> View JSON (MIME)"} and the mail actions. */
    public Locator rows() {
        return app.main().getByRole(AriaRole.LIST).getByRole(AriaRole.LISTITEM);
    }

    /** A row of the simple view, by its mail key. */
    public Locator row(String key) {
        return rows().filter(new Locator.FilterOptions().setHas(
            app.page().getByText(key, new Page.GetByTextOptions().setExact(true))));
    }

    /** "View JSON" of a row of the simple view: opens the JSON of the mail in a dialog. */
    public Locator viewJson(String key) {
        return row(key).getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("View JSON").setExact(true));
    }

    public Locator mime(String key) {
        return row(key).getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName("(MIME)").setExact(true));
    }

    /** A mail action of a row of the simple view, {@code action} being one of the named action formats. */
    public Locator simpleRowAction(String key, String action) {
        return row(key).getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(action.formatted(key)).setExact(true));
    }

    /** The per mail Delete buttons of the extended view: one per displayed mail. */
    public Locator extendedDeleteButtons() {
        return app.main().locator("button[title='" + DELETE_TOOLTIP + "']");
    }

    /** A mail key of the simple view. */
    public Locator mailKey(String key) {
        return app.main().getByText(key, new Locator.GetByTextOptions().setExact(true));
    }

    /** The mail name buttons of the extended view, in display order. */
    public Locator mailButtons() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(Pattern.compile("^Mail\\d")));
    }

    public Locator mailButton(String key) {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(key).setExact(true));
    }

    /** A row of the extended view: the mail button, sender, recipients, date, size and actions. */
    public Locator extendedRow(String key) {
        return mailButton(key).locator("xpath=ancestor::div[.//button[@title='" + DELETE_TOOLTIP + "']][1]");
    }

    /** A mail action of a row of the extended view, {@code action} being one of the named action formats. */
    public Locator rowAction(String key, String action) {
        return extendedRow(key).getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(action.formatted(key)).setExact(true));
    }

    public Locator sortField() {
        return app.main().getByLabel("Sort by");
    }

    public Locator sortDirection() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(Pattern.compile("^(Ascending|Descending)$")));
    }
}
