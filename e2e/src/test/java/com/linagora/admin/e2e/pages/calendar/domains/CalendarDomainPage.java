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

    private String domain;

    public CalendarDomainPage open(String domain) {
        this.domain = domain;
        app.open("/domains/domain/" + WebAdmin.encode(domain));
        assertThat(title()).isVisible();
        return this;
    }

    /** The h1 of the page: the domain itself, the domain the page was opened on. */
    public Locator title() {
        return title(domain);
    }

    /** The h1 of the page of {@code domain}. */
    public Locator title(String domain) {
        return app.main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setLevel(1).setName(domain).setExact(true));
    }

    /** The line under the title naming the kind of object: "Domain". */
    public Locator subtitle() {
        return app.main().getByText("Domain", new Locator.GetByTextOptions().setExact(true));
    }

    /** The breadcrumb above the title, leading back to the domain list. */
    public Locator breadcrumb() {
        return app.main().getByRole(AriaRole.NAVIGATION, new Locator.GetByRoleOptions().setName("Breadcrumb"));
    }

    /** The back link of the breadcrumb: the chevron and the name of the list, "Domains". */
    public Locator backLink() {
        return breadcrumb().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName("Domains").setExact(true));
    }

    public Locator expandAllButton() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Expand all").setExact(true));
    }

    public Locator collapseAllButton() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Collapse all").setExact(true));
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

    /** Opens a section, unless it is open already: the sections remember their state. */
    public CalendarDomainPage expand(String title) {
        expand(app.main(), title);
        return this;
    }

    /** Opens a section of {@code scope}, unless it is open already (its state is remembered across pages and reloads). */
    public static void expand(Locator scope, String title) {
        Locator toggle = sectionToggle(scope, title);
        if (!"true".equals(toggle.getAttribute("aria-expanded"))) {
            toggle.click();
        }
        assertThat(toggle).hasAttribute("aria-expanded", "true");
    }

    /** Closes a section, unless it is closed already. */
    public CalendarDomainPage collapse(String title) {
        Locator toggle = sectionToggle(title);
        if ("true".equals(toggle.getAttribute("aria-expanded"))) {
            toggle.click();
        }
        assertThat(toggle).hasAttribute("aria-expanded", "false");
        return this;
    }

    /** Clicks the confirm button of the open confirmation, named after its action ("Remove"), and waits for it to close. */
    public CalendarDomainPage confirmWith(String label) {
        app.dialog().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(label).setExact(true)).click();
        assertThat(app.dialog()).isHidden();
        return this;
    }

    // ---- Domain admins

    /** The "+" next to the section title, opening the "Add admin" modal. */
    public Locator addAdminButton() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Add admin").setExact(true));
    }

    /** The "Add admin" modal. */
    public Locator addAdminDialog() {
        return app.dialog().filter(new Locator.FilterOptions().setHas(page.getByRole(AriaRole.HEADING,
            new Page.GetByRoleOptions().setName("Add admin").setExact(true))));
    }

    public Locator adminInput() {
        return addAdminDialog().getByPlaceholder("admin@domain.tld");
    }

    public Locator adminAddButton() {
        return addAdminDialog().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Add").setExact(true));
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
        assertThat(addAdminDialog().getByText("Checking...", new Locator.GetByTextOptions().setExact(true))).hasCount(0);
        return this;
    }

    /** The status of the typed address, under the field of the "Add admin" modal. */
    public Locator indicator(String text) {
        return addAdminDialog().getByText(text, new Locator.GetByTextOptions().setExact(true));
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

    /** A row of the "Domain contacts" section: "Shared domain address book" or "Domain members". */
    public Locator addressBookRow(String label) {
        return app.main().getByText(label, new Locator.GetByTextOptions().setExact(true))
            .locator("xpath=ancestor::*[@data-address-book-row][1]");
    }

    // ---- Tasks

    /** The row of a task of the Tasks section, by its title: title, risk badge, description and Run. */
    public Locator taskRow(String name) {
        return app.main().getByText(name, new Locator.GetByTextOptions().setExact(true))
            .locator("xpath=ancestor::*[@data-task-row][1]");
    }

    /** The Run button of a task, by the title of its row. */
    public Locator taskButton(String name) {
        return taskRow(name).getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(AdminApp.RUN_TASK_BUTTON));
    }
}
