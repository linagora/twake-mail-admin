package com.linagora.admin.e2e.pages.mail.users;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.util.regex.Pattern;

import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.AriaRole;

/**
 * The detail page of a Mail user ({@code /users/user/<username>}): a stack of collapsible
 * sections, each one opened by a toggle button named after its title, plus its count
 * ({@code "Aliases (2)"}) once loaded.
 */
public class UserDetailPage {
    public static final String TITLE = "User Details";

    private final AdminApp app;
    private final String username;

    public UserDetailPage(AdminApp app, String username) {
        this.app = app;
        this.username = username;
    }

    public static UserDetailPage open(AdminApp app, String username) {
        app.open("/users/user/" + WebAdmin.encode(username));
        UserDetailPage page = new UserDetailPage(app, username);
        assertThat(page.card().getByText("Username: " + username, new Locator.GetByTextOptions().setExact(true))).isVisible();
        return page;
    }

    /** Escapes regex metacharacters; unlike Pattern.quote, the result is also a valid JavaScript regex (Playwright evaluates them in the browser). */
    public static String escape(String text) {
        return text.replaceAll("[.*+?^${}()|\\[\\]\\\\/-]", "\\\\$0");
    }

    public AdminApp app() {
        return app;
    }

    public String username() {
        return username;
    }

    public Locator title() {
        return app.main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setName(TITLE).setExact(true).setLevel(3));
    }

    /** The card holding the sections. */
    public Locator card() {
        return app.main().locator("div").filter(new Locator.FilterOptions().setHas(app.page().getByRole(AriaRole.HEADING,
            new com.microsoft.playwright.Page.GetByRoleOptions().setName(TITLE).setExact(true).setLevel(3)))).last();
    }

    /** The toggle of a section, {@code "Aliases"} matches "Aliases" and "Aliases (2)". */
    public Locator toggle(String title) {
        return card().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions()
            .setName(Pattern.compile("^" + escape(title) + "( \\(\\d+\\))?$")));
    }

    /** The toggle of a section once its count is loaded: {@code "Aliases (2)"}. */
    public Locator toggle(String title, int count) {
        return card().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions()
            .setName(title + " (" + count + ")").setExact(true));
    }

    /** The whole section (toggle and content). */
    public Locator section(String title) {
        return card().locator(":scope > div").filter(new Locator.FilterOptions().setHas(app.page().getByRole(AriaRole.BUTTON,
            new com.microsoft.playwright.Page.GetByRoleOptions().setName(Pattern.compile("^" + escape(title) + "( \\(\\d+\\))?$")))));
    }

    /** Opens a collapsed section (all sections start collapsed) and returns it. */
    public Locator expand(String title) {
        toggle(title).click();
        return section(title);
    }

    /** A button of a section by its accessible name (its text, or the title of an icon button). */
    public Locator button(Locator scope, String name) {
        return scope.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(name).setExact(true));
    }

    /** The {@code "<n>/<text>"} heading of a list item of a section. */
    public Locator item(Locator section, String text) {
        return itemHeading(section, text);
    }

    private static Locator itemHeading(Locator scope, String text) {
        return scope.getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions()
            .setLevel(4).setName(Pattern.compile("^\\d+\\/" + escape(text) + "( ?\\(self\\))?$")));
    }

    public Locator items(Locator section) {
        return section.getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions()
            .setLevel(4).setName(Pattern.compile("^\\d+\\/")));
    }

    /** The innermost box holding the heading of a list item and one of its action buttons. */
    public Locator itemRow(Locator section, String text, String buttonName) {
        return section.locator("div")
            .filter(new Locator.FilterOptions().setHas(app.page().getByRole(AriaRole.HEADING, new com.microsoft.playwright.Page.GetByRoleOptions()
                .setLevel(4).setName(Pattern.compile("^\\d+\\/" + escape(text) + "( ?\\(self\\))?$")))))
            .filter(new Locator.FilterOptions().setHas(app.page().getByRole(AriaRole.BUTTON, new com.microsoft.playwright.Page.GetByRoleOptions()
                .setName(buttonName).setExact(true))))
            .last();
    }

    /** Clicks an action button (by its accessible name) of a list item. */
    public void clickItemButton(Locator section, String text, String buttonName) {
        button(itemRow(section, text, buttonName), buttonName).click();
    }
}
