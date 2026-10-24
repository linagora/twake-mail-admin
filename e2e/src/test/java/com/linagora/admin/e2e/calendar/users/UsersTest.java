package com.linagora.admin.e2e.calendar.users;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;
import java.util.stream.IntStream;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;

import com.fasterxml.jackson.databind.JsonNode;
import com.linagora.admin.e2e.CalendarAdminE2ETest;
import com.linagora.admin.e2e.backend.CalendarFixtures;
import com.linagora.admin.e2e.backend.Ids;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.docker.Locks;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.calendar.users.CollectionSection;
import com.linagora.admin.e2e.pages.calendar.users.JsRegex;
import com.linagora.admin.e2e.pages.calendar.users.UserDetailPage;
import com.linagora.admin.e2e.pages.calendar.users.UsersListPage;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;
import com.microsoft.playwright.options.SelectOption;

// Server wide tasks (archival of every user...) add calendars to every user: counts would move.
@ResourceLock(value = Locks.CALENDAR_SERVER_TASKS, mode = ResourceAccessMode.READ)
class UsersTest extends CalendarAdminE2ETest {

    @Test
    @DisplayName("USR-01 User list, prefix search and domain filter")
    void userListPrefixSearchAndDomainFilter(AdminApp app, Page page, CalendarFixtures fixtures) {
        String base = Ids.unique("c3usr");
        String charlie = fixtures.newUnregisteredUser(base + "-ch");
        String alice = fixtures.newUnregisteredUser(base + "-al");
        String otherDomain = fixtures.newDomain("c3usr");
        UsersListPage list = new UsersListPage(app).open();

        list.searchFor(base);
        assertThat(list.userLinks()).hasText(new String[] {alice, charlie});
        // The search lives in the URL
        assertThat(page).hasURL(Pattern.compile("/users\\?q=" + JsRegex.quote(base) + "$"));

        list.searchFor(base + "-ch");
        assertThat(list.userLinks()).hasText(new String[] {charlie});

        // Prefix match only: the end of a username matches nothing
        String inner = alice.substring(base.length() + 1, alice.indexOf('@'));
        list.searchFor(inner);
        assertThat(list.noMatch(inner)).isVisible();
        assertThat(list.userLinks()).hasCount(0);

        list.searchFor("");
        assertThat(list.noMatch(inner)).isHidden();
        assertThat(list.userLinks().first()).isVisible();

        list.searchFor(base);
        Locator domains = list.domainSelector();
        assertThat(domains.locator("option").first()).hasText("All domains");
        assertThat(domains.locator("option", new Locator.LocatorOptions().setHasText(CalendarFixtures.DOMAIN))).hasCount(1);
        assertThat(domains.locator("option", new Locator.LocatorOptions().setHasText(otherDomain))).hasCount(1);

        domains.selectOption(new SelectOption().setLabel(CalendarFixtures.DOMAIN));
        assertThat(list.userLinks()).hasText(new String[] {alice, charlie});
        // So does the domain filter
        assertThat(page).hasURL(Pattern.compile("[?&]domain=" + JsRegex.quote(CalendarFixtures.DOMAIN) + "(&|$)"));
        domains.selectOption(new SelectOption().setLabel(otherDomain));
        assertThat(list.noMatch(base)).isVisible();
        domains.selectOption(new SelectOption().setLabel("All domains"));
        assertThat(list.userLinks()).hasText(new String[] {alice, charlie});

        list.userLink(charlie).click();
        assertThat(page).hasURL(Pattern.compile("/users/user/" + JsRegex.quote(WebAdmin.encode(charlie)) + "$"));
        UserDetailPage detail = new UserDetailPage(app);
        assertThat(detail.heading()).hasText(charlie);
        assertThat(detail.subtitle()).hasText("Not registered");

        // Back from the user page restores the search
        page.goBack();
        assertThat(list.search()).hasValue(base);
        assertThat(list.domainSelector()).hasValue("");
        assertThat(list.userLinks()).hasText(new String[] {alice, charlie});
    }

    @Test
    @DisplayName("USR-02 Registered user detail page")
    void registeredUserDetailPage(AdminApp app, Page page, CalendarFixtures fixtures) {
        String user = new DavSeeds(fixtures).newUser("c3usr02");
        UsersListPage list = new UsersListPage(app).open();
        list.searchFor(user);
        list.userLink(user).click();

        // Headed by the user, a breadcrumb leading back to the list
        UserDetailPage detail = new UserDetailPage(app);
        String localPart = user.substring(0, user.indexOf('@'));
        assertThat(detail.heading()).hasText(user);
        assertThat(detail.subtitle()).hasText(localPart + " " + localPart + " · Registered calendar user");
        assertThat(detail.breadcrumb()).hasText("Users");
        assertThat(detail.breadcrumb()).hasAttribute("href", "/users");

        // The summary strip counts what the sections hold
        assertThat(detail.summaryChip("Calendars: 1")).isVisible();
        assertThat(detail.summaryChip("Address Books: 2")).isVisible();
        assertThat(detail.summaryChip("Booking Links: 0")).isVisible();
        detail.calendars().expectCount(1);
        detail.addressBooks().expectCount(2);
        assertThat(detail.sectionToggle("Booking Links")).hasText(Pattern.compile("\\(0\\)$"));
        assertThat(detail.sectionToggle("Tasks")).isVisible();

        // Calendars and Address Books are open on a first visit, the other sections collapsed
        assertThat(detail.calendars().createButton()).isVisible();
        assertThat(detail.addressBooks().row("My contacts")).isVisible();
        assertThat(detail.sectionToggle("Booking Links")).hasAttribute("aria-expanded", "false");
        assertThat(detail.sectionToggle("Tasks")).hasAttribute("aria-expanded", "false");

        // Collapse all is remembered across a reload; a chip of the strip opens its section
        detail.collapseAll().click();
        assertThat(detail.calendars().createButton()).isHidden();
        assertThat(detail.addressBooks().rows("My contacts")).hasCount(0);
        page.reload();
        detail.calendars().expectCount(1);
        assertThat(detail.calendars().toggle()).hasAttribute("aria-expanded", "false");
        assertThat(detail.addressBooks().toggle()).hasAttribute("aria-expanded", "false");
        detail.summaryChip("Calendars: 1").click();
        assertThat(detail.calendars().createButton()).isVisible();
        assertThat(detail.addressBooks().toggle()).hasAttribute("aria-expanded", "false");
        detail.expandAll().click();
        assertThat(detail.addressBooks().row("My contacts")).isVisible();
        assertThat(detail.sectionToggle("Booking Links")).hasAttribute("aria-expanded", "true");
        assertThat(detail.sectionToggle("Tasks")).hasAttribute("aria-expanded", "true");

        // No mail section
        for (String mailSection : new String[] {"Mailboxes", "Quota", "Aliases", "Forwards", "Vacation", "JMAP Identities",
            "Delegated Users", "Mappings", "Labels", "Network Channels"}) {
            assertThat(detail.sectionToggle(mailSection)).hasCount(0);
        }
    }

    @Test
    @DisplayName("USR-03 Register an unregistered user from the detail page")
    void registerUnregisteredUserFromDetailPage(AdminApp app, Page page, CalendarFixtures fixtures) {
        String user = fixtures.newUnregisteredUser("c3usr03");
        String localPart = user.substring(0, user.indexOf('@'));
        AtomicInteger registrations = new AtomicInteger();
        page.onRequest(request -> {
            if (request.method().equals("POST") && request.url().contains("/registeredUsers")) {
                registrations.incrementAndGet();
            }
        });
        UserDetailPage detail = new UserDetailPage(app).open(user);

        assertThat(detail.heading()).hasText(user);
        assertThat(detail.subtitle()).hasText("Not registered");
        assertThat(detail.notRegisteredPanel()).isVisible();
        // No section to expand or collapse before the registration
        assertThat(detail.expandAll()).hasCount(0);
        assertThat(detail.collapseAll()).hasCount(0);
        assertThat(app.main().getByText("The user exists in the directory but is not registered on the DAV server yet.",
            new Locator.GetByTextOptions())).isVisible();
        assertThat(detail.sectionToggle("Calendars")).hasCount(0);
        assertThat(detail.sectionToggle("Address Books")).hasCount(0);
        assertThat(detail.sectionToggle("Booking Links")).hasCount(0);

        detail.registerButton().click();
        Locator dialog = app.dialog();
        assertThat(dialog.getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setName("Register user"))).isVisible();
        assertThat(dialog.getByText("Registering \"" + user + "\" on the DAV server.")).isVisible();
        assertThat(dialog.getByText("Your deployment may include a periodic LDAP import")).isVisible();
        Locator firstname = dialog.getByLabel("First name");
        Locator lastname = dialog.getByLabel("Last name");
        assertThat(firstname).hasValue(localPart);
        assertThat(lastname).hasValue("");

        firstname.fill("");
        app.clickConfirm();
        assertThat(app.dialogError()).hasText("First name is required");
        firstname.fill("Frank");
        app.clickConfirm();
        assertThat(app.dialogError()).hasText("Last name is required");
        assertThat(dialog).isVisible();
        assertThat(registrations.get()).isZero();

        lastname.fill("QA");
        app.confirm();
        app.expectToast("User \"" + user + "\" registered");
        assertThat(detail.notRegisteredPanel()).isHidden();
        assertThat(detail.subtitle()).hasText("Frank QA · Registered calendar user");
        assertThat(detail.expandAll()).isVisible();
        assertThat(detail.sectionToggle("Calendars")).isVisible();
        assertThat(detail.sectionToggle("Address Books")).isVisible();
        assertThat(detail.sectionToggle("Booking Links")).isVisible();
        assertThat(detail.sectionToggle("Tasks")).isVisible();
        assertThat(registrations.get()).isEqualTo(1);

        JsonNode registered = null;
        for (JsonNode candidate : fixtures.webAdmin().get("/registeredUsers").expect(200).json()) {
            if (user.equals(candidate.path("email").asText())) {
                registered = candidate;
            }
        }
        assertThat(registered).as("%s in /registeredUsers", user).isNotNull();
        assertThat(registered.path("firstname").asText()).isEqualTo("Frank");
        assertThat(registered.path("lastname").asText()).isEqualTo("QA");
    }

    @Test
    @DisplayName("USR-04 Navigating from one user page to another resets the page")
    void navigatingToAnotherUserResetsThePage(AdminApp app, Page page, CalendarFixtures fixtures) {
        DavSeeds seeds = new DavSeeds(fixtures);
        String bob = seeds.newUser("c3usr04-bob");
        String charlotte = seeds.newUser("c3usr04-charlotte");
        String bobCalendar = Ids.unique("Bob cal");
        String bobAddressBook = Ids.unique("Bob book");
        seeds.createCalendar(bob, bobCalendar);
        seeds.createAddressBook(bob, bobAddressBook);
        seeds.delegate(charlotte, seeds.mainCalendarId(charlotte), bob, "dav:read-write");

        UserDetailPage detail = new UserDetailPage(app).open(bob);
        CollectionSection calendars = detail.calendars().expand();
        CollectionSection addressBooks = detail.addressBooks().expand();
        assertThat(calendars.row(bobCalendar)).isVisible();
        assertThat(addressBooks.row(bobAddressBook)).isVisible();
        Locator delegated = calendars.rowInGroup("Delegated", "Main calendar of " + charlotte);
        delegated.getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName(charlotte).setExact(true)).click();

        assertThat(page).hasURL(Pattern.compile("/users/user/" + JsRegex.quote(WebAdmin.encode(charlotte)) + "$"));
        assertThat(detail.heading()).hasText(charlotte);
        // The sections keep their open state, on charlotte's own collections
        calendars.expectCount(1);
        addressBooks.expectCount(2);
        assertThat(calendars.createButton()).isVisible();
        assertThat(addressBooks.toggle()).hasAttribute("aria-expanded", "true");
        assertThat(calendars.rowInGroup("Owner", "Main calendar")).isVisible();
        assertThat(calendars.groupHeading("Delegated")).hasCount(0);
        assertThat(calendars.rows(bobCalendar)).hasCount(0);
        assertThat(addressBooks.row("My contacts")).isVisible();
        assertThat(addressBooks.row("Collected contacts")).isVisible();
        assertThat(addressBooks.rows(bobAddressBook)).hasCount(0);
    }

    @Test
    @DisplayName("USR-05 Page through more than 50 users")
    void pageThroughMoreThanFiftyUsers(AdminApp app, Page page, CalendarFixtures fixtures) {
        // The side service ignores limit, anchor and query: the console filters, sorts and pages by 50
        String prefix = Ids.unique("c3usr05");
        String otherDomain = fixtures.newDomain("c3usr05");
        List<String> users = IntStream.range(0, 55).parallel()
            .mapToObj(i -> fixtures.newUnregisteredUser(prefix + "-" + String.format("%02d", i)))
            .sorted()
            .toList();
        UsersListPage list = new UsersListPage(app).open().searchFor(prefix);

        assertThat(list.rows()).hasText(numbered(users, 0, 50, 1));
        assertThat(list.pageLabel()).hasText("Users 1–50");
        assertThat(list.first()).isDisabled();
        assertThat(list.previous()).isDisabled();
        assertThat(list.next()).isEnabled();
        List<String> firstPage = list.userLinks().allInnerTexts();

        list.next().click();
        assertThat(list.pageLabel()).hasText("Users 51–55");
        assertThat(list.rows()).hasText(numbered(users, 50, 55, 51));
        assertThat(list.next()).isDisabled();
        assertThat(list.previous()).isEnabled();
        assertThat(list.first()).isEnabled();
        List<String> all = new ArrayList<>(firstPage);
        all.addAll(list.userLinks().allInnerTexts());
        assertThat(all).containsExactlyElementsOf(users);
        assertThat(new HashSet<>(all)).hasSize(55);

        list.previous().click();
        assertThat(list.pageLabel()).hasText("Users 1–50");
        assertThat(list.rows()).hasText(numbered(users, 0, 50, 1));

        list.next().click();
        assertThat(list.pageLabel()).hasText("Users 51–55");
        list.first().click();
        assertThat(list.pageLabel()).hasText("Users 1–50");
        assertThat(list.row(1)).hasText("1." + users.get(0));

        // Typing from page 2 restarts from page 1, everything fits on it: no paging controls
        list.next().click();
        assertThat(list.pageLabel()).hasText("Users 51–55");
        list.searchFor(prefix + "-5");
        assertThat(list.rows()).hasText(numbered(users, 50, 55, 1));
        assertThat(list.pageLabel()).hasText("5 users");
        assertThat(list.next()).hasCount(0);
        assertThat(list.previous()).hasCount(0);

        // Changing the domain from page 2 restarts from page 1 too
        list.searchFor(prefix);
        assertThat(list.pageLabel()).hasText("Users 1–50");
        list.next().click();
        assertThat(list.pageLabel()).hasText("Users 51–55");
        list.domainSelector().selectOption(new SelectOption().setLabel(otherDomain));
        assertThat(list.noMatch(prefix)).isVisible();
        assertThat(list.rows()).hasCount(0);
        assertThat(list.pageLabel()).hasCount(0);
        list.domainSelector().selectOption(new SelectOption().setLabel(CalendarFixtures.DOMAIN));
        assertThat(list.pageLabel()).hasText("Users 1–50");
        assertThat(list.rows()).hasText(numbered(users, 0, 50, 1));

        // A user of page 2 opens its page
        list.next().click();
        assertThat(list.pageLabel()).hasText("Users 51–55");
        String last = users.get(54);
        list.userLink(last).click();
        assertThat(page).hasURL(Pattern.compile("/users/user/" + JsRegex.quote(WebAdmin.encode(last)) + "$"));
        assertThat(new UserDetailPage(app).heading()).hasText(last);
    }

    /** {@code "n/username"} for {@code users[from..to)}, numbered from {@code firstNumber}. */
    private static String[] numbered(List<String> users, int from, int to, int firstNumber) {
        return IntStream.range(from, to).mapToObj(i -> (firstNumber + i - from) + "." + users.get(i)).toArray(String[]::new);
    }
}
