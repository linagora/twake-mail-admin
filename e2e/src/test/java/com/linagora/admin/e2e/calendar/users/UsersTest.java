package com.linagora.admin.e2e.calendar.users;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;

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
        domains.selectOption(new SelectOption().setLabel(otherDomain));
        assertThat(list.noMatch(base)).isVisible();
        domains.selectOption(new SelectOption().setLabel("All domains"));
        assertThat(list.userLinks()).hasText(new String[] {alice, charlie});

        list.userLink(charlie).click();
        assertThat(page).hasURL(Pattern.compile("/users/user/" + JsRegex.quote(WebAdmin.encode(charlie)) + "$"));
        assertThat(new UserDetailPage(app).usernameLabel()).hasText("Username: " + charlie);
    }

    @Test
    @DisplayName("USR-02 Registered user detail page")
    void registeredUserDetailPage(AdminApp app, Page page, CalendarFixtures fixtures) {
        String user = new DavSeeds(fixtures).newUser("c3usr02");
        UsersListPage list = new UsersListPage(app).open();
        list.searchFor(user);
        list.userLink(user).click();

        UserDetailPage detail = new UserDetailPage(app);
        assertThat(detail.title()).isVisible();
        assertThat(detail.usernameLabel()).hasText("Username: " + user);
        assertThat(detail.backButton()).isVisible();
        detail.calendars().expectCount(1);
        detail.addressBooks().expectCount(2);
        assertThat(detail.sectionToggle("Booking Links")).hasText(Pattern.compile("\\(0\\)$"));
        assertThat(detail.sectionToggle("Tasks")).isVisible();
        // Collapsed
        assertThat(detail.calendars().createButton()).isHidden();
        assertThat(detail.addressBooks().createButton()).isHidden();
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

        assertThat(detail.notRegisteredPanel()).isVisible();
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
        Locator firstname = dialog.getByLabel("Firstname");
        Locator lastname = dialog.getByLabel("Lastname");
        assertThat(firstname).hasValue(localPart);
        assertThat(lastname).hasValue("");

        firstname.fill("");
        app.clickConfirm();
        assertThat(app.dialogError()).hasText("Firstname is required");
        firstname.fill("Frank");
        app.clickConfirm();
        assertThat(app.dialogError()).hasText("Lastname is required");
        assertThat(dialog).isVisible();
        assertThat(registrations.get()).isZero();

        lastname.fill("QA");
        app.confirm();
        app.expectToast("User \"" + user + "\" registered");
        assertThat(detail.notRegisteredPanel()).isHidden();
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
        Locator delegated = calendars.rowInGroup("Delegated", "#default");
        delegated.getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName(charlotte).setExact(true)).click();

        assertThat(page).hasURL(Pattern.compile("/users/user/" + JsRegex.quote(WebAdmin.encode(charlotte)) + "$"));
        assertThat(detail.usernameLabel()).hasText("Username: " + charlotte);
        calendars.expectCount(1);
        addressBooks.expectCount(2);
        assertThat(calendars.createButton()).isHidden();
        assertThat(addressBooks.createButton()).isHidden();

        calendars.expand();
        addressBooks.expand();
        assertThat(calendars.rowInGroup("Owner", "#default")).isVisible();
        assertThat(calendars.groupHeading("Delegated")).hasCount(0);
        assertThat(calendars.rows(bobCalendar)).hasCount(0);
        assertThat(addressBooks.row("My contacts")).isVisible();
        assertThat(addressBooks.row("Collected contacts")).isVisible();
        assertThat(addressBooks.rows(bobAddressBook)).hasCount(0);
    }
}
