package com.linagora.admin.e2e.pages.calendar.ops;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.util.regex.Pattern;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

/**
 * The confirmation dialog of a task (user task or common task): its parameters, named
 * {@code "<key>:"}, and its "Command: curl ..." preview.
 */
public class TaskDialog {
    private final AdminApp app;

    public TaskDialog(AdminApp app) {
        this.app = app;
    }

    public Locator root() {
        return app.dialog();
    }

    public Locator title() {
        return root().getByRole(AriaRole.HEADING).first();
    }

    /** The field of a parameter: input, number of a duration, or select trigger. */
    public Locator param(String key) {
        return root().getByLabel(key + ":", new Locator.GetByLabelOptions().setExact(true));
    }

    public TaskDialog fill(String key, String value) {
        param(key).fill(value);
        return this;
    }

    public TaskDialog clear(String key) {
        param(key).clear();
        return this;
    }

    /** Picks a value of a select parameter (isRejected, isNotRecurring, scope...). */
    public TaskDialog choose(String key, String value) {
        param(key).click();
        app.page().getByRole(AriaRole.OPTION, new Page.GetByRoleOptions().setName(value).setExact(true)).click();
        assertThat(param(key)).containsText(value);
        return this;
    }

    /** Sets a duration parameter: amount and unit label ("Days", "Years"...). */
    public TaskDialog duration(String key, String amount, String unit) {
        param(key).fill(amount);
        Locator unitSelect = root().getByRole(AriaRole.COMBOBOX, new Locator.GetByRoleOptions().setName(key + " unit").setExact(true));
        unitSelect.click();
        app.page().getByRole(AriaRole.OPTION, new Page.GetByRoleOptions().setName(unit).setExact(true)).click();
        assertThat(unitSelect).containsText(unit);
        return this;
    }

    public Locator command() {
        return root().getByText(Pattern.compile("^Command: "));
    }

    public TaskDialog expectCommand(String curl) {
        assertThat(command()).hasText("Command: " + curl);
        return this;
    }

    public Locator confirmButton() {
        return root().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Confirm").setExact(true));
    }

    public Locator cancelButton() {
        return root().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Cancel").setExact(true));
    }

    public Locator error() {
        return app.dialogError();
    }
}
