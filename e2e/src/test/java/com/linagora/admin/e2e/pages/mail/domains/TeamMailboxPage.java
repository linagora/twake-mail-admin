package com.linagora.admin.e2e.pages.mail.domains;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;

/** A team mailbox: Members (open by default), Folders, Quota, Extra Senders, Deleted Message Vault. */
public class TeamMailboxPage extends DetailPage {
    private final String domain;
    private final String name;

    private TeamMailboxPage(AdminApp app, String domain, String name) {
        super(app);
        this.domain = domain;
        this.name = name;
    }

    public static String path(String domain, String name) {
        return "/domains/domain/" + WebAdmin.encode(domain) + "/team-mailbox/" + WebAdmin.encode(name);
    }

    public static TeamMailboxPage open(AdminApp app, String domain, String name) {
        app.open(path(domain, name));
        return expect(app, domain, name);
    }

    /** The page reached by a link, once it shows. */
    public static TeamMailboxPage expect(AdminApp app, String domain, String name) {
        TeamMailboxPage page = new TeamMailboxPage(app, domain, name);
        assertThat(page.text("Mailbox: " + name + "@" + domain)).isVisible();
        return page;
    }

    public String address() {
        return name + "@" + domain;
    }

    /** The username field: Members and Extra Senders are both open by default, collapse one of them first. */
    public Locator usernameInput() {
        return placeholder("user@domain.tld");
    }

    public Locator roleSelect() {
        return main().getByLabel("Role", new Locator.GetByLabelOptions().setExact(true));
    }

    public Locator addButton() {
        return button("Add");
    }

    /** Collapses the Extra Senders section, open by default, so that Members has the only username field. */
    public TeamMailboxPage collapseExtraSenders() {
        toggleSection("Extra Senders");
        assertThat(usernameInput()).hasCount(1);
        return this;
    }

    /** Collapses the Members section, open by default, so that Extra Senders has the only username field. */
    public TeamMailboxPage collapseMembers() {
        toggleSection("Members");
        assertThat(roleSelect()).hasCount(0);
        return this;
    }

    public Locator sizeLimitInput() {
        return main().getByLabel("Size limit", new Locator.GetByLabelOptions().setExact(true));
    }

    public Locator sizeUnitSelect() {
        return main().getByLabel("Unit", new Locator.GetByLabelOptions().setExact(true));
    }

    public Locator quotaRow(String label) {
        return text(label).locator("xpath=..");
    }
}
