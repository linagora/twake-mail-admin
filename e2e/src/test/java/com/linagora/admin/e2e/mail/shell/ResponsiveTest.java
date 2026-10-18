package com.linagora.admin.e2e.mail.shell;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.regex.Pattern;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.Ids;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.shell.Shell;
import com.linagora.admin.e2e.pages.mail.shell.WebAdminStub;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;
import com.microsoft.playwright.options.BoundingBox;
import com.microsoft.playwright.options.LoadState;

class ResponsiveTest extends MailAdminE2ETest {
    private static final int PHONE = 390;
    private static final List<String> LIST_PAGES = List.of("/domains", "/mappings", "/users", "/mailing-lists", "/global-quota");
    private static final List<String> OTHER_LIST_PAGES = List.of("/tasks", "/common-tasks", "/cassandra", "/mail-repositories",
        "/network-channels", "/live-metrics", "/event-dead-letter");

    private static Locator sectionToggle(AdminApp app, String title) {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(Pattern.compile("^" + Shell.quote(title) + "( \\(\\d+\\))?$")));
    }

    /** Opens a route below 768 px (the sidebar is a closed sheet there) once its data is loaded. */
    private static void openOnPhone(Page page, String route) {
        page.navigate(route);
        assertThat(page.locator("main").getByRole(AriaRole.HEADING).first()).isVisible();
        page.waitForLoadState(LoadState.NETWORKIDLE);
    }

    private static void assertFitsPhone(Page page, String what) {
        assertThat(Shell.scrollWidth(page)).as("scrollWidth of " + what).isLessThanOrEqualTo(PHONE);
    }

    /** The element is shown within the 390 px viewport, without horizontal scrolling. */
    private static void assertWithinViewport(Locator locator, String what) {
        assertThat(locator).isVisible();
        BoundingBox box = locator.boundingBox();
        assertThat(box.x).as(what + " left").isGreaterThanOrEqualTo(0);
        assertThat(box.x + box.width).as(what + " right").isLessThanOrEqualTo(PHONE + 0.5);
    }

    @Test
    @DisplayName("NAV-06 List pages fit a phone screen")
    void listPagesFitPhone(AdminApp app, MailFixtures fixtures, Page page) {
        String domain = fixtures.domain();
        page.setViewportSize(PHONE, 800);

        for (String route : LIST_PAGES) {
            openOnPhone(page, route);
            assertFitsPhone(page, route);
        }

        openOnPhone(page, "/domains");
        assertWithinViewport(app.button("Import"), "Import");
        app.main().getByPlaceholder(Pattern.compile("^Search")).fill(domain);
        Locator row = app.main().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName(domain).setExact(true));
        assertThat(row).isVisible();
        assertWithinViewport(app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Delete Domain")).first(), "Delete Domain");
        for (String pagination : List.of("First", "Previous", "Next", "Last")) {
            Locator button = app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(pagination).setExact(true));
            if (button.count() > 0) {
                assertWithinViewport(button.first(), pagination);
            }
        }
        assertFitsPhone(page, "/domains filtered");
    }

    @Test
    @DisplayName("NAV-06 List pages fit a phone screen (tasks and server pages)")
    void otherListPagesFitPhone(AdminApp app, Page page) {
        // The channel list is server wide: the empty state of the reference environment, see networkChannelsWithSessionsFitPhone
        WebAdminStub.answer(page, path -> path.equals("/servers/channels"), "[]");
        page.setViewportSize(PHONE, 800);
        for (String route : OTHER_LIST_PAGES) {
            openOnPhone(page, route);
            assertFitsPhone(page, route);
        }

        openOnPhone(page, "/tasks");
        assertWithinViewport(app.main().getByText("Submitted:").filter(new Locator.FilterOptions().setVisible(true)).first(), "Submitted:");
        assertFitsPhone(page, "/tasks");
    }

    // known-bug: with active channels, the Network Channels grid (10 fixed columns, header included) and its
    // action bar (User agent / Map / Refresh / Disconnect all) are wider than a 390 px screen: the page scrolls horizontally
    @Test
    @Tag("known-bug")
    @DisplayName("NAV-06 Network channels with sessions fit a phone screen")
    void networkChannelsWithSessionsFitPhone(AdminApp app, Page page) {
        WebAdminStub.answer(page, path -> path.equals("/servers/channels"), "[{\"protocol\":\"IMAP\",\"endpoint\":\"0.0.0.0:143\","
            + "\"remoteAddress\":\"172.18.0.1:51234\",\"connectionDate\":\"2026-10-18T19:00:00Z\",\"isActive\":true,\"isOpen\":true,"
            + "\"isWritable\":true,\"isEncrypted\":true,\"username\":\"alice@example.com\",\"protocolSpecificInformation\":"
            + "{\"userAgent\":\"Thunderbird\",\"requestCount\":\"12\",\"cumulativeWrittenBytes\":\"2048\",\"cumulativeReadBytes\":\"512\","
            + "\"liveReadThroughputBytePerSecond\":\"0\",\"liveWriteThroughputBytePerSecond\":\"0\"}}]");
        page.setViewportSize(PHONE, 800);
        openOnPhone(page, "/network-channels");
        assertThat(app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("alice@example.com"))).isVisible();

        assertWithinViewport(app.button("User agent"), "User agent");
        assertWithinViewport(app.button("Disconnect all"), "Disconnect all");
        assertFitsPhone(page, "/network-channels with a session");
    }

    @Test
    @DisplayName("NAV-06 Detail pages fit a phone screen")
    void detailPagesFitPhone(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin, Page page) {
        String domain = fixtures.domain();
        String user = fixtures.newUser(Ids.unique("a-rather-long-local-part-for-a-phone-screen"));
        webAdmin.put("/users/" + user + "/mailboxes/INBOX").expect(204);
        String teamMailbox = Ids.unique("team");
        webAdmin.put("/domains/" + domain + "/team-mailboxes/" + teamMailbox).expect(204);
        page.setViewportSize(PHONE, 800);

        openOnPhone(page, "/users/user/" + WebAdmin.encode(user));
        assertThat(app.main()).containsText("Username: " + user);
        assertThat(Shell.openAllSections(page)).isGreaterThan(10);
        page.waitForLoadState(LoadState.NETWORKIDLE);
        assertFitsPhone(page, "user detail");

        openOnPhone(page, "/domains/domain/" + domain);
        assertThat(app.main()).containsText("Domain: " + domain);
        Shell.openAllSections(page);
        page.waitForLoadState(LoadState.NETWORKIDLE);
        assertFitsPhone(page, "domain detail");

        openOnPhone(page, "/domains/domain/" + domain + "/team-mailbox/" + teamMailbox);
        assertThat(app.main()).containsText(teamMailbox);
        Shell.openAllSections(page);
        page.waitForLoadState(LoadState.NETWORKIDLE);
        assertFitsPhone(page, "team mailbox detail");
    }

    @Test
    @DisplayName("NAV-08 Confirmation dialogs wrap long words (delete a long identity)")
    void deleteIdentityDialogWrapsLongWords(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin, Page page) {
        String user = fixtures.newUser("wrap");
        String longName = "A".repeat(150);

        app.open("/users/user/" + WebAdmin.encode(user));
        sectionToggle(app, "JMAP Identities").click();
        app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Create identity").setExact(true)).click();
        app.main().getByLabel("Name", new Locator.GetByLabelOptions().setExact(true)).fill(longName);
        app.main().getByLabel("Email", new Locator.GetByLabelOptions().setExact(true)).fill(user);
        app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Create").setExact(true)).click();
        app.expectToast("Identity created");
        Locator identity = app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(longName + " <" + user + ">").setExact(true));
        assertThat(identity).isVisible();
        assertThat(Shell.scrollWidth(page)).as("user page width").isLessThanOrEqualTo(1280);

        for (int width : new int[] {1280, PHONE}) {
            page.setViewportSize(width, 800);
            assertThat(Shell.scrollWidth(page)).as("user page width at " + width).isLessThanOrEqualTo(width);
            app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Delete identity").setExact(true)).click();
            assertThat(app.dialog()).containsText("Delete identity \"" + longName + " <" + user + ">\"?");
            Shell.assertDialogFits(page, app.dialog(), "Cancel", "Confirm");
            // Clickable with the mouse: a click on Cancel lands on it
            app.cancel();
            assertThat(identity).isVisible();
        }
        assertThat(webAdmin.get("/users/" + user + "/identities").body()).contains(longName);
    }
}
