package com.linagora.admin.e2e.pages.calendar.users;

import java.util.regex.Pattern;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

/** The Users list of the calendar console ({@code /users}): prefix search and domain selector. */
public class UsersListPage {
    private final AdminApp app;

    public UsersListPage(AdminApp app) {
        this.app = app;
    }

    public UsersListPage open() {
        app.open("/");
        app.navigate("Users");
        return this;
    }

    public Locator search() {
        return app.main().getByPlaceholder("Search users by name prefix...");
    }

    public UsersListPage searchFor(String prefix) {
        search().fill(prefix);
        return this;
    }

    public Locator domainSelector() {
        return app.main().getByRole(AriaRole.COMBOBOX, new Locator.GetByRoleOptions().setName("Domain").setExact(true));
    }

    /** The links of the listed users. */
    public Locator userLinks() {
        // Not the documentation link of the header: a username holds an "@"
        return app.main().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName(Pattern.compile("@")));
    }

    public Locator userLink(String username) {
        return app.main().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName(username).setExact(true));
    }

    public Locator noMatch(String prefix) {
        return app.main().getByText("No username starts with \"" + prefix + "\".");
    }

    public Page page() {
        return app.page();
    }
}
