package com.linagora.admin.e2e.pages.calendar.ops;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.util.regex.Pattern;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

/** Registered Users: the users of the DAV server. */
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

    public Locator newUser() {
        return app.page().getByPlaceholder("user@domain.tld");
    }

    public Locator addButton() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Add").setExact(true));
    }

    /** Types an address to register and waits for the existence check to settle. */
    public RegisteredUsersPage typeNewUser(String address) {
        newUser().fill(address);
        assertThat(app.main().getByText("Checking...")).isHidden();
        return this;
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

    public Locator pagination() {
        return app.main().getByText(Pattern.compile("^Page \\d+ / \\d+ — Total: \\d+$"));
    }

    /** A field of the open Register / Edit dialog: "Email", "Firstname", "Lastname". */
    public Locator field(String label) {
        return app.dialog().getByLabel(label + " *", new Locator.GetByLabelOptions().setExact(true));
    }

    public Page page() {
        return app.page();
    }
}
