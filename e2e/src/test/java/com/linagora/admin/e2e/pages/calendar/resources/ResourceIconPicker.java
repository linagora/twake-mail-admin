package com.linagora.admin.e2e.pages.calendar.resources;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.util.regex.Pattern;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.AriaRole;

/** The icon picker of the resource forms: a trigger named "Icon <current icon>" opening a list. */
public class ResourceIconPicker {
    private final Locator scope;

    ResourceIconPicker(Locator scope) {
        this.scope = scope;
    }

    public Locator trigger() {
        return scope.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(Pattern.compile("^Icon ")));
    }

    /** Picks an icon by its label ("Laptop", "Projector"...). */
    public void pick(String label) {
        trigger().click();
        Locator list = scope.getByRole(AriaRole.GROUP);
        list.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(label).setExact(true)).click();
        assertThat(trigger()).hasAccessibleName("Icon " + label);
    }
}
