package com.linagora.admin.e2e.pages.calendar.domains;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.util.regex.Pattern;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

/** The domain list of the Calendar flavour ({@code /domains}). */
public class DomainsPage {
    private final AdminApp app;
    private final Page page;

    public DomainsPage(AdminApp app) {
        this.app = app;
        this.page = app.page();
    }

    public DomainsPage open() {
        app.open("/domains");
        assertThat(searchInput()).isVisible();
        return this;
    }

    public Locator newDomainInput() {
        return page.getByPlaceholder("New domain name");
    }

    public Locator createButton() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Create").setExact(true));
    }

    public Locator importButton() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Import").setExact(true));
    }

    public Locator importHelpButton() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions()
            .setName(Pattern.compile("^Text file, one domain per line")));
    }

    public Locator searchInput() {
        return page.getByPlaceholder("Search domains...");
    }

    public DomainsPage search(String query) {
        searchInput().fill(query);
        return this;
    }

    /** The links of the listed domains, in display order. */
    public Locator domainLinks() {
        return app.main().getByRole(AriaRole.LINK).filter(new Locator.FilterOptions()
            .setHasNotText(Pattern.compile("^doc$")));
    }

    public Locator domainLink(String domain) {
        return app.main().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName(domain).setExact(true));
    }

    /** The row of a domain: its "n/" index, its link and its delete button. */
    public Locator row(String domain) {
        return domainLink(domain).locator("xpath=ancestor::div[2]");
    }

    public Locator deleteButton(String domain) {
        return row(domain).getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Delete Domain"));
    }

    public Locator pagination() {
        return app.main().getByText(Pattern.compile("^Page \\d+ / \\d+ — Total: \\d+$"));
    }
}
