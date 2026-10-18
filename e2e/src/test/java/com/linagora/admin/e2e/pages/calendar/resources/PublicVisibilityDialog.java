package com.linagora.admin.e2e.pages.calendar.resources;

import java.util.regex.Pattern;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

/** The "Public visibility — <name>" dialog of a resource or a team calendar. */
public class PublicVisibilityDialog {
    public static final String HINT = "The current visibility is not displayed: choose the one to apply.";

    private final Locator root;

    PublicVisibilityDialog(Page page, String name) {
        this.root = page.getByRole(AriaRole.DIALOG, new Page.GetByRoleOptions().setName("Public visibility — " + name));
    }

    public Locator root() {
        return root;
    }

    /** Each radio is named by its title followed by its description. */
    public Locator publicOption() {
        return root.getByRole(AriaRole.RADIO, new Locator.GetByRoleOptions().setName(Pattern.compile("^Public")));
    }

    public Locator privateOption() {
        return root.getByRole(AriaRole.RADIO, new Locator.GetByRoleOptions().setName(Pattern.compile("^Private")));
    }

    public Locator saveButton() {
        return root.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Save").setExact(true));
    }
}
