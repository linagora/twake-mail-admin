package com.linagora.admin.e2e.pages.calendar.users;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Download;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;
import com.microsoft.playwright.options.FilePayload;

/**
 * The Calendars or the Address Books section of a user detail page: a collapsible list of DAV
 * collections, each row carrying its name, its counter and its action buttons (named by their
 * tooltip).
 */
public class CollectionSection {
    private static final Pattern TASK_LINK = Pattern.compile("Task ([0-9a-f-]{36})");

    private final AdminApp app;
    private final Locator toggle;
    private final String createTitle;

    CollectionSection(AdminApp app, Locator toggle, String createTitle) {
        this.app = app;
        this.toggle = toggle;
        this.createTitle = createTitle;
    }

    /** The section title, "Calendars (2)". */
    public Locator toggle() {
        return toggle;
    }

    /** The innermost block holding the title and, once expanded, the rows. */
    public Locator root() {
        return app.main().locator("div").filter(new Locator.FilterOptions().setHas(toggle)).last();
    }

    public CollectionSection expand() {
        toggle.click();
        assertThat(createButton()).isVisible();
        return this;
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

    public static Locator rowsIn(Locator scope, String name) {
        return scope.getByText(name, new Locator.GetByTextOptions().setExact(true))
            .locator("xpath=ancestor::div[.//button][1]");
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
        row.locator("input[type=file]").setInputFiles(
            new FilePayload(fileName, mimeType, content.getBytes(StandardCharsets.UTF_8)));
        Locator toast = app.toast("Task created");
        assertThat(toast).isVisible();
        Locator link = toast.getByRole(AriaRole.LINK);
        assertThat(link).hasText(TASK_LINK);
        Matcher matcher = TASK_LINK.matcher(link.textContent());
        if (!matcher.find()) {
            throw new IllegalStateException("No task id in " + link.textContent());
        }
        return matcher.group(1);
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
