package com.linagora.admin.e2e.pages.mail.domains;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.util.regex.Pattern;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

/** The Domains list: creation field, import, search, paginated rows {@code N/ domain}. */
public class DomainsPage {
    private final AdminApp app;

    public DomainsPage(AdminApp app) {
        this.app = app;
    }

    public static DomainsPage open(AdminApp app) {
        app.open("/domains");
        DomainsPage domains = new DomainsPage(app);
        assertThat(domains.searchInput()).isVisible();
        return domains;
    }

    public AdminApp app() {
        return app;
    }

    public Page page() {
        return app.page();
    }

    public Locator newDomainInput() {
        return app.main().getByPlaceholder("New domain name", new Locator.GetByPlaceholderOptions().setExact(true));
    }

    public Locator createButton() {
        return mainButton("Create");
    }

    public Locator importButton() {
        return mainButton("Import");
    }

    /** The "?" next to Import: a button named after its help text. */
    public Locator importHelpButton() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions()
            .setName(Pattern.compile("^Text file, one domain per line")));
    }

    public Locator searchInput() {
        return app.main().getByPlaceholder("Search domains...", new Locator.GetByPlaceholderOptions().setExact(true));
    }

    public DomainsPage search(String query) {
        searchInput().fill(query);
        return this;
    }

    public Locator domainLink(String domain) {
        return app.main().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName(domain).setExact(true));
    }

    /** The headings of the listed rows, {@code "1/domain"}. */
    public Locator rowHeadings() {
        return app.main().getByRole(AriaRole.HEADING)
            .filter(new Locator.FilterOptions().setHas(page().getByRole(AriaRole.LINK)));
    }

    /** The trash buttons of the listed rows. */
    public Locator deleteButtons() {
        return mainButton("Delete Domain");
    }

    public Locator paginationLabel() {
        return app.main().getByText(Pattern.compile("^Page \\d+ / \\d+ — Total: \\d+$"));
    }

    public Locator nextPageButton() {
        return mainButton("Next");
    }

    /** Fills the creation field, clicks Create and confirms. */
    public DomainsPage create(String domain) {
        newDomainInput().fill(domain);
        createButton().click();
        app.confirm();
        return this;
    }

    public Locator text(String text) {
        return app.main().getByText(text, new Locator.GetByTextOptions().setExact(true));
    }

    private Locator mainButton(String name) {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(name).setExact(true));
    }

    public static Pattern rowHeading(int index, String domain) {
        return Pattern.compile("^" + index + "/\\s*" + Regex.quote(domain) + "$");
    }
}
