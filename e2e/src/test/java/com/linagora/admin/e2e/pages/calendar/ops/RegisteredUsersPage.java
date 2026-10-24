package com.linagora.admin.e2e.pages.calendar.ops;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.util.regex.Pattern;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

/**
 * Registered Users: the users of the DAV server. One toolbar line, the search then "Register a
 * user", which opens the "Register user" modal.
 */
public class RegisteredUsersPage {
    private final AdminApp app;

    private RegisteredUsersPage(AdminApp app) {
        this.app = app;
    }

    /** Opens the page from the sidebar. */
    public static RegisteredUsersPage open(AdminApp app) {
        app.open("/");
        app.navigate("Registered Users");
        RegisteredUsersPage page = new RegisteredUsersPage(app);
        assertThat(page.search()).isVisible();
        return page;
    }

    /** "Register a user", next to the search. */
    public Locator registerButton() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Register a user").setExact(true));
    }

    /** The "Register user" modal. */
    public Locator registerDialog() {
        return app.page().getByRole(AriaRole.DIALOG, new Page.GetByRoleOptions().setName("Register user").setExact(true));
    }

    /** The address field of the "Register user" modal. */
    public Locator newUser() {
        return registerDialog().getByLabel("Email", new Locator.GetByLabelOptions().setExact(true));
    }

    /** The submit button of the "Register user" modal. */
    public Locator submitButton() {
        return registerDialog().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Register").setExact(true));
    }

    /** Types an address to register and waits for the existence check to settle. */
    public RegisteredUsersPage typeNewUser(String address) {
        newUser().fill(address);
        assertThat(registerDialog().getByText("Checking...")).isHidden();
        return this;
    }

    /** The status of the typed address, under the field of the "Register user" modal. */
    public Locator accountLine(String text) {
        return registerDialog().getByText(text, new Locator.GetByTextOptions().setExact(true));
    }

    public Locator search() {
        return app.page().getByPlaceholder("Search registered users...");
    }

    public RegisteredUsersPage searchFor(String text) {
        search().fill(text);
        return this;
    }

    /** The e-mail heading of every listed row ("1/alice@..."). */
    public Locator rowHeadings() {
        return app.main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setLevel(4));
    }

    public Locator row(String email) {
        return app.main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setLevel(4)
                .setName(Pattern.compile("^\\d+.\\s*" + Regex.quote(email) + "$")))
            .locator("xpath=ancestor::div[.//button][1]");
    }

    public Locator rowAction(String email, String title) {
        return row(email).getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(title).setExact(true));
    }

    /** "Page 1 / 3 — Total: 120" with its buttons, or only "Total: 2" when everything fits on one page. */
    public Locator pagination() {
        return app.main().getByText(Pattern.compile("^(Page \\d+ / \\d+ — )?Total: \\d+$"));
    }

    /** A field of the open Register / Edit dialog: "Email", "First name", "Last name". */
    public Locator field(String label) {
        return app.dialog().getByLabel(label + " *", new Locator.GetByLabelOptions().setExact(true));
    }

    public Page page() {
        return app.page();
    }
}
