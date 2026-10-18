package com.linagora.admin.e2e.pages.calendar.resources;

import java.nio.charset.StandardCharsets;

import com.microsoft.playwright.Download;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;
import com.microsoft.playwright.options.FilePayload;

/**
 * A row of a calendar the domain owns (a resource or a team calendar): event counter, export,
 * import and public visibility controls.
 */
public class DomainCalendarRow {
    private final Page page;
    private final Locator root;
    private final String name;

    DomainCalendarRow(Page page, Locator root, String name) {
        this.page = page;
        this.root = root;
        this.name = name;
    }

    public Locator root() {
        return root;
    }

    public Locator button(String name) {
        return root.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(name).setExact(true));
    }

    /** The event counter ("Events" tooltip). */
    public Locator eventCount() {
        return root.getByTitle("Events", new Locator.GetByTitleOptions().setExact(true));
    }

    public Locator exportButton() {
        return button("Export the calendar (ICS)");
    }

    public Locator importButton() {
        return button("Import events (ICS)");
    }

    public Locator visibilityButton() {
        return button("Change public visibility");
    }

    /** Feeds the hidden file input of the import button, as picking a file would. */
    public void importIcs(String ics) {
        importButton().locator("xpath=preceding-sibling::input[@type='file'][1]")
            .setInputFiles(new FilePayload("events.ics", "text/calendar", ics.getBytes(StandardCharsets.UTF_8)));
    }

    public Download export() {
        return page.waitForDownload(() -> exportButton().click());
    }

    public PublicVisibilityDialog openVisibility() {
        visibilityButton().click();
        return new PublicVisibilityDialog(page, name);
    }
}
