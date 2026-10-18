package com.linagora.admin.e2e.pages.calendar.resources;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

/** "Members — <display name>": the members of a team calendar, staged then applied. */
public class MembersDialog {
    private final Page page;
    private final Locator root;

    MembersDialog(Page page, String displayName) {
        this.page = page;
        this.root = page.getByRole(AriaRole.DIALOG, new Page.GetByRoleOptions().setName("Members — " + displayName));
    }

    public Locator root() {
        return root;
    }

    public Locator emailBox() {
        return root.getByRole(AriaRole.TEXTBOX, new Locator.GetByRoleOptions().setName("Member email").setExact(true));
    }

    public Locator roleSelect() {
        return root.getByRole(AriaRole.COMBOBOX, new Locator.GetByRoleOptions().setName("Role").setExact(true));
    }

    public Locator addButton() {
        return button("Add member");
    }

    public Locator applyButton() {
        return button("Apply");
    }

    public Locator button(String name) {
        return root.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(name).setExact(true));
    }

    /** Types a member, picks its role and stages it with "+". */
    public MembersDialog stage(String email, String roleLabel) {
        emailBox().fill(email);
        roleSelect().selectOption(roleLabel);
        addButton().click();
        return this;
    }

    public Locator roleOf(String email) {
        return root.getByRole(AriaRole.COMBOBOX, new Locator.GetByRoleOptions().setName("Role of " + email).setExact(true));
    }

    /** The line of a member (existing or staged), holding its address. */
    public Locator member(String email) {
        return root.locator("div")
            .filter(new Locator.FilterOptions().setHas(page.getByText(email, new Page.GetByTextOptions().setExact(true))))
            .filter(new Locator.FilterOptions().setHas(page.getByRole(AriaRole.BUTTON)))
            .last();
    }

    public Locator memberAddress(String email) {
        return root.getByText(email, new Locator.GetByTextOptions().setExact(true));
    }
}
