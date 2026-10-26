package com.linagora.admin.e2e.pages.mail.userdetail;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.util.regex.Pattern;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.AriaRole;

/**
 * The global Mappings page ({@code /mappings}). The table lists the mappings of the whole server:
 * tests filter it on their own domain before looking at, or deleting, rows. Its toolbar holds the
 * search and "Add a mapping" (a modal where the kind of mapping is chosen). After a search, "Delete
 * the n matching mappings" sits on the total line.
 */
public class MappingsPage {
    private final AdminApp app;

    public MappingsPage(AdminApp app) {
        this.app = app;
    }

    public MappingsPage open() {
        app.open("/mappings");
        assertThat(table()).isVisible();
        return this;
    }

    public Locator button(String name) {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(name).setExact(true));
    }

    public Locator search() {
        return app.main().getByPlaceholder("Search by source, type or destination...");
    }

    public MappingsPage filter(String text) {
        search().fill(text);
        return this;
    }

    public Locator table() {
        return app.main().getByRole(AriaRole.TABLE);
    }

    /** The body rows of the table. */
    public Locator rows() {
        return table().getByRole(AriaRole.ROW).filter(new Locator.FilterOptions().setHas(
            app.page().getByRole(AriaRole.CELL)));
    }

    public Locator row(String source, String type, String destination) {
        return rows().filter(hasCell(source)).filter(hasCell(type)).filter(hasCell(destination));
    }

    private Locator.FilterOptions hasCell(String text) {
        return new Locator.FilterOptions().setHas(app.page().getByRole(AriaRole.CELL,
            new com.microsoft.playwright.Page.GetByRoleOptions().setName(text).setExact(true)));
    }

    /** "Page 1 / 2 — Total: 60", or "Total: 2" alone when everything fits on one page. */
    public Locator pageLabel() {
        return app.main().getByText(Pattern.compile("^(Page \\d+ / \\d+ — )?Total: \\d+$"));
    }

    /** The "Add a mapping" modal. */
    public Locator dialog() {
        return app.dialog();
    }

    private Locator field(String label) {
        return dialog().getByLabel(label, new Locator.GetByLabelOptions().setExact(true));
    }

    /** Opens "Add a mapping" and fills it: kind "Address", "Regular expression" or "Domain". */
    public MappingsPage openForm(String kind, String source, String destination) {
        button("Add a mapping").click();
        assertThat(dialog().getByRole(AriaRole.HEADING)).hasText("Add a mapping");
        field("Type").selectOption(new com.microsoft.playwright.options.SelectOption().setLabel(kind));
        field("Source").fill(source);
        field("Destination").fill(destination);
        return this;
    }

    /** Clicks Create in the "Add a mapping" modal. */
    public MappingsPage create() {
        dialog().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Create").setExact(true)).click();
        return this;
    }

    public MappingsPage addAddress(String source, String destination) {
        openForm("Address", source, destination);
        assertThat(field("Source")).hasAttribute("placeholder", "e.g. sales@example.com");
        return create();
    }

    public MappingsPage addRegex(String source, String regex) {
        openForm("Regular expression", source, regex);
        assertThat(field("Destination")).hasAttribute("placeholder", "Regex (e.g. user@.*:intern@domain.com)");
        return create();
    }

    public Locator domainHint() {
        return dialog().getByText(Pattern.compile("^Mail addressed to the source domain will be rewritten"));
    }

    public MappingsPage openDomainForm(String source, String destination) {
        openForm("Domain", source, destination);
        assertThat(field("Source")).hasAttribute("placeholder", "Source domain (e.g. sourceDomain.tld)");
        return this;
    }

    /** Confirms the removal asked by the open confirmation ("Remove"), and waits for it to close. */
    public void confirmRemove() {
        dialog().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Remove").setExact(true)).click();
        assertThat(dialog()).isHidden();
    }

    /** The remove action of a row, "Remove Address Mapping from "source" to "destination"". */
    public Locator removeButton(Locator row) {
        return row.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(Pattern.compile("^Remove [\\w ]+ Mapping from \".+\" to \".+\"$")));
    }

    /** "Delete the 3 matching mappings": only shown while the search finds rows. */
    public Locator deleteMatchingButton() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(Pattern.compile("^Delete (the )?\\d+ matching mappings?$")));
    }
}
