package com.linagora.admin.e2e.mail.shell;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.regex.Pattern;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.Ids;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.docker.MailStack;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.domains.DomainsPage;
import com.linagora.admin.e2e.pages.mail.shell.WebAdminAuth;
import com.linagora.admin.e2e.pages.mail.users.UsersListPage;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.Cookie;

/**
 * Sign in without SSO: the app reaches WebAdmin with a static JWT, prompted for on the first 401.
 * The WebAdmin of the stack has no authentication: it is made to require a token for the browser
 * of the test only ({@link WebAdminAuth#requireToken}), the other tests keep an open WebAdmin.
 */
class SignInTest extends MailAdminE2ETest {

    @Test
    @DisplayName("NAV-11 Sign in with a Bearer token when WebAdmin answers 401")
    void signInWithBearerToken(AdminApp app, Page page, BrowserContext context, MailFixtures fixtures) {
        String domain = fixtures.domain();
        String user = fixtures.newUser("signin");
        String token = Ids.unique("token");
        List<String> authorizations = WebAdminAuth.requireToken(context, token);

        app.open("/domains");
        Locator dialog = WebAdminAuth.dialog(page);
        assertThat(dialog).isVisible();
        assertThat(dialog).containsText("Please enter your Bearer token to continue accessing the API.");
        assertThat(WebAdminAuth.tokenField(page)).isVisible();
        DomainsPage domains = new DomainsPage(app);
        assertThat(domains.rowHeadings()).hasCount(0);

        WebAdminAuth.authenticate(page, token);
        assertThat(dialog).isHidden();
        // The call answered 401 is replayed with the token: the list fills in without a reload
        domains.search(domain);
        assertThat(domains.domainLink(domain)).isVisible();
        assertThat(WebAdminAuth.storedToken(context)).isEqualTo(token);

        // Kept across a reload, sent on every call, never prompted for again
        authorizations.clear();
        page.reload();
        assertThat(domains.searchInput()).isVisible();
        app.navigate("Users");
        UsersListPage users = new UsersListPage(app);
        users.search().fill(user);
        users.userLink(user).click();
        assertThat(app.main().getByText("Username: " + user, new Locator.GetByTextOptions().setExact(true))).isVisible();
        assertThat(dialog).hasCount(0);
        assertThat(authorizations).isNotEmpty().allMatch(("Bearer " + token)::equals);
    }

    @Test
    @DisplayName("NAV-11 A rejected token prompts again and is forgotten")
    void rejectedTokenPromptsAgain(AdminApp app, Page page, BrowserContext context, MailStack stack) {
        WebAdminAuth.requireToken(context, Ids.unique("token"));
        context.addCookies(List.of(new Cookie(WebAdminAuth.COOKIE, "revoked").setUrl(stack.adminUrl())));

        app.open("/domains");
        Locator dialog = WebAdminAuth.dialog(page);
        assertThat(dialog).isVisible();
        // The rejected token is dropped as soon as WebAdmin refuses it
        assertThat(WebAdminAuth.storedToken(context)).isNull();

        WebAdminAuth.button(page, "Cancel").click();
        assertThat(dialog).isHidden();
        assertThat(WebAdminAuth.storedToken(context)).isNull();
        // The refusal of WebAdmin shows up, not a blank page
        assertThat(app.main().getByText(Pattern.compile("^Error: "))).isVisible();
    }
}
