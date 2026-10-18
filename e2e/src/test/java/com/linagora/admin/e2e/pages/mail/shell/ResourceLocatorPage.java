package com.linagora.admin.e2e.pages.mail.shell;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.AriaRole;

/** The Resource Locator page: two look-up forms, a mailbox by ID and a message by ID. */
public class ResourceLocatorPage {
    public static final String MAILBOX = "Look up a mailbox by ID";
    public static final String MESSAGE = "Locate a message by ID";
    public static final String NOT_FOUND = "No result found for this identifier.";
    public static final String INVALID = "The provided identifier is syntactically invalid.";

    private final AdminApp app;

    public ResourceLocatorPage(AdminApp app) {
        this.app = app;
    }

    public static ResourceLocatorPage open(AdminApp app) {
        app.open("/resource-locator");
        return new ResourceLocatorPage(app);
    }

    /** The block of one look-up form, by its heading. */
    public Locator form(String heading) {
        return app.main().locator("div").filter(new Locator.FilterOptions()
            .setHas(app.page().getByRole(AriaRole.HEADING, new com.microsoft.playwright.Page.GetByRoleOptions().setName(heading).setExact(true))))
            .filter(new Locator.FilterOptions().setHas(app.page().getByRole(AriaRole.TEXTBOX))).last();
    }

    public Locator field(String heading) {
        return app.main().getByRole(AriaRole.TEXTBOX, new Locator.GetByRoleOptions().setName(heading).setExact(true));
    }

    public Locator lookUp(String heading) {
        return form(heading).getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Look up").setExact(true));
    }

    public ResourceLocatorPage search(String heading, String id) {
        field(heading).fill(id);
        lookUp(heading).click();
        return this;
    }
}
