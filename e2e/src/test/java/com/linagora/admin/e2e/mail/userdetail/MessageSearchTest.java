package com.linagora.admin.e2e.mail.userdetail;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.regex.Pattern;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.userdetail.MailUserDetailPage;
import com.linagora.admin.e2e.pages.mail.userdetail.MessageSearchPage;
import com.linagora.admin.e2e.pages.mail.userdetail.Regex;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Request;
import com.microsoft.playwright.options.AriaRole;

class MessageSearchTest extends MailAdminE2ETest {

    @Test
    @DisplayName("UDT-16 Message search")
    void messageSearch(AdminApp app, MailFixtures fixtures, Page page) {
        String user = fixtures.newUser("search");
        MailUserDetailPage detail = new MailUserDetailPage(app).open(user);

        detail.searchMessagesLink().click();
        MessageSearchPage search = new MessageSearchPage(app);
        assertThat(page).hasURL(Pattern.compile(Regex.escape(MessageSearchPage.path(user)) + "$"));
        assertThat(search.title()).isVisible();
        assertThat(search.searchButton()).isDisabled();

        search.reason().fill("QA check");
        assertThat(search.searchButton()).isEnabled();
        Request first = searchRequest(page, search);
        assertThat(first.postData()).contains("\"reason\":\"QA check\"")
            .contains("{\"property\":\"receivedAt\",\"isAscending\":false}");

        // tmail-backend of this environment has no POST /users/{user}/mails: the page says so instead of the form
        assertThat(unavailable(app)).isVisible();
        assertThat(unavailable(app)).containsText("This server does not expose the message search route (POST /users/{user}/mails).");
        assertThat(app.main()).not().containsText("can not be found");
        assertThat(search.searchButton()).hasCount(0);
        assertThat(search.reason()).hasCount(0);

        // Remembered for the browser session: the page opens directly on the box
        page.reload();
        assertThat(search.title()).isVisible();
        assertThat(unavailable(app)).isVisible();
        assertThat(search.searchButton()).hasCount(0);

        // ...and the magnifier next to "Mailboxes" is disabled
        search.backLink(user).click();
        assertThat(detail.title()).hasText(user);
        assertThat(detail.searchMessagesLink()).hasCount(0);
        assertThat(app.main().getByRole(AriaRole.BUTTON,
            new Locator.GetByRoleOptions().setName("Search messages").setExact(true))).isDisabled();
    }

    private static Locator unavailable(AdminApp app) {
        return app.main().getByRole(AriaRole.STATUS)
            .filter(new Locator.FilterOptions().setHasText("Message search is not available on this server"));
    }

    private static Request searchRequest(Page page, MessageSearchPage search) {
        return page.waitForRequest(
            request -> request.method().equals("POST") && request.url().contains("/mails"),
            () -> search.searchButton().click());
    }
}
