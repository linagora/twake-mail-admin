package com.linagora.admin.e2e.mail.userdetail;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.regex.Pattern;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.userdetail.Regex;
import com.linagora.admin.e2e.pages.mail.userdetail.MailUserDetailPage;
import com.linagora.admin.e2e.pages.mail.userdetail.MessageSearchPage;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Request;

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
        // tmail-backend of this environment has no POST /users/{user}/mails: the page shows its message
        assertThat(app.main().getByText(Pattern.compile("POST " + Regex.escape(MessageSearchPage.searchPath(user))
            + " can not be found"))).isVisible();

        search.filtersToggle().click();
        search.filter("Subject").fill("Lunch");
        assertThat(searchRequest(page, search).postData()).contains("\"subject\":\"Lunch\"");
        search.filter("Subject").fill("");
        search.filter("From").fill("alice@example.com");
        String fromBody = searchRequest(page, search).postData();
        assertThat(fromBody).contains("\"from\":\"alice@example.com\"").doesNotContain("\"subject\"");

        search.addSort().click();
        assertThat(search.sortFields()).hasCount(2);
        search.sortFields().nth(1).selectOption("subject");
        search.sortDirections().nth(1).selectOption("asc");
        assertThat(searchRequest(page, search).postData())
            .contains("{\"property\":\"subject\",\"isAscending\":true}");

        search.backLink(user).click();
        assertThat(detail.usernameLabel()).hasText("Username: " + user);
    }

    private static Request searchRequest(Page page, MessageSearchPage search) {
        return page.waitForRequest(
            request -> request.method().equals("POST") && request.url().contains("/mails"),
            () -> search.searchButton().click());
    }
}
