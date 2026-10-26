package com.linagora.admin.e2e.mail.userdetail;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.regex.Pattern;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.Ids;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.docker.BrowserLog;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.userdetail.MailUserDetailPage;
import com.linagora.admin.e2e.pages.mail.userdetail.Regex;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

class UserDetailMiscTest extends MailAdminE2ETest {

    @Test
    @DisplayName("UDT-21 User network channels")
    void networkChannels(AdminApp app, MailFixtures fixtures) {
        String user = fixtures.newUser("channels");
        MailUserDetailPage detail = new MailUserDetailPage(app).open(user);

        detail.toggle("Network Channels");
        assertThat(app.main().getByText("No active channels.")).isVisible();
        assertThat(detail.button("Refresh")).hasAttribute("title", "Refresh");
        detail.button("Disconnect all").click();
        assertThat(app.dialog()).containsText("Disconnect channels for " + user);
        detail.confirm("Disconnect all");
        app.expectToast(user + " disconnected");
        assertThat(app.main().getByText("No active channels.")).isVisible();
    }

    @Test
    @DisplayName("UDT-22 Unknown user detail: an address without account")
    void unknownUserDetail(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin, Page page, BrowserLog browserLog) {
        String bob = fixtures.newUser("bob");
        // An account deleted while it still forwarded its mail: the forward outlives it
        String ghost = fixtures.newUser("ghost");
        String local = ghost.substring(0, ghost.indexOf('@'));
        webAdmin.put("/address/forwards/" + ghost + "/targets/" + bob).expect(204);
        webAdmin.delete("/users/" + ghost).expect(204);
        MailUserDetailPage detail = new MailUserDetailPage(app).open(ghost);

        assertThat(detail.kind("Address without account")).isVisible();
        assertThat(app.main().getByRole(AriaRole.ALERT)).containsText("No account named " + ghost + " exists on this server.");
        // Only what applies to a bare address: its forwards and the mappings it is the source of
        assertThat(detail.sectionToggle("Forwards", 1)).isVisible();
        assertThat(detail.sectionToggle("Mappings", 1)).isVisible();
        for (String absent : List.of("Mailboxes", "Quota", "Aliases", "Vacation", "Tasks")) {
            assertThat(detail.sectionToggle(absent)).hasCount(0);
        }
        assertThat(detail.button("Expand all")).hasCount(0);

        // No mailbox to keep a copy in, no new forward (WebAdmin refuses one); the leftover can be removed
        detail.toggle("Forwards");
        assertThat(app.main().getByRole(AriaRole.CHECKBOX)).hasCount(0);
        assertThat(app.main().getByTitle("Add forward")).hasCount(0);
        assertThat(app.main().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName(bob).setExact(true))).isVisible();
        detail.iconButton("Remove forward to \"" + bob + "\"").click();
        detail.confirm("Remove");
        app.expectToast("Forward removed successfully");
        assertThat(app.main().getByText("No forwards configured.")).isVisible();
        assertThat(detail.sectionToggle("Mappings", 0)).isVisible();
        assertThat(webAdmin.get("/address/forwards/" + ghost).body()).doesNotContain(bob);

        app.main().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName("Search the users").setExact(true)).click();
        assertThat(page).hasURL(Pattern.compile("/users\\?q=" + Regex.escape(local) + "$"));
        assertThat(app.main().getByPlaceholder("Search users by name prefix...")).hasValue(local);
        assertThat(app.main().getByText("No username starts with \"" + local + "\".")).isVisible();
        assertThat(browserLog.pageErrors()).isEmpty();
    }

    @Test
    @DisplayName("UDT-27 User detail follows a change of user without reload")
    void followsAChangeOfUser(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin, Page page) {
        String bob = fixtures.newUser("bob");
        String alice = fixtures.newUser("alice");
        webAdmin.put("/users/" + bob + "/mailboxes/BobBox").expect(204);
        webAdmin.put("/users/" + alice + "/mailboxes/AliceBox").expect(204);
        String bobAlias = "bob.alias-" + Ids.suffix(6) + "@" + fixtures.domain();
        String aliceAlias = "alice.alias-" + Ids.suffix(6) + "@" + fixtures.domain();
        webAdmin.put("/address/aliases/" + bob + "/sources/" + bobAlias).expect(204);
        webAdmin.put("/address/aliases/" + alice + "/sources/" + aliceAlias).expect(204);

        MailUserDetailPage detail = new MailUserDetailPage(app).open(bob);
        detail.toggle("Mailboxes").toggle("Quota").toggle("Aliases");
        assertThat(text(app, "BobBox")).isVisible();
        assertThat(text(app, bobAlias)).isVisible();
        assertThat(app.main().getByText("Per user limit")).isVisible();

        List<String> requests = new CopyOnWriteArrayList<>();
        page.onRequest(request -> requests.add(request.url()));
        page.evaluate("path => { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')); }",
            MailUserDetailPage.path(alice));

        assertThat(detail.title()).hasText(alice);
        // The open sections stay open, remembered for every user page, and show alice's data only
        assertThat(detail.sectionToggle("Mailboxes")).hasAttribute("aria-expanded", "true");
        assertThat(text(app, "AliceBox")).isVisible();
        assertThat(text(app, aliceAlias)).isVisible();
        assertThat(app.main().getByText("Per user limit")).isVisible();
        assertThat(text(app, "BobBox")).hasCount(0);
        assertThat(text(app, bobAlias)).hasCount(0);
        assertThat(requests).isNotEmpty()
            .noneMatch(url -> url.contains(WebAdmin.encode(bob)) || url.contains(bob));

        page.goBack();
        assertThat(detail.title()).hasText(bob);
        assertThat(text(app, "BobBox")).isVisible();
        assertThat(text(app, bobAlias)).isVisible();
        assertThat(text(app, "AliceBox")).hasCount(0);
    }

    private static Locator text(AdminApp app, String text) {
        return app.main().getByText(text);
    }
}
