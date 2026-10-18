package com.linagora.admin.e2e.pages.mail.userdetail;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.AriaRole;

/** The Global Quota page ({@code /global-quota}). */
public class GlobalQuotaPage {
    private final AdminApp app;

    public GlobalQuotaPage(AdminApp app) {
        this.app = app;
    }

    public GlobalQuotaPage open() {
        app.open("/global-quota");
        assertThat(currentQuota()).isVisible();
        return this;
    }

    private Locator heading(String name) {
        return app.main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setName(name).setExact(true));
    }

    /** The "Current global quota" block. */
    public Locator currentQuota() {
        return heading("Current global quota").locator("xpath=..");
    }

    /** The value of a row of a block ("Count", "Size"...): the text next to its label. */
    public static Locator value(Locator block, String label) {
        return block.getByText(label, new Locator.GetByTextOptions().setExact(true)).locator("xpath=following-sibling::*[1]");
    }

    public Locator size() {
        return value(currentQuota(), "Size");
    }

    public Locator count() {
        return value(currentQuota(), "Count");
    }

    public Locator aggregatedExtra() {
        return heading("Aggregated extra quotas").locator("xpath=..");
    }

    public Locator button(String name) {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(name).setExact(true));
    }

    public Locator sizeInput() {
        return app.main().getByLabel("Size limit", new Locator.GetByLabelOptions().setExact(true));
    }

    public Locator unit() {
        return app.main().getByLabel("Unit", new Locator.GetByLabelOptions().setExact(true));
    }

    /** "Update size limit", value, unit, Save. */
    public GlobalQuotaPage updateSize(String value, String unit) {
        button("Update size limit").click();
        sizeInput().fill(value);
        unit().selectOption(unit);
        button("Save").click();
        return this;
    }

    /** A collapsible section title of the page, whose name starts with {@code title}. */
    public Locator toggle(String title) {
        return app.main().getByRole(AriaRole.BUTTON,
            new Locator.GetByRoleOptions().setName(java.util.regex.Pattern.compile("^" + Regex.escape(title))));
    }

    public Locator minOccupation() {
        return app.main().getByLabel("Min occupation (%)");
    }

    public Locator maxOccupation() {
        return app.main().getByLabel("Max occupation (%)");
    }

    public Locator searchButton() {
        return button("Search");
    }
}
