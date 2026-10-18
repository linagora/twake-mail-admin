package com.linagora.admin.e2e.pages.calendar.users;

import java.util.regex.Pattern;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.AriaRole;

/** The create / edit dialog of a calendar or an address book. */
public class CollectionForm {
    private final AdminApp app;

    public CollectionForm(AdminApp app) {
        this.app = app;
    }

    public Locator dialog() {
        return app.dialog();
    }

    public Locator title() {
        return dialog().getByRole(AriaRole.HEADING).first();
    }

    /** "Name *", named after its label. */
    public Locator name() {
        return dialog().getByRole(AriaRole.TEXTBOX, new Locator.GetByRoleOptions().setName(Pattern.compile("^Name")));
    }

    public Locator description() {
        return dialog().getByRole(AriaRole.TEXTBOX, new Locator.GetByRoleOptions().setName("Description").setExact(true));
    }

    public Locator colorCode() {
        return dialog().getByRole(AriaRole.TEXTBOX, new Locator.GetByRoleOptions().setName("Color code").setExact(true));
    }

    /** The {@code <input type="color">} picker. */
    public Locator colorPicker() {
        return dialog().getByLabel("Color", new Locator.GetByLabelOptions().setExact(true));
    }

    public Locator colorError() {
        return dialog().getByText("Enter a color in #rrggbb format (e.g. #007fd8).");
    }

    public Locator createButton() {
        return CollectionSection.button(dialog(), "Create");
    }

    public Locator saveButton() {
        return CollectionSection.button(dialog(), "Save");
    }
}
