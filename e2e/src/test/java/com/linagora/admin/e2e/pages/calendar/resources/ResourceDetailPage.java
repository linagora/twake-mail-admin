package com.linagora.admin.e2e.pages.calendar.resources;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

/** {@code /domains/domain/<domain>/resource/<id>}: a calendar resource and its administrators. */
public class ResourceDetailPage {
    private final AdminApp app;
    private final Page page;

    public ResourceDetailPage(AdminApp app) {
        this.app = app;
        this.page = app.page();
    }

    public static ResourceDetailPage open(AdminApp app, String domain, String resourceId) {
        app.open("/domains/domain/" + WebAdmin.encode(domain) + "/resource/" + WebAdmin.encode(resourceId));
        return new ResourceDetailPage(app);
    }

    public Locator heading(String displayName) {
        return app.main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions()
            .setName("Calendar Resource — " + displayName).setExact(true));
    }

    /** A "<Label>: <value>" line of the read-only view (the Icon line has no space: its parts are flex items). */
    public Locator field(String label, String value) {
        return app.main().getByText(java.util.regex.Pattern.compile("^" + regex(label) + ":\\s*" + regex(value) + "$"));
    }

    /** Escapes a literal for a pattern Playwright hands to JavaScript (no Pattern.quote there). */
    static String regex(String literal) {
        return literal.replaceAll("[\\\\^$.|?*+()\\[\\]{}/-]", "\\\\$0");
    }

    public Locator button(String name) {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(name).setExact(true));
    }

    public Locator textbox(String name) {
        return app.main().getByRole(AriaRole.TEXTBOX, new Locator.GetByRoleOptions().setName(name).setExact(true));
    }

    public ResourceDetailPage edit() {
        button("Edit").click();
        assertThat(nameBox()).isVisible();
        return this;
    }

    public Locator nameBox() {
        return textbox("Name");
    }

    public Locator descriptionBox() {
        return textbox("Description");
    }

    public ResourceIconPicker iconPicker() {
        return new ResourceIconPicker(app.main());
    }

    public Locator saveButton() {
        return button("Save");
    }

    public Locator cancelButton() {
        return button("Cancel");
    }

    // --- administrators

    public Locator administratorBox() {
        return textbox("Administrators");
    }

    public Locator addAdministratorButton() {
        return button("Add");
    }

    /** Types an administrator and clicks Add once the address is known to exist. */
    public ResourceDetailPage addAdministrator(String email) {
        administratorBox().fill(email);
        addAdministratorButton().click();
        return this;
    }

    public Locator administrator(String email) {
        return app.main().locator("div")
            .filter(new Locator.FilterOptions().setHasText(email))
            .filter(new Locator.FilterOptions().setHas(page.getByRole(AriaRole.BUTTON,
                new Page.GetByRoleOptions().setName("Remove administrator").setExact(true))))
            .last();
    }

    /** The list entries ("1/email") of an administrator: one at most, unless the list holds duplicates. */
    public Locator administratorEntries(String email) {
        return app.main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions()
            .setLevel(4).setName(java.util.regex.Pattern.compile("^\\d+\\/" + regex(email) + "$")));
    }
}
