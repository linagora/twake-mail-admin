package com.linagora.admin.e2e.pages.mail.userdetail;

import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.AriaRole;

/** The message search page of a user ({@code /users/user/<username>/message-search}). */
public class MessageSearchPage {
    private final AdminApp app;

    public MessageSearchPage(AdminApp app) {
        this.app = app;
    }

    public static String path(String username) {
        return MailUserDetailPage.path(username) + "/message-search";
    }

    public Locator title() {
        return app.main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setName("Message Search").setExact(true));
    }

    public Locator reason() {
        return app.main().getByLabel("Reason");
    }

    public Locator searchButton() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Search").setExact(true));
    }

    public Locator filtersToggle() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Filters").setExact(true));
    }

    public Locator filter(String label) {
        return app.main().getByLabel(label, new Locator.GetByLabelOptions().setExact(true));
    }

    public Locator addSort() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("+ Add").setExact(true));
    }

    public Locator sortFields() {
        return app.main().getByRole(AriaRole.COMBOBOX, new Locator.GetByRoleOptions().setName("Sort field").setExact(true));
    }

    public Locator sortDirections() {
        return app.main().getByRole(AriaRole.COMBOBOX, new Locator.GetByRoleOptions().setName("Sort direction").setExact(true));
    }

    public Locator backLink(String username) {
        return app.main().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName("← " + username).setExact(true));
    }

    /** The path the search is POSTed to, as the app encodes it. */
    public static String searchPath(String username) {
        return "/users/" + WebAdmin.encode(username) + "/mails";
    }
}
