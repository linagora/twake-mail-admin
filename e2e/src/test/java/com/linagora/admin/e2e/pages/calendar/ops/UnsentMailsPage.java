package com.linagora.admin.e2e.pages.calendar.ops;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.AriaRole;

/** Unsent Mails: the mails the side service could not deliver. */
public class UnsentMailsPage {
    public static final String BULK_HINT = "Bulk actions select mails by complete address: type a full sender or recipient address "
        + "(e.g. alice@example.com) to resend or delete the listed mails.";

    private final AdminApp app;

    private UnsentMailsPage(AdminApp app) {
        this.app = app;
    }

    public static UnsentMailsPage open(AdminApp app) {
        app.open("/");
        app.navigate("Unsent Mails");
        UnsentMailsPage page = new UnsentMailsPage(app);
        assertThat(page.senderFilter()).isVisible();
        assertThat(app.main().getByText("Loading...")).hasCount(0);
        return page;
    }

    public Locator senderFilter() {
        return app.page().getByPlaceholder("Filter by sender");
    }

    public Locator recipientFilter() {
        return app.page().getByPlaceholder("Filter by recipient");
    }

    public Locator resendAll() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Resend all mails").setExact(true));
    }

    public Locator deleteAll() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Delete all mails").setExact(true));
    }

    public Locator bulkHint() {
        return app.main().getByText(BULK_HINT);
    }

    /** The row of a mail: a link to its detail page, named after its id. */
    public Locator row(String id) {
        return app.main().getByRole(AriaRole.LINK).filter(new Locator.FilterOptions().setHasText(id));
    }

    public Locator rows() {
        return app.main().getByRole(AriaRole.LINK).filter(new Locator.FilterOptions().setHasText("Sender:"));
    }

    public Locator rowAction(String id, String title) {
        return row(id).getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(title).setExact(true));
    }

    public UnsentMailsPage filter(String sender, String recipient) {
        senderFilter().fill(sender);
        recipientFilter().fill(recipient);
        return this;
    }
}
