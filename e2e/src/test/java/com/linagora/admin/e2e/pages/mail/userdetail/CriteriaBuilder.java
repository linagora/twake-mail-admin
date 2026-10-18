package com.linagora.admin.e2e.pages.mail.userdetail;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

/**
 * The deleted messages criteria builder: rows of Field / Operator / Value, used by the Deleted
 * Message Vault section and by the "Restore deleted messages" task dialog.
 */
public class CriteriaBuilder {
    public static final String INCOMPLETE = "Complete or remove every criterion before searching or restoring.";

    private final Page page;
    private final Locator root;

    public CriteriaBuilder(Page page, Locator root) {
        this.page = page;
        this.root = root;
    }

    public CriteriaBuilder addCriterion() {
        root.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Add criterion").setExact(true)).click();
        return this;
    }

    public Locator fields() {
        return root.getByRole(AriaRole.COMBOBOX, new Locator.GetByRoleOptions().setName("Field").setExact(true));
    }

    public Locator operators() {
        return root.getByRole(AriaRole.COMBOBOX, new Locator.GetByRoleOptions().setName("Operator").setExact(true));
    }

    /** The text value inputs (text fields only, checkboxes are {@link #checkboxValues()}). */
    public Locator textValues() {
        return root.getByRole(AriaRole.TEXTBOX, new Locator.GetByRoleOptions().setName("Value").setExact(true));
    }

    public Locator checkboxValues() {
        return root.getByRole(AriaRole.CHECKBOX, new Locator.GetByRoleOptions().setName("Value").setExact(true));
    }

    public Locator removeButtons() {
        return root.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Remove criterion").setExact(true));
    }

    /** Picks the field of row {@code index} by its label ("Subject", "Has attachment"...). */
    public CriteriaBuilder field(int index, String label) {
        fields().nth(index).click();
        page.getByRole(AriaRole.OPTION, new Page.GetByRoleOptions().setName(label).setExact(true)).click();
        return this;
    }

    /** Picks the operator of row {@code index} by its label ("Contains", "Equals"...). */
    public CriteriaBuilder operator(int index, String label) {
        operators().nth(index).click();
        page.getByRole(AriaRole.OPTION, new Page.GetByRoleOptions().setName(label).setExact(true)).click();
        return this;
    }

    public Locator incompleteMessage() {
        return root.getByText(INCOMPLETE, new Locator.GetByTextOptions().setExact(true));
    }
}
