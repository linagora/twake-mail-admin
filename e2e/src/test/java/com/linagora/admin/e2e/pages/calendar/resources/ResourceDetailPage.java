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

    /** The page is headed by the resource (h1), subtitled "Resource calendar". */
    public Locator heading(String displayName) {
        return app.main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions()
            .setLevel(1).setName(displayName).setExact(true));
    }

    public Locator subtitle() {
        return app.main().getByText("Resource calendar", new Locator.GetByTextOptions().setExact(true));
    }

    /** The breadcrumb link back to the resources of the domain. */
    public Locator breadcrumb() {
        return app.main().getByRole(AriaRole.NAVIGATION, new Locator.GetByRoleOptions().setName("Breadcrumb"))
            .getByRole(AriaRole.LINK);
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
        return textbox("Name *");
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

    // --- administrators: the "+" next to the Administrators title opens a modal

    public Locator addAdministratorButton() {
        return button("Add administrator");
    }

    /** The "Add administrator" modal. */
    public Locator addAdministratorDialog() {
        return page.getByRole(AriaRole.DIALOG, new Page.GetByRoleOptions().setName("Add administrator").setExact(true));
    }

    /** Its only field, a combobox suggesting the users of the server, named after the modal. */
    public Locator administratorBox() {
        return addAdministratorDialog().getByRole(AriaRole.COMBOBOX, new Locator.GetByRoleOptions().setName("Add administrator").setExact(true));
    }

    public Locator addButton() {
        return addAdministratorDialog().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Add").setExact(true));
    }

    /** The status of the typed address under the field ("User exists", "Administrator already in the list"...). */
    public Locator administratorHint(String text) {
        return addAdministratorDialog().getByText(text, new Locator.GetByTextOptions().setExact(true));
    }

    /** Opens the modal and types an address. */
    public ResourceDetailPage typeAdministrator(String email) {
        addAdministratorButton().click();
        assertThat(addAdministratorDialog()).isVisible();
        administratorBox().fill(email);
        return this;
    }

    /** Opens the modal, types an address and adds it once it is known to exist: the modal closes. */
    public ResourceDetailPage addAdministrator(String email) {
        typeAdministrator(email);
        assertThat(administratorHint("User exists")).isVisible();
        addButton().click();
        assertThat(addAdministratorDialog()).isHidden();
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
