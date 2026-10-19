package com.linagora.admin.e2e.pages.calendar.users;

import java.util.regex.Pattern;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

/** The Users list of the calendar console ({@code /users}): prefix search, domain selector, paging by 50. */
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

    /** One row per user: {@code "12/alice@example.com"}, numbered across pages. */
    public Locator rows() {
        return app.main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setLevel(4));
    }

    /** The row numbered {@code index} (1 based, across pages). */
    public Locator row(int index) {
        return rows().filter(new Locator.FilterOptions().setHasText(Pattern.compile("^" + index + "\\/")));
    }

    public Locator pageLabel() {
        return app.main().getByText(Pattern.compile("^Page \\d+$"));
    }

    public Locator first() {
        return button("First");
    }

    public Locator previous() {
        return button("Previous");
    }

    public Locator next() {
        return button("Next");
    }

    private Locator button(String name) {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(name).setExact(true));
    }

    public Locator noMatch(String prefix) {
        return app.main().getByText("No username starts with \"" + prefix + "\".");
    }

    public Page page() {
        return app.page();
    }
}
