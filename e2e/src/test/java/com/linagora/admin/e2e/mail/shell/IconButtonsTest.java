package com.linagora.admin.e2e.mail.shell;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.regex.Pattern;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.node.ObjectNode;
import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.shell.Shell;
import com.linagora.admin.e2e.pages.mail.shell.WebAdminStub;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

/** NAV-05: icon-only buttons have an accessible name and a tooltip (the dead letter ones: DegradedStateTest). */
class IconButtonsTest extends MailAdminE2ETest {

    private static Locator sectionToggle(AdminApp app, String title) {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(Pattern.compile("^" + Shell.quote(title) + "( \\(\\d+\\))?$")));
    }

    /** A Radix tooltip button: no title attribute, the tooltip shows on hover. */
    private static void assertNamedWithHoverTooltip(Page page, Locator button, String name) {
        assertThat(button).hasAccessibleName(name);
        button.hover();
        assertThat(page.getByRole(AriaRole.TOOLTIP)).hasText(name);
        page.mouse().move(5, 5, new com.microsoft.playwright.Mouse.MoveOptions().setSteps(5));
        page.mouse().move(10, 10);
        assertThat(page.getByRole(AriaRole.TOOLTIP)).hasCount(0);
    }

    @Test
    @DisplayName("NAV-05 Icon-only buttons have a name and a tooltip (task page)")
    void taskPageIconButtons(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin, Page page) {
        String user = fixtures.newUser("icons");
        String taskId = webAdmin.post("/users/" + user + "/mailboxes?task=reIndex", null).expect(201).json().path("taskId").asText();
        webAdmin.awaitTask(taskId);

        // A completed task: Refresh, and the breadcrumb back to the Tasks list
        app.open("/tasks");
        app.open("/task/" + taskId);
        // Headed by the task as its button reads, and its target
        assertThat(Shell.detailTitle(app, "Reindex all mailboxes — " + user)).isVisible();
        assertThat(app.main().getByText("Completed", new Locator.GetByTextOptions().setExact(true)).first()).isVisible();
        assertNamedWithHoverTooltip(page, app.button("Refresh"), "Refresh");
        assertThat(app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Cancel task"))).hasCount(0);
        assertThat(Shell.unnamedButtons(app.main())).isEmpty();
        Shell.breadcrumb(app, "Tasks").click();
        assertThat(page).hasURL(Pattern.compile("/tasks$"));

        // A running task, as WebAdmin would describe it: the Cancel task button shows up
        WebAdminStub.rewrite(page, webAdmin, path -> path.equals("/tasks/" + taskId), body -> {
            ObjectNode task = (ObjectNode) jsonOf(body);
            task.put("status", "inProgress").putNull("completedDate");
            return task.toString();
        });
        app.open("/task/" + taskId);
        assertThat(app.main().getByText("In Progress", new Locator.GetByTextOptions().setExact(true)).first()).isVisible();
        assertNamedWithHoverTooltip(page, app.button("Cancel task"), "Cancel task");
        assertNamedWithHoverTooltip(page, app.button("Refresh"), "Refresh");
        assertThat(Shell.unnamedButtons(app.main())).isEmpty();
    }

    private static com.fasterxml.jackson.databind.JsonNode jsonOf(String body) {
        try {
            return WebAdmin.JSON.readTree(body);
        } catch (Exception e) {
            throw new IllegalStateException(body, e);
        }
    }

    @Test
    @DisplayName("NAV-05 Icon-only buttons have a name and a tooltip (network channels, metrics, user page, toast)")
    void pagesIconButtons(AdminApp app, MailFixtures fixtures, Page page) {
        String user = fixtures.newUser("icons");

        app.open("/network-channels");
        Shell.assertNamedWithTooltip(app.button("Refresh"), "Refresh");
        assertThat(Shell.unnamedButtons(app.main())).isEmpty();
        app.button("User agent").click();
        assertThat(page).hasURL(Pattern.compile("/user-agent$"));
        Shell.assertNamedWithTooltip(app.button("Refresh"), "Refresh");
        assertThat(Shell.unnamedButtons(app.main())).isEmpty();
        app.button("Back").click();
        app.button("Map").click();
        assertThat(page).hasURL(Pattern.compile("/map$"));
        Shell.assertNamedWithTooltip(app.button("Refresh"), "Refresh");
        assertThat(Shell.unnamedButtons(app.main())).isEmpty();

        // No /metrics route here: the page explains it, with no button left to name
        app.navigate("Live Metrics");
        assertThat(app.main().getByText("Metrics are not available on this server", new Locator.GetByTextOptions().setExact(true))).isVisible();
        assertThat(Shell.unnamedButtons(app.main())).isEmpty();

        app.open("/users/user/" + WebAdmin.encode(user));
        sectionToggle(app, "Network Channels").click();
        Shell.assertNamedWithTooltip(app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Refresh").setExact(true)), "Refresh");

        sectionToggle(app, "Deleted Message Vault").click();
        app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Add criterion").setExact(true)).first().click();
        Shell.assertNamedWithTooltip(app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Remove criterion").setExact(true)).first(),
            "Remove criterion");
        assertThat(app.main().getByRole(AriaRole.COMBOBOX, new Locator.GetByRoleOptions().setName("Field").setExact(true)).first()).isVisible();
        assertThat(app.main().getByRole(AriaRole.COMBOBOX, new Locator.GetByRoleOptions().setName("Operator").setExact(true)).first()).isVisible();

        // Every section open: still no unnamed button
        Shell.openAllSections(page);
        assertThat(Shell.unnamedButtons(app.main())).isEmpty();

        // A toast: its "x" is named "Close"
        app.navigate("Event Dead Letter");
        app.main().getByPlaceholder("Enter event ID").fill("abc");
        app.button("Search").click();
        Locator toast = app.toast("Error searching for event");
        assertThat(toast).isVisible();
        Shell.assertNamedWithTooltip(toast.getByRole(AriaRole.BUTTON), "Close");
        assertThat(Shell.unnamedButtons(app.toasts())).isEmpty();
    }
}
