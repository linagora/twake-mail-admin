package com.linagora.admin.e2e.pages.calendar.users;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.assertions.LocatorAssertions;
import com.microsoft.playwright.options.AriaRole;
import com.microsoft.playwright.options.SelectOption;

/**
 * The "Delegation (invitees)" dialog of a calendar, or the "Sharing" dialog of an address book:
 * same shape, named after their own labels.
 */
public class InviteesDialog {
    /** The user check ("Checking...") can last seconds on a loaded stack. */
    private static final double CHECK_TIMEOUT_MS = 20_000;

    private final AdminApp app;
    private final String noun;
    private final String addName;

    private InviteesDialog(AdminApp app, String noun, String addName) {
        this.app = app;
        this.noun = noun;
        this.addName = addName;
    }

    public static InviteesDialog delegation(AdminApp app) {
        return new InviteesDialog(app, "Invitee", "Add invitee");
    }

    public static InviteesDialog sharing(AdminApp app) {
        return new InviteesDialog(app, "Sharee", "Add sharee");
    }

    public Locator dialog() {
        return app.dialog();
    }

    public Locator title() {
        return dialog().getByRole(AriaRole.HEADING).first();
    }

    public Locator email() {
        return dialog().getByRole(AriaRole.TEXTBOX, new Locator.GetByRoleOptions().setName(noun + " email").setExact(true));
    }

    public Locator right() {
        return dialog().getByRole(AriaRole.COMBOBOX, new Locator.GetByRoleOptions().setName("Right").setExact(true));
    }

    public Locator rightOf(String email) {
        return dialog().getByRole(AriaRole.COMBOBOX, new Locator.GetByRoleOptions().setName("Right of " + email).setExact(true));
    }

    public Locator addButton() {
        return CollectionSection.button(dialog(), addName);
    }

    public Locator applyButton() {
        return CollectionSection.button(dialog(), "Apply");
    }

    public Locator cancelButton() {
        return CollectionSection.button(dialog(), "Cancel");
    }

    /** The line of a current invitee / sharee. */
    public Locator entry(String email) {
        return CollectionSection.rowsIn(dialog(), email).first();
    }

    public Locator removeButton(String email) {
        return CollectionSection.button(entry(email), "Remove");
    }

    public Locator undoRemoveButton(String email) {
        return CollectionSection.button(entry(email), "Undo removal");
    }

    /** The user-existence hint under the e-mail input. */
    public Locator hint(String text) {
        return dialog().getByText(text, new Locator.GetByTextOptions().setExact(true));
    }

    /** Types an address and waits for the user check to give {@code expectedHint}. */
    public InviteesDialog type(String email, String expectedHint) {
        email().fill(email);
        assertThat(hint(expectedHint)).isVisible(new LocatorAssertions.IsVisibleOptions().setTimeout(CHECK_TIMEOUT_MS));
        assertThat(hint("Checking...")).isHidden();
        return this;
    }

    /** Stages a new invitee with a right ("read", "read-write", "administration"). */
    public InviteesDialog stage(String email, String rightValue) {
        type(email, "User exists");
        right().selectOption(new SelectOption().setValue(rightValue));
        addButton().click();
        assertThat(email()).hasValue("");
        return this;
    }

    /** Clicks Apply and waits for the dialog to close on the success toast. */
    public void apply(String toast) {
        applyButton().click();
        app.expectToast(toast);
        assertThat(dialog()).isHidden();
    }

    public void cancel() {
        cancelButton().click();
        assertThat(dialog()).isHidden();
    }
}
