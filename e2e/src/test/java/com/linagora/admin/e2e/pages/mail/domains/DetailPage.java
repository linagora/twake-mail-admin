package com.linagora.admin.e2e.pages.mail.domains;

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

    /** An action button of a row, by its tooltip ("Remove alias", "Remove member"...). */
    public Locator rowButton(String item, String name) {
        return row(item).getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(name).setExact(true));
    }

    /** A field of the Rate Limiting section, by its label ("Mails sent / minute"). */
    public Locator rateLimit(String label) {
        return main().getByLabel(label, new Locator.GetByLabelOptions().setExact(true));
    }

    public Locator text(String text) {
        return main().getByText(text, new Locator.GetByTextOptions().setExact(true));
    }
}
