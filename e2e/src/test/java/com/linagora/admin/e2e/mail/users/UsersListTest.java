package com.linagora.admin.e2e.mail.users;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.IntStream;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.Ids;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.users.UserDetailPage;
import com.linagora.admin.e2e.pages.mail.users.UsersListPage;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

/**
 * The Users list lists every user of the server, which other tests keep creating: assertions
 * target users with a unique prefix, or the test restricts the list to its own domain.
 */
class UsersListTest extends MailAdminE2ETest {

    private static String createUser(WebAdmin webAdmin, String username) {
        webAdmin.put("/users/" + username, "{\"password\":\"" + MailFixtures.PASSWORD + "\"}").expect(204);
        return username;
    }

    @Test
    @DisplayName("USR-01 User list: prefix search")
    void prefixSearch(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin) {
        String tag = "q" + Ids.suffix(7);
        String domain = fixtures.domain();
        String bob = createUser(webAdmin, tag + "bob@" + domain);
        String brian = createUser(webAdmin, tag + "brian@" + domain);
        createUser(webAdmin, tag + "alice@" + domain);

        UsersListPage users = UsersListPage.open(app);
        assertThat(users.search()).hasAttribute("title", "Matches the beginning of the username");
        assertThat(users.row(1)).isVisible();

        users.search().fill(tag + "b");
        assertThat(users.userLinks()).hasText(new String[] {bob, brian});

        users.search().fill(tag + "br");
        assertThat(users.userLinks()).hasText(new String[] {brian});

        // A substring that is not a prefix of any username
        String notAPrefix = tag.substring(1) + "bob";
        users.search().fill(notAPrefix);
        assertThat(users.message("No username starts with \"" + notAPrefix + "\".")).isVisible();
        assertThat(users.userLinks()).hasCount(0);

        users.search().clear();
        assertThat(users.row(3)).isVisible();
        assertThat(users.message("No username starts with \"" + notAPrefix + "\".")).hasCount(0);
    }

    @Test
    @DisplayName("USR-02 User list: domain filter")
    void domainFilter(AdminApp app, WebAdmin webAdmin, Page page) {
        String tag = "o" + Ids.suffix(7);
        String domainA = tag + "-a.e2e.test";
        String domainB = tag + "-b.e2e.test";
        String emptyDomain = tag + "-c.e2e.test";
        for (String domain : List.of(domainB, emptyDomain, domainA)) {
            webAdmin.put("/domains/" + domain).expect(204);
        }
        String olivia = createUser(webAdmin, "olivia@" + domainA);
        String oscar = createUser(webAdmin, "oscar@" + domainA);
        createUser(webAdmin, "bob@" + domainB);

        UsersListPage users = UsersListPage.open(app);
        Locator options = users.domainSelect().locator("option");
        assertThat(options.first()).hasText("All domains");
        List<String> domains = options.allInnerTexts();
        assertThat(domains.indexOf(domainA)).isPositive()
            .isLessThan(domains.indexOf(domainB));
        assertThat(domains.indexOf(domainB)).isLessThan(domains.indexOf(emptyDomain));
        Object sorted = users.domainSelect().evaluate("select => [...select.options].slice(1).map(o => o.text)"
            + ".every((name, i, all) => i === 0 || all[i - 1].localeCompare(name) <= 0)");
        assertThat(sorted).isEqualTo(true);

        users.selectDomain(domainA);
        assertThat(users.userLinks()).hasText(new String[] {olivia, oscar});

        users.search().fill("o");
        assertThat(users.userLinks()).hasText(new String[] {olivia, oscar});

        users.search().clear();
        users.selectAllDomains();
        assertThat(users.domainSelect()).hasValue("");
        assertThat(users.row(3)).isVisible();

        users.selectDomain(emptyDomain);
        assertThat(users.message("No users found.")).isVisible();
        assertThat(users.userLinks()).hasCount(0);
        assertThat(app.main().getByText(Pattern.compile("^Error:"))).hasCount(0);
    }

    @Test
    @DisplayName("USR-03 User list: server-side pagination")
    void serverSidePagination(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin) {
        String domain = fixtures.domain();
        String otherDomain = fixtures.newDomain();
        List<String> expected = IntStream.rangeClosed(1, 55)
            .mapToObj(i -> String.format("qa%02d@%s", i, domain))
            .toList();
        expected.parallelStream().forEach(username -> createUser(webAdmin, username));

        UsersListPage users = UsersListPage.open(app).selectDomain(domain);
        assertThat(users.pageLabel()).hasText("Page 1");
        assertThat(users.rows()).hasCount(50);
        assertThat(users.row(1)).hasText("1/" + expected.get(0));
        assertThat(users.row(50)).hasText("50/" + expected.get(49));
        assertThat(users.first()).isDisabled();
        assertThat(users.previous()).isDisabled();
        assertThat(users.next()).isEnabled();
        List<String> firstPage = users.listedUsernames();

        users.next().click();
        assertThat(users.pageLabel()).hasText("Page 2");
        assertThat(users.rows()).hasCount(5);
        assertThat(users.row(51)).hasText("51/" + expected.get(50));
        assertThat(users.next()).isDisabled();
        List<String> secondPage = users.listedUsernames();

        List<String> all = new ArrayList<>(firstPage);
        all.addAll(secondPage);
        assertThat(all).containsExactlyElementsOf(expected);
        assertThat(new HashSet<>(all)).hasSize(55);

        users.previous().click();
        assertThat(users.pageLabel()).hasText("Page 1");
        assertThat(users.row(1)).hasText("1/" + expected.get(0));
        assertThat(users.userLinks()).hasText(firstPage.toArray(String[]::new));
        assertThat(users.first()).isDisabled();

        users.next().click();
        assertThat(users.pageLabel()).hasText("Page 2");
        users.first().click();
        assertThat(users.pageLabel()).hasText("Page 1");
        assertThat(users.userLinks()).hasText(firstPage.toArray(String[]::new));

        // Searching from page 2 restarts from the first page, everything fits on it
        users.next().click();
        assertThat(users.pageLabel()).hasText("Page 2");
        users.search().fill("qa5");
        assertThat(users.userLinks()).hasText(expected.subList(49, 55).toArray(String[]::new));
        assertThat(users.row(1)).hasText("1/" + expected.get(49));
        assertThat(users.pageLabel()).hasCount(0);
        assertThat(users.next()).hasCount(0);

        // Back to the unfiltered list: page 1, not the page 2 visited before
        users.search().clear();
        assertThat(users.pageLabel()).hasText("Page 1");
        assertThat(users.row(1)).hasText("1/" + expected.get(0));

        users.next().click();
        assertThat(users.pageLabel()).hasText("Page 2");
        users.selectDomain(otherDomain);
        assertThat(users.message("No users found.")).isVisible();
        users.selectDomain(domain);
        assertThat(users.pageLabel()).hasText("Page 1");
        assertThat(users.row(1)).hasText("1/" + expected.get(0));
        assertThat(users.rows()).hasCount(50);
    }

    @Test
    @DisplayName("USR-04 Open a user from the list")
    void openUserFromList(AdminApp app, MailFixtures fixtures, Page page) {
        String bob = fixtures.newUser("bob");

        UsersListPage.open(app).selectDomain(fixtures.domain()).userLink(bob).click();

        assertThat(page).hasURL(Pattern.compile("/users/user/" + WebAdmin.encode(bob).replace(".", "\\.") + "$"));
        UserDetailPage detail = new UserDetailPage(app, bob);
        assertThat(detail.title()).isVisible();
        assertThat(detail.card().getByText("Username: " + bob, new Locator.GetByTextOptions().setExact(true))).isVisible();

        assertThat(detail.toggle("Mailboxes", 0)).isVisible();
        assertThat(detail.section("Mailboxes").getByRole(AriaRole.LINK,
            new Locator.GetByRoleOptions().setName("Search messages").setExact(true))).isVisible();
        assertThat(detail.toggle("Aliases", 0)).isVisible();
        assertThat(detail.toggle("Forwards", 0)).isVisible();
        assertThat(detail.toggle("Mappings", 0)).isVisible();
        assertThat(detail.toggle("Team Mailboxes", 0)).isVisible();
        assertThat(detail.toggle("Delegated Users", 0)).isVisible();
        assertThat(detail.toggle("Allowed From Headers", 1)).isVisible();
        assertThat(detail.toggle("JMAP Identities", 1)).isVisible();
        assertThat(detail.toggle("Labels", 0)).isVisible();
        for (String title : List.of("Quota", "Vacation", "JMAP Settings", "Rate Limiting",
            "Deleted Message Vault", "Tasks", "Network Channels")) {
            assertThat(detail.toggle(title)).isVisible();
        }
        assertThat(detail.card().locator(":scope > div")).hasCount(16);

        Pattern createUser = Pattern.compile("(create|add|new|register) user", Pattern.CASE_INSENSITIVE);
        assertThat(page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName(createUser))).hasCount(0);
        assertThat(page.getByRole(AriaRole.LINK, new Page.GetByRoleOptions().setName(createUser))).hasCount(0);
    }
}
