package com.linagora.admin.e2e.pages.mail.users;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.util.List;
import java.util.regex.Pattern;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.AriaRole;

/** The Users page of the Mail flavour: prefix search, domain filter, keyset paging. */
public class UsersListPage {
    public static final String SEARCH_PLACEHOLDER = "Search users by name prefix...";

    private final AdminApp app;

    public UsersListPage(AdminApp app) {
        this.app = app;
    }

    public static UsersListPage open(AdminApp app) {
        app.open("/users");
        UsersListPage page = new UsersListPage(app);
        assertThat(page.search()).isVisible();
        return page;
    }

    public AdminApp app() {
        return app;
    }

    public Locator search() {
        return app.main().getByPlaceholder(SEARCH_PLACEHOLDER);
    }

    public Locator domainSelect() {
        return app.main().getByRole(AriaRole.COMBOBOX, new Locator.GetByRoleOptions().setName("Domain").setExact(true));
    }

    public UsersListPage selectDomain(String domain) {
        domainSelect().selectOption(domain);
        return this;
    }

    public UsersListPage selectAllDomains() {
        domainSelect().selectOption("");
        return this;
    }

    /** One row per user: {@code "12/alice@example.com"}. */
    public Locator rows() {
        return app.main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setLevel(4));
    }

    /** The links of the listed users, whose text is the username. */
    public Locator userLinks() {
        return rows().getByRole(AriaRole.LINK);
    }

    public Locator userLink(String username) {
        return rows().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName(username).setExact(true));
    }

    /** The row numbered {@code index} (1 based, across pages). */
    public Locator row(int index) {
        return rows().filter(new Locator.FilterOptions().setHasText(Pattern.compile("^" + index + "\\/")));
    }

    public List<String> listedUsernames() {
        return userLinks().allInnerTexts();
    }

    public Locator pageLabel() {
        return app.main().getByText(Pattern.compile("^Page \\d+$"));
    }

    public Locator first() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("First").setExact(true));
    }

    public Locator previous() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Previous").setExact(true));
    }

    public Locator next() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Next").setExact(true));
    }

    /** The message shown in place of an empty list. */
    public Locator message(String text) {
        return app.main().getByText(text, new Locator.GetByTextOptions().setExact(true));
    }
}
