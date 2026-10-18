package com.linagora.admin.e2e.pages.mail.ops;

import java.util.regex.Pattern;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.AriaRole;

/** The detail ("Mail Repository — path") and extended views of a mail repository. */
public class MailRepositoryDetailPage {
    public static final String DOWNLOAD = "Download email";
    public static final String REPROCESS = "Reprocess email";
    public static final String MOVE = "Move email to another repository";
    public static final String DELETE = "Delete email";

    private final AdminApp app;

    public MailRepositoryDetailPage(AdminApp app) {
        this.app = app;
    }

    public AdminApp app() {
        return app;
    }

    public Locator title(String path) {
        return app.main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions()
            .setName("Mail Repository — " + path).setExact(true));
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

    // ---- mails ----

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
        return mailButton(key).locator("xpath=ancestor::div[.//button[@title='" + DELETE + "']][1]");
    }

    public Locator rowAction(String key, String action) {
        return extendedRow(key).getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(action).setExact(true));
    }

    public Locator sortField() {
        return app.main().getByLabel("Sort by");
    }

    public Locator sortDirection() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(Pattern.compile("^(Ascending|Descending)$")));
    }
}
