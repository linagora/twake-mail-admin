package com.linagora.admin.e2e.pages.mail.ops;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.util.regex.Pattern;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.AriaRole;

/** Event Dead Letter: search by event ID, the listener groups, and the page of a group. */
public class EventDeadLetterPage {
    public static final String REDELIVER = "Redeliver group events";
    public static final String CLEAR = "Clear group";
    public static final String DELETE_EVENT = "Delete event";

    private final AdminApp app;

    public EventDeadLetterPage(AdminApp app) {
        this.app = app;
    }

    public static EventDeadLetterPage open(AdminApp app) {
        app.open("/event-dead-letter");
        EventDeadLetterPage page = new EventDeadLetterPage(app);
        assertThat(page.eventIdField()).isVisible();
        return page;
    }

    public AdminApp app() {
        return app;
    }

    public Locator eventIdField() {
        return app.main().getByPlaceholder("Enter event ID");
    }

    public Locator groupField() {
        return app.main().getByPlaceholder("Group (optional)");
    }

    public Locator searchButton() {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Search").setExact(true));
    }

    /** The link of a group: {@code "group (count)"}. */
    public Locator groupLink(String group) {
        return app.main().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions()
            .setName(Pattern.compile("^" + Regex.quote(group) + " \\((\\d+|Loading\\.\\.\\.)\\)$")));
    }

    public Locator groupLink(String group, int count) {
        return app.main().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions()
            .setName(group + " (" + count + ")").setExact(true));
    }

    public Locator groupAction(String group, String action) {
        return groupLink(group).locator("xpath=ancestor::div[.//button][1]")
            .getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(action).setExact(true));
    }

    public Locator param(String key) {
        return app.dialog().getByLabel(key + ":", new Locator.GetByLabelOptions().setExact(true));
    }

    public Locator commandPreview() {
        return app.dialog().getByText(Pattern.compile("^Command: "));
    }

    // ---- group page ----

    public Locator groupTitle() {
        return app.main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setName("Event Group Details").setExact(true));
    }

    public Locator paginationLabel() {
        return app.main().getByText(Pattern.compile("^Page \\d+ — \\d+ events per page / Total: \\d+$"));
    }

    /** The line of an event of the group page, by insertion id. */
    public Locator event(String insertionId) {
        return app.main().getByRole(AriaRole.LISTITEM).filter(new Locator.FilterOptions().setHasText(insertionId));
    }

    public Locator deleteEvent(String insertionId) {
        return event(insertionId).getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(DELETE_EVENT).setExact(true));
    }
}
