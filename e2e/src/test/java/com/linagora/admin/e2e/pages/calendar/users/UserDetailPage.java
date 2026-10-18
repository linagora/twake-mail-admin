package com.linagora.admin.e2e.pages.calendar.users;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.util.regex.Pattern;

import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

/** The detail page of a user of the calendar console ({@code /users/user/<username>}). */
public class UserDetailPage {
    private final AdminApp app;

    public UserDetailPage(AdminApp app) {
        this.app = app;
    }

    public static String path(String username) {
        return "/users/user/" + WebAdmin.encode(username);
    }

    public UserDetailPage open(String username) {
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

    public Locator title() {
        return app.main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setName("User Details").setExact(true));
    }

    public Locator usernameLabel() {
        return app.main().getByText(Pattern.compile("^Username: "));
    }

    public Locator backButton() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Back").setExact(true));
    }

    /** The collapsible title of a section, "Calendars (1)": its name starts with {@code title}. */
    public Locator sectionToggle(String title) {
        // Page level, not under main: it also serves as a "has" filter, relative to its block
        return app.page().getByRole(AriaRole.BUTTON,
            new Page.GetByRoleOptions().setName(Pattern.compile("^" + JsRegex.quote(title) + "( ?\\(\\d+\\))?$")));
    }

    public CollectionSection calendars() {
        return new CollectionSection(app, sectionToggle("Calendars"), "Create calendar");
    }

    public CollectionSection addressBooks() {
        return new CollectionSection(app, sectionToggle("Address Books"), "Create address book");
    }

    // Unregistered user

    public Locator notRegisteredPanel() {
        return app.main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setName("This user is not registered"));
    }

    public Locator registerButton() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Register this user"));
    }
}
