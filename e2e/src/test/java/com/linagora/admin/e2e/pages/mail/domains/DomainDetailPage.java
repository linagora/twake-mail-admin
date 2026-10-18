package com.linagora.admin.e2e.pages.mail.domains;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;

/** Domains > a domain: Quota, Domain Aliases, Team Mailboxes, Domain Contacts, Signature Templates, Rate Limiting... */
public class DomainDetailPage extends DetailPage {
    private final String domain;

    private DomainDetailPage(AdminApp app, String domain) {
        super(app);
        this.domain = domain;
    }

    public static DomainDetailPage open(AdminApp app, String domain) {
        app.open("/domains/domain/" + WebAdmin.encode(domain));
        DomainDetailPage detail = new DomainDetailPage(app, domain);
        assertThat(detail.text("Domain: " + domain)).isVisible();
        return detail;
    }

    public String domain() {
        return domain;
    }

    /** Opens a section by clicking its title, and returns the page. */
    public DomainDetailPage openSection(String title) {
        toggleSection(title);
        return this;
    }

    // Quota

    public Locator sizeLimitInput() {
        return main().getByLabel("Size limit", new Locator.GetByLabelOptions().setExact(true));
    }

    public Locator sizeUnitSelect() {
        return main().getByLabel("Unit", new Locator.GetByLabelOptions().setExact(true));
    }

    /** "Update size limit" > value + unit > Save. */
    public void saveSizeLimit(String value, String unit) {
        if (sizeLimitInput().count() == 0) {
            button("Update size limit").click();
        }
        sizeLimitInput().fill(value);
        sizeUnitSelect().selectOption(unit);
        button("Save").click();
    }

    /** A row of the quota table ("Computed (effective)", "Domain", "Global", "Team Mailbox"): its label and values. */
    public Locator quotaRow(String label) {
        return text(label).locator("xpath=..");
    }

}
