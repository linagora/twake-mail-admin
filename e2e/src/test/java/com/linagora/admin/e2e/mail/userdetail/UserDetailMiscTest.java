package com.linagora.admin.e2e.mail.userdetail;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.Ids;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.docker.BrowserLog;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.userdetail.MailUserDetailPage;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;

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
        app.confirm();
        app.expectToast(user + " disconnected");
        assertThat(app.main().getByText("No active channels.")).isVisible();
    }

    @Test
    @DisplayName("UDT-22 Unknown user detail")
    void unknownUserDetail(AdminApp app, MailFixtures fixtures, BrowserLog browserLog) {
        String ghost = Ids.unique("ghost") + "@" + fixtures.domain();
        MailUserDetailPage detail = new MailUserDetailPage(app).open(ghost);

        detail.toggle("Mailboxes");
        assertThat(app.main().getByText(java.util.regex.Pattern.compile("^Error: ")).first()).isVisible();
        detail.toggle("Quota");
        detail.toggle("Aliases");
        detail.toggle("Tasks");
        assertThat(app.main().getByText("Reindex all mailboxes", new Locator.GetByTextOptions().setExact(true))).isVisible();
        assertThat(detail.usernameLabel()).hasText("Username: " + ghost);
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

        assertThat(detail.usernameLabel()).hasText("Username: " + alice);
        // Every section collapsed again, as on a fresh load
        assertThat(app.main().getByPlaceholder("Search mailboxes...")).hasCount(0);
        assertThat(app.main().getByText("Per user limit")).hasCount(0);
        assertThat(text(app, "BobBox")).hasCount(0);
        assertThat(text(app, bobAlias)).hasCount(0);

        detail.toggle("Mailboxes").toggle("Aliases");
        assertThat(text(app, "AliceBox")).isVisible();
        assertThat(text(app, aliceAlias)).isVisible();
        assertThat(text(app, "BobBox")).hasCount(0);
        assertThat(requests).isNotEmpty()
            .noneMatch(url -> url.contains(WebAdmin.encode(bob)) || url.contains(bob));

        page.goBack();
        assertThat(detail.usernameLabel()).hasText("Username: " + bob);
        detail.toggle("Mailboxes");
        assertThat(text(app, "BobBox")).isVisible();
        assertThat(text(app, "AliceBox")).hasCount(0);
    }

    private static Locator text(AdminApp app, String text) {
        return app.main().getByText(text);
    }
}
