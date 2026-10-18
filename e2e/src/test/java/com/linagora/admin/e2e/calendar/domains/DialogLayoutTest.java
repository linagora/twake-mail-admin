package com.linagora.admin.e2e.calendar.domains;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.linagora.admin.e2e.CalendarAdminE2ETest;
import com.linagora.admin.e2e.backend.CalendarFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.calendar.domains.CalendarDomainPage;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

class DialogLayoutTest extends CalendarAdminE2ETest {

    @Test
    @DisplayName("X-02 Long unbreakable words stay inside dialogs")
    void longUnbreakableWordsStayInsideDialogs(Page page, CalendarFixtures fixtures, WebAdmin webAdmin) {
        String user = fixtures.newRegisteredUser("longname");
        String name = "QA" + "x".repeat(118);
        webAdmin.post("/users/" + user + "/calendars", "{\"dav:name\":\"" + name + "\"}").expect(201);
        AdminApp app = new AdminApp(page);

        for (int[] size : new int[][] {{1280, 800}, {390, 844}}) {
            page.setViewportSize(size[0], size[1]);
            page.navigate("/users/user/" + WebAdmin.encode(user));
            CalendarDomainPage.sectionToggle(app.main(), "Calendars").click();
            assertThat(app.main().getByText(name, new Locator.GetByTextOptions().setExact(true))).isVisible();

            deleteButton(app, name).click();
            Locator dialog = app.dialog();
            assertThat(dialog).containsText("Do you really want to delete the calendar \"" + name + "\"?");
            assertThat((Boolean) dialog.evaluate("d => d.scrollWidth <= d.clientWidth")).as("width %d", size[0]).isTrue();
            for (String button : new String[] {"Cancel", "Confirm"}) {
                Locator locator = dialog.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(button).setExact(true));
                assertThat((Boolean) locator.evaluate("(b) => { const r = b.getBoundingClientRect();"
                    + " const d = b.closest('[role=dialog]').getBoundingClientRect();"
                    + " return r.left >= d.left && r.right <= d.right && r.left >= 0 && r.right <= window.innerWidth; }"))
                    .as("%s at width %d", button, size[0]).isTrue();
            }
            app.cancel();
        }

        deleteButton(app, name).click();
        app.confirm();
        app.expectToast("Calendar deleted");
        assertThat(webAdmin.get("/users/" + user + "/calendars").expect(200).body()).doesNotContain(name);
    }

    /** "Delete calendar" of the row of the calendar named {@code name}. */
    private static Locator deleteButton(AdminApp app, String name) {
        return app.main().getByText(name, new Locator.GetByTextOptions().setExact(true)).locator("xpath=ancestor::div[3]")
            .getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Delete calendar").setExact(true));
    }
}
