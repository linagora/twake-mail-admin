package com.linagora.admin.e2e.pages.calendar.resources;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

/**
 * "Team Calendars" of the calendar domain page. Shared by every test: rows are found by their
 * (unique) name, after a search narrowed the paginated list.
 */
public class TeamCalendarsSection {
    public static final String TITLE = "Team Calendars";

    private final AdminApp app;
    private final Page page;

    TeamCalendarsSection(AdminApp app) {
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

    // --- creation form

    public TeamCalendarsSection openCreateForm() {
        button("Add team calendar").click();
        assertThat(root().getByText("New Team Calendar", new Locator.GetByTextOptions().setExact(true))).isVisible();
        return this;
    }

    public Locator nameBox() {
        return root().getByRole(AriaRole.TEXTBOX, new Locator.GetByRoleOptions().setName("Name *").setExact(true));
    }

    public Locator displayNameBox() {
        return root().getByRole(AriaRole.TEXTBOX, new Locator.GetByRoleOptions().setName("Display name").setExact(true));
    }

    public TeamCalendarsSection create(String name, String displayName) {
        openCreateForm();
        nameBox().fill(name);
        if (displayName != null) {
            displayNameBox().fill(displayName);
        }
        button("Create").click();
        app.expectToast("Team calendar created");
        assertThat(nameBox()).isHidden();
        return this;
    }

    // --- list

    public Locator searchBox() {
        return root().getByPlaceholder("Search team calendars...");
    }

    public TeamCalendarsSection search(String text) {
        searchBox().fill(text);
        return this;
    }

    /** Titles of the listed rows ("1/name display name"), in display order. */
    public Locator rowTitles() {
        return root().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setLevel(4));
    }

    /** The row of a team calendar by name, in view or in edit mode; search for it first. */
    public DomainCalendarRow row(String name) {
        Locator controls = page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Delete team calendar").setExact(true))
            .or(page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Cancel").setExact(true)));
        Locator row = root().locator("div")
            .filter(new Locator.FilterOptions().setHasText(name))
            .filter(new Locator.FilterOptions().setHas(controls))
            .last();
        return new DomainCalendarRow(page, row, name);
    }

    /** Same row, with the name of its controls dialogs (the display name). */
    public DomainCalendarRow row(String name, String displayName) {
        return new DomainCalendarRow(page, row(name).root(), displayName);
    }

    public Locator noSearchResults() {
        return root().getByText("No results match your search.");
    }

    /** The display name text box of a row in edit mode. */
    public Locator editDisplayNameBox(String name) {
        return row(name).root().getByRole(AriaRole.TEXTBOX, new Locator.GetByRoleOptions().setName("Display name").setExact(true));
    }

    public MembersDialog openMembers(String name, String displayName) {
        row(name).button("Manage members").click();
        return new MembersDialog(page, displayName);
    }
}
