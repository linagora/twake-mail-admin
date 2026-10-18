package com.linagora.admin.e2e.pages.mail.userdetail;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.util.regex.Pattern;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.AriaRole;

/**
 * The global Mappings page ({@code /mappings}). The table lists the mappings of the whole server:
 * tests filter it on their own domain before looking at, or deleting, rows.
 */
public class MappingsPage {
    private final AdminApp app;

    public MappingsPage(AdminApp app) {
        this.app = app;
    }

    public MappingsPage open() {
        app.open("/mappings");
        assertThat(table()).isVisible();
        return this;
    }

    public Locator button(String name) {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(name).setExact(true));
    }

    public Locator search() {
        return app.main().getByPlaceholder("Search by source, type or destination...");
    }

    public MappingsPage filter(String text) {
        search().fill(text);
        return this;
    }

    public Locator table() {
        return app.main().getByRole(AriaRole.TABLE);
    }

    /** The body rows of the table. */
    public Locator rows() {
        return table().getByRole(AriaRole.ROW).filter(new Locator.FilterOptions().setHas(
            app.page().getByRole(AriaRole.CELL)));
    }

    public Locator row(String source, String type, String destination) {
        return rows().filter(hasCell(source)).filter(hasCell(type)).filter(hasCell(destination));
    }

    private Locator.FilterOptions hasCell(String text) {
        return new Locator.FilterOptions().setHas(app.page().getByRole(AriaRole.CELL,
            new com.microsoft.playwright.Page.GetByRoleOptions().setName(text).setExact(true)));
    }

    public Locator pageLabel() {
        return app.main().getByText(Pattern.compile("^Page \\d+ / \\d+ — Total: \\d+$"));
    }

    public MappingsPage addAddress(String source, String destination) {
        button("Add Address Mapping").click();
        app.main().getByPlaceholder("Source (e.g. user@domain.com)").fill(source);
        app.main().getByPlaceholder("Destination (e.g. alias@domain.com)").fill(destination);
        button("Create").click();
        return this;
    }

    public MappingsPage addRegex(String source, String regex) {
        button("Add Regex Mapping").click();
        app.main().getByPlaceholder("Mapping source (e.g. user@domain.com)").fill(source);
        app.main().getByPlaceholder("Regex (e.g. user@.*:intern@domain.com)").fill(regex);
        button("Create").click();
        return this;
    }

    public Locator domainHint() {
        return app.main().getByText(Pattern.compile("^Mail addressed to the source domain will be rewritten"));
    }

    public MappingsPage openDomainForm(String source, String destination) {
        button("Add Domain Mapping").click();
        app.main().getByPlaceholder("Source domain (e.g. sourceDomain.tld)").fill(source);
        app.main().getByPlaceholder("Destination domain (e.g. destination.tld)").fill(destination);
        return this;
    }

    /** The remove action of a row, "Remove Address Mapping". */
    public Locator removeButton(Locator row) {
        return row.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(Pattern.compile("^Remove \\w+ Mapping$")));
    }

    public Locator deletePageButton() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(Pattern.compile("^Delete page \\(\\d+\\)$")));
    }
}
