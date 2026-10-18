package com.linagora.admin.e2e.pages.calendar.resources;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

/**
 * "Calendar Resources" of the calendar domain page. The domain is shared by every test: rows are
 * found by name, after a search narrowed the list (it is paginated).
 */
public class ResourcesSection {
    public static final String TITLE = "Calendar Resources";

    private final AdminApp app;
    private final Page page;

    ResourcesSection(AdminApp app) {
        this.app = app;
        this.page = app.page();
    }

    void expand() {
        toggle().click();
        assertThat(searchBox()).isVisible();
    }

    public Locator toggle() {
        return CalendarDomainPage.sectionToggle(page, TITLE);
    }

    public Locator root() {
        return CalendarDomainPage.sectionOf(toggle());
    }

    public Locator button(String name) {
        return root().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(name).setExact(true));
    }

    public Locator textbox(String name) {
        return root().getByRole(AriaRole.TEXTBOX, new Locator.GetByRoleOptions().setName(name).setExact(true));
    }

    // --- creation form

    public ResourcesSection openCreateForm() {
        button("Add calendar resource").click();
        assertThat(root().getByText("New Calendar Resource", new Locator.GetByTextOptions().setExact(true))).isVisible();
        return this;
    }

    public Locator nameBox() {
        return textbox("Resource name");
    }

    public Locator descriptionBox() {
        return textbox("Description");
    }

    public Locator creatorBox() {
        return textbox("Creator *");
    }

    public Locator administratorsBox() {
        return textbox("Administrators");
    }

    public Locator addAdministratorButton() {
        return button("Add");
    }

    public Locator createButton() {
        return button("Create");
    }

    public ResourceIconPicker iconPicker() {
        return new ResourceIconPicker(root());
    }

    /** A staged administrator of the creation form. */
    public Locator stagedAdministrator(String email) {
        return root().locator("div").filter(new Locator.FilterOptions().setHasText(email))
            .filter(new Locator.FilterOptions().setHas(page.getByRole(AriaRole.BUTTON,
                new Page.GetByRoleOptions().setName("Remove administrator").setExact(true))))
            .last();
    }

    // --- list

    public Locator searchBox() {
        return root().getByPlaceholder("Search resources...");
    }

    public ResourcesSection search(String text) {
        searchBox().fill(text);
        return this;
    }

    /** The link of a listed resource, named after the resource (or its ID when it has no name). */
    public Locator link(String displayName) {
        return root().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName(displayName).setExact(true));
    }

    /** The row of a resource, by its display name; search for it first. */
    public DomainCalendarRow row(String displayName) {
        Locator row = root().locator("div")
            .filter(new Locator.FilterOptions().setHas(page.getByRole(AriaRole.LINK,
                new Page.GetByRoleOptions().setName(displayName).setExact(true))))
            .filter(new Locator.FilterOptions().setHas(page.getByRole(AriaRole.BUTTON,
                new Page.GetByRoleOptions().setName("Delete resource").setExact(true))))
            .last();
        return new DomainCalendarRow(page, row, displayName);
    }

    public Locator noSearchResults() {
        return root().getByText("No results match your search.");
    }

    /** Clicks the trash icon of a resource: opens the confirmation. */
    public ResourcesSection clickDelete(String displayName) {
        row(displayName).button("Delete resource").click();
        assertThat(app.dialog()).isVisible();
        return this;
    }
}
