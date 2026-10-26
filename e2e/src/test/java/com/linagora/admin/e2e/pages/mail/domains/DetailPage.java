package com.linagora.admin.e2e.pages.mail.domains;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.util.regex.Pattern;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

/**
 * Common ground of the domain, team mailbox and folder detail pages: a stack of collapsible
 * sections whose title is a button ("Domain Aliases (0)"), icon buttons named by their tooltip,
 * and rows whose heading reads {@code "N/ item"}.
 */
public class DetailPage {
    protected final AdminApp app;

    public DetailPage(AdminApp app) {
        this.app = app;
    }

    public AdminApp app() {
        return app;
    }

    public Page page() {
        return app.page();
    }

    public Locator main() {
        return app.main();
    }

    /** The h1 of the page: the object it is about ("example.com", "sales@example.com", "INBOX"). */
    public Locator title() {
        return main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setLevel(1));
    }

    /** The back link above the title, named after the parent page ("Domains", "example.com"). */
    public Locator breadcrumb() {
        return main().getByRole(AriaRole.NAVIGATION, new Locator.GetByRoleOptions().setName("Breadcrumb").setExact(true))
            .getByRole(AriaRole.LINK);
    }

    /** The title button of a section, with or without its {@code (n)} counter. */
    public Locator sectionButton(String title) {
        return main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions()
            .setName(Pattern.compile("^" + Regex.quote(title) + "( \\(\\d+\\))?$")));
    }

    /** The title button of a section showing exactly {@code count}: {@code "Domain Aliases (1)"}. */
    public Locator sectionButton(String title, int count) {
        return main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions()
            .setName(title + " (" + count + ")").setExact(true));
    }

    /** Clicks a section title (toggles it). */
    public void toggleSection(String title) {
        sectionButton(title).click();
    }

    /** Opens a section unless it is already expanded: a section remembers its state across reloads. */
    public void expandSection(String title) {
        Locator toggle = sectionButton(title);
        assertThat(toggle).isVisible();
        if (!"true".equals(toggle.getAttribute("aria-expanded"))) {
            toggle.click();
        }
        assertThat(toggle).hasAttribute("aria-expanded", "true");
    }

    /** A button by its exact accessible name (visible text, or tooltip of an icon button). */
    public Locator button(String name) {
        return main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(name).setExact(true));
    }

    public Locator placeholder(String placeholder) {
        return main().getByPlaceholder(placeholder, new Locator.GetByPlaceholderOptions().setExact(true));
    }

    /** The heading of a listed row, {@code "N/ item"} (an optional suffix such as the role is allowed). */
    public Locator rowHeading(String item) {
        return main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions()
            .setName(Pattern.compile("^\\d+\\/\\s*" + Regex.quote(item) + "(\\s*\\(.*\\))?$")));
    }

    /** The whole row of an item: the closest block around its heading holding its action buttons. */
    public Locator row(String item) {
        return rowHeading(item).locator("xpath=ancestor::div[.//button][1]");
    }

    /** An action button of a row, by its accessible name ("Remove alias \"a@b.org\"", "Remove member"...). */
    public Locator rowButton(String item, String name) {
        return row(item).getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(name).setExact(true));
    }

    /** A field of the Rate Limiting section, by its label ("Mails sent / minute"). */
    public Locator rateLimit(String label) {
        return main().getByLabel(label, new Locator.GetByLabelOptions().setExact(true));
    }

    // Quota: "Edit limits" opens a modal editing the message count and the size limits together

    /** A row of a quota table ("Applied limit", "Domain", "Global", "Team Mailbox"): its label and values. */
    public Locator quotaRow(String label) {
        // The parent of the label holding the values: not the "Domain" subtitle of the domain page
        return text(label).locator("xpath=..").filter(new Locator.FilterOptions().setHasText("Count:"));
    }

    public Locator editLimitsButton() {
        return button("Edit limits");
    }

    /** A limit of the "Quota limits of ..." modal, a group named "Message count" or "Size". */
    public Locator limitGroup(String limit) {
        return dialog().getByRole(AriaRole.GROUP, new Locator.GetByRoleOptions().setName(limit).setExact(true));
    }

    /** The value field of a limit of the open modal ("Message count", "Size"). */
    public Locator limitInput(String limit) {
        return limitGroup(limit).getByRole(AriaRole.SPINBUTTON);
    }

    /** The "Unlimited" box of a limit of the open modal. */
    public Locator limitUnlimited(String limit) {
        return limitGroup(limit).getByRole(AriaRole.CHECKBOX, new Locator.GetByRoleOptions().setName("Unlimited").setExact(true));
    }

    public Locator sizeUnitSelect() {
        return dialog().getByLabel("Unit", new Locator.GetByLabelOptions().setExact(true));
    }

    /** "Edit limits", then the size typed in {@code unit}, then Save: the modal stays open on an invalid value. */
    public void saveSizeLimit(String value, String unit) {
        editLimitsButton().click();
        assertThat(dialog()).isVisible();
        limitInput("Size").fill(value);
        sizeUnitSelect().selectOption(unit);
        dialogButton("Save").click();
    }

    /** The open dialog (a creation modal, a confirmation...): the topmost one when two are stacked. */
    public Locator dialog() {
        return app.dialog();
    }

    /** A button of the open dialog, by its exact name ("Add", "Create", "Remove", "Start task"...). */
    public Locator dialogButton(String name) {
        return dialog().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(name).setExact(true));
    }

    /** A field of the open dialog, by its exact label. */
    public Locator dialogField(String label) {
        return dialog().getByLabel(label, new Locator.GetByLabelOptions().setExact(true));
    }

    /**
     * Clicks the confirm button of the open confirmation, named after its action ("Remove",
     * "Delete", "Clear"...), and waits for every dialog to close.
     */
    public void confirmWith(String label) {
        dialogButton(label).click();
        assertThat(dialog()).hasCount(0);
    }

    /** Types the word a destructive confirmation asks for ("Type example.com to confirm"). */
    public void typeToConfirm(String value) {
        dialogField("Type " + value + " to confirm").fill(value);
    }

    public Locator text(String text) {
        return main().getByText(text, new Locator.GetByTextOptions().setExact(true));
    }
}
