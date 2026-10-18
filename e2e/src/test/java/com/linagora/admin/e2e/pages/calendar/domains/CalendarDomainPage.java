package com.linagora.admin.e2e.pages.calendar.domains;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.util.regex.Pattern;

import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

/** The detail page of a domain in the Calendar flavour ({@code /domains/domain/<domain>}). */
public class CalendarDomainPage {
    public static final String ADMINS = "Domain Admins";
    public static final String RESOURCES = "Calendar Resources";
    public static final String TEAM_CALENDARS = "Team Calendars";
    public static final String SETTINGS = "Domain settings";
    public static final String CONTACTS = "Domain contacts";
    public static final String TASKS = "Tasks";

    private final AdminApp app;
    private final Page page;

    public CalendarDomainPage(AdminApp app) {
        this.app = app;
        this.page = app.page();
    }

    public CalendarDomainPage open(String domain) {
        app.open("/domains/domain/" + WebAdmin.encode(domain));
        assertThat(title()).isVisible();
        return this;
    }

    public Locator title() {
        return app.main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setName("Calendar Domain Details"));
    }

    public Locator backButton() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Back").setExact(true));
    }

    /** The toggle of a collapsible section, by its title ("Domain Admins (2)" matches "Domain Admins"). */
    public Locator sectionToggle(String title) {
        return sectionToggle(app.main(), title);
    }

    /** A collapsible section toggle within {@code scope}, its counter ignored. */
    public static Locator sectionToggle(Locator scope, String title) {
        return scope.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions()
            .setName(Pattern.compile("^" + regexQuote(title) + "\\s*(\\(\\d+\\))?$")));
    }

    /** Escapes a literal for a regex evaluated by the browser ({@code Pattern.quote} is Java only). */
    public static String regexQuote(String literal) {
        return literal.replaceAll("[.*+?^${}()|\\[\\]\\\\]", "\\\\$0");
    }

    /** The section toggles of the page, in display order. */
    public Locator sectionToggles() {
        return app.main().getByRole(AriaRole.BUTTON).filter(new Locator.FilterOptions().setHasText(Pattern.compile(
            "^(" + String.join("|", ADMINS, RESOURCES, TEAM_CALENDARS, SETTINGS, CONTACTS, TASKS) + ")\\s*(\\(\\d+\\))?$")));
    }

    public CalendarDomainPage expand(String title) {
        sectionToggle(title).click();
        return this;
    }

    // ---- Domain admins

    public Locator addAdminButton() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Add admin").setExact(true));
    }

    public Locator adminInput() {
        return page.getByPlaceholder("admin@domain.tld");
    }

    public Locator adminAddButton() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Add").setExact(true));
    }

    public Locator adminSearch() {
        return page.getByPlaceholder("Search administrators...");
    }

    /** The heading of an admin row ("1/alice@open-paas.org"). */
    public Locator adminRows() {
        return app.main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setLevel(4));
    }

    public Locator removeAdminButton(String admin) {
        return adminRows().filter(new Locator.FilterOptions().setHasText(admin)).locator("xpath=..")
            .getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Remove admin"));
    }

    /** Types an address and waits for the existence check to be over. */
    public CalendarDomainPage typeAdmin(String address) {
        adminInput().fill(address);
        assertThat(app.main().getByText("Checking...", new Locator.GetByTextOptions().setExact(true))).hasCount(0);
        return this;
    }

    public Locator indicator(String text) {
        return app.main().getByText(text, new Locator.GetByTextOptions().setExact(true));
    }

    // ---- Domain settings

    public Locator setting(String label) {
        return app.main().getByRole(AriaRole.COMBOBOX, new Locator.GetByRoleOptions().setName(label).setExact(true));
    }

    public CalendarDomainPage choose(String label, String option) {
        setting(label).click();
        page.getByRole(AriaRole.OPTION, new Page.GetByRoleOptions().setName(option).setExact(true)).click();
        assertThat(setting(label)).hasText(option);
        return this;
    }

    /** The items of the "Effective values" box, label and value. */
    public Locator effectiveValues() {
        return app.main().getByText("Effective values", new Locator.GetByTextOptions().setExact(true))
            .locator("xpath=..").getByRole(AriaRole.LISTITEM);
    }

    public Locator settingsButton(String name) {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(name).setExact(true));
    }

    // ---- Domain contacts

    /** A row of the "Domain contacts" section: "Domain address book (dab)" or "Domain members". */
    public Locator addressBookRow(String label) {
        return app.main().getByText(label, new Locator.GetByTextOptions().setExact(true)).locator("xpath=..");
    }

    // ---- Tasks

    public Locator taskButton(String name) {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(name).setExact(true));
    }
}
