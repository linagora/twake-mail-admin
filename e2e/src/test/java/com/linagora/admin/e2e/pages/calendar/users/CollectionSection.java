package com.linagora.admin.e2e.pages.calendar.users;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Pattern;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Download;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Response;
import com.microsoft.playwright.options.AriaRole;
import com.microsoft.playwright.options.FilePayload;

/**
 * The Calendars or the Address Books section of a user detail page: a collapsible list of DAV
 * collections, each row carrying its name, its counter and its action buttons (named by their
 * tooltip).
 */
public class CollectionSection {

    private static final double IMPORT_TIMEOUT_MS = 60_000;

    private final AdminApp app;
    private final Locator toggle;
    private final String createTitle;
    private final int depth;

    /** {@code depth}: how many blocks up from the toggle the section block is. */
    CollectionSection(AdminApp app, Locator toggle, String createTitle, int depth) {
        this.app = app;
        this.toggle = toggle;
        this.createTitle = createTitle;
        this.depth = depth;
    }

    /** The section title, "Calendars (2)". */
    public Locator toggle() {
        return toggle;
    }

    /** The block of the section: its title and, once expanded, the rows. */
    public Locator root() {
        return toggle.locator("xpath=ancestor::div[" + depth + "]");
    }

    /** Opens the section if it is collapsed: its open state is remembered across pages and reloads. */
    public CollectionSection expand() {
        if (!isExpanded()) {
            toggle.click();
        }
        assertThat(toggle).hasAttribute("aria-expanded", "true");
        assertThat(createButton()).isVisible();
        return this;
    }

    public CollectionSection collapse() {
        if (isExpanded()) {
            toggle.click();
        }
        assertThat(toggle).hasAttribute("aria-expanded", "false");
        return this;
    }

    private boolean isExpanded() {
        return "true".equals(toggle.getAttribute("aria-expanded"));
    }

    /** The rows, shown while the section is expanded. */
    public Locator content() {
        return root().locator("[id$='-content']");
    }

    public Locator createButton() {
        return button(root(), createTitle);
    }

    /** Asserts the count shown in the title once the list is loaded. */
    public CollectionSection expectCount(int count) {
        assertThat(toggle).hasText(Pattern.compile("\\(" + count + "\\)$"));
        return this;
    }

    /** Every row named {@code name}: the innermost block around the name that holds buttons. */
    public Locator rows(String name) {
        return rowsIn(root(), name);
    }

    public Locator row(String name) {
        return rows(name).first();
    }

    /** The row named {@code name} shared by (or delegated from) {@code owner}. */
    public Locator rowOwnedBy(String name, String owner) {
        return rows(name).filter(new Locator.FilterOptions().setHas(ownerLink(owner)));
    }

    public Locator ownerLink(String owner) {
        return app.page().getByRole(AriaRole.LINK, new Page.GetByRoleOptions().setName(owner).setExact(true));
    }

    /** The group of calendars of a category, "Owner", "Delegated"... */
    public Locator group(String category) {
        // heading > its title bar > the group block holding the rows
        return groupHeading(category).locator("xpath=../..");
    }

    /** The heading of a group, "Owner (1)". */
    public Locator groupHeading(String category) {
        return root().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setName(groupName(category)));
    }

    private static Pattern groupName(String category) {
        return Pattern.compile("^" + JsRegex.quote(category) + " ?\\(\\d+\\)$");
    }

    public Locator rowInGroup(String category, String name) {
        return rowsIn(group(category), name).first();
    }

    /** The innermost block around the name holding an action button (not only the "Shared with" chip next to the name). */
    public static Locator rowsIn(Locator scope, String name) {
        return scope.getByText(name, new Locator.GetByTextOptions().setExact(true))
            .locator("xpath=ancestor::div[.//button[not(starts-with(normalize-space(.), 'Shared with'))]][1]");
    }

    /** The "Shared with n" chip of a row, listing the sharees on hover and opening the sharing dialog. */
    public static Locator sharedWith(Locator row) {
        return row.getByText(Pattern.compile("^Shared with \\d+$"));
    }

    /** Confirms the destructive confirmation dialog open, by its verb ("Delete"), and waits for it to close. */
    public static void confirmWith(AdminApp app, String verb) {
        button(app.dialog(), verb).click();
        assertThat(app.dialog()).isHidden();
    }

    public static Locator button(Locator scope, String title) {
        return scope.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(title).setExact(true));
    }

    /** The counter of a row (events or contacts), named by its tooltip. */
    public static Locator counter(Locator row, String title) {
        return row.getByTitle(title, new Locator.GetByTitleOptions().setExact(true));
    }

    /**
     * Feeds the hidden file input of the row's import button, as picking a file would, and
     * returns the id of the task announced by the "Task created" toast.
     */
    public String importFile(Locator row, String fileName, String mimeType, String content) {
        // The toast only shows once WebAdmin answered the upload, which can take more than the default
        // 5 seconds of an assertion on a loaded CI agent: wait for the answer itself
        Response response = app.page().waitForResponse(
            r -> r.request().method().equals("POST") && r.url().contains("?action=import"),
            new Page.WaitForResponseOptions().setTimeout(IMPORT_TIMEOUT_MS),
            () -> row.locator("input[type=file]").setInputFiles(
                new FilePayload(fileName, mimeType, content.getBytes(StandardCharsets.UTF_8))));
        if (!response.ok()) {
            throw new AssertionError("Import refused: " + response.status() + " " + response.text());
        }
        Locator toast = app.toast("Task created");
        assertThat(toast).isVisible();
        Locator link = toast.getByRole(AriaRole.LINK);
        assertThat(link).hasText(AdminApp.TASK_TOAST_LINK);
        return AdminApp.taskIdOf(link);
    }

    public record Exported(String fileName, String content) {
    }

    /** Clicks an export button and reads the downloaded file. */
    public Exported export(Locator exportButton) {
        Download download = app.page().waitForDownload(exportButton::click);
        try {
            Path path = download.path();
            return new Exported(download.suggestedFilename(), Files.readString(path, StandardCharsets.UTF_8));
        } catch (java.io.IOException e) {
            throw new IllegalStateException(e);
        }
    }
}
