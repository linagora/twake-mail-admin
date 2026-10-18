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

        // A completed task: Back and Refresh
        app.open("/tasks");
        app.open("/task/" + taskId);
        assertThat(app.main()).containsText(taskId);
        assertThat(app.main()).containsText("\"status\": \"completed\"");
        Shell.assertNamedWithTooltip(app.button("Back"), "Back");
        assertNamedWithHoverTooltip(page, app.button("Refresh"), "Refresh");
        assertThat(app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Cancel"))).hasCount(0);
        assertThat(Shell.unnamedButtons(app.main())).isEmpty();
        app.button("Back").click();
        assertThat(page).hasURL(Pattern.compile("/tasks$"));

        // A running task, as WebAdmin would describe it: the Cancel button shows up
        WebAdminStub.rewrite(page, webAdmin, path -> path.equals("/tasks/" + taskId), body -> {
            ObjectNode task = (ObjectNode) jsonOf(body);
            task.put("status", "inProgress").putNull("completedDate");
            return task.toString();
        });
        app.open("/task/" + taskId);
        assertThat(app.main()).containsText("\"status\": \"inProgress\"");
        assertNamedWithHoverTooltip(page, app.button("Cancel"), "Cancel");
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
        // No Internet in the reference environment: the map library cannot load
        page.route("https://unpkg.com/**", route -> route.abort());

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

        app.navigate("Live Metrics");
        Shell.assertNamedWithTooltip(app.button("Refresh metrics"), "Refresh metrics");
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
        app.navigate("Domains");
        app.main().getByPlaceholder("New domain name").fill("not a domain!");
        app.button("Create").click();
        app.confirm();
        Locator toast = app.toast("Error creating domain");
        assertThat(toast).isVisible();
        Shell.assertNamedWithTooltip(toast.getByRole(AriaRole.BUTTON), "Close");
        assertThat(Shell.unnamedButtons(app.toasts())).isEmpty();
    }
}
