package com.linagora.admin.e2e.calendar.ops;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.regex.Pattern;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.linagora.admin.e2e.CalendarAdminE2ETest;
import com.linagora.admin.e2e.backend.CalendarFixtures;
import com.linagora.admin.e2e.backend.Ids;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.docker.CalendarStack;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.calendar.ops.Regex;
import com.linagora.admin.e2e.pages.calendar.ops.RegisteredUsersPage;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

class RegisteredUsersTest extends CalendarAdminE2ETest {

    /** Records the requests changing registered users ("POST .../registeredUsers"...). */
    private static List<String> registeredUserWrites(Page page) {
        List<String> writes = new CopyOnWriteArrayList<>();
        page.onRequest(request -> {
            if (!request.method().equals("GET") && !request.method().equals("HEAD") && request.url().contains("/registeredUsers")) {
                writes.add(request.method() + " " + request.url());
            }
        });
        return writes;
    }

    @Test
    @DisplayName("REG-01 Registered users list and search")
    void registeredUsersListAndSearch(AdminApp app, CalendarFixtures fixtures, WebAdmin webAdmin, CalendarStack stack) {
        OpsBackend backend = new OpsBackend(webAdmin, stack);
        String tag = "reg" + Ids.suffix(6);
        String second = fixtures.newRegisteredUser(tag + "b");
        String first = fixtures.newRegisteredUser(tag + "a");
        String firstLocalPart = first.substring(0, first.indexOf('@'));
        String firstId = backend.registeredUser(first).path("id").asText();

        RegisteredUsersPage users = RegisteredUsersPage.open(app);
        Locator doc = app.main().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName("doc").setExact(true));
        // Says how the list differs from the Users list
        assertThat(app.main().getByText("Users registered on the calendar (DAV) server. "
            + "Only registered users have calendars, address books and booking links.")).isVisible();
        assertThat(doc).hasAttribute("href", Pattern.compile("#calendar-users-routes$"));
        assertThat(users.pagination()).isVisible();
        assertThat(users.registerButton()).isVisible();

        users.searchFor(tag);
        assertThat(users.rowHeadings()).hasText(new String[] {"1/" + first, "2/" + second});
        assertThat(users.pagination()).hasText("Total: 2");
        Locator row = users.row(first);
        // Each address links to its user page
        Locator userLink = row.getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName(first).setExact(true));
        assertThat(userLink).hasAttribute("href", "/users/user/" + URLEncoder.encode(first, StandardCharsets.UTF_8));
        assertThat(row).containsText(firstLocalPart + " " + firstLocalPart);
        assertThat(row).containsText("ID: " + firstId);
        assertThat(users.rowAction(first, "Edit user")).isVisible();
        assertThat(users.rowAction(first, "Delete user")).isVisible();

        users.searchFor(firstId);
        assertThat(users.rowHeadings()).hasText(new String[] {"1/" + first});

        String nothing = "zzz" + Ids.suffix(8);
        users.searchFor(nothing);
        assertThat(users.rowHeadings()).hasCount(0);
        assertThat(app.main().getByText("No registered user matches \"" + nothing + "\".")).isVisible();

        users.searchFor(first);
        userLink.click();
        assertThat(app.page()).hasURL(Pattern.compile("/users/user/" + Regex.quote(URLEncoder.encode(first, StandardCharsets.UTF_8)) + "$"));
        assertThat(app.main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setLevel(1).setName(first))).isVisible();
    }

    @Test
    @DisplayName("REG-02 Register a user from the list")
    void registerUserFromList(AdminApp app, Page page, CalendarFixtures fixtures, WebAdmin webAdmin, CalendarStack stack) {
        OpsBackend backend = new OpsBackend(webAdmin, stack);
        String user = fixtures.newUnregisteredUser("frank");
        String localPart = user.substring(0, user.indexOf('@'));
        List<String> writes = registeredUserWrites(page);

        RegisteredUsersPage users = RegisteredUsersPage.open(app);
        users.registerButton().click();
        assertThat(users.registerDialog()).isVisible();
        assertThat(users.newUser()).isFocused();
        assertThat(users.newUser()).hasAttribute("placeholder", "user@domain.tld");
        users.typeNewUser(Ids.unique("nobody") + "@open-paas.org");
        assertThat(users.accountLine("User not found")).isVisible();
        assertThat(users.submitButton()).isDisabled();
        assertThat(users.field("First name")).hasCount(0);

        users.typeNewUser(user);
        assertThat(users.accountLine("User exists")).isVisible();
        assertThat(users.submitButton()).isEnabled();
        app.cancel();
        assertThat(backend.registeredUser(user)).isNull();

        // Reopened empty: the account, then its names, in the same modal
        users.registerButton().click();
        assertThat(users.newUser()).hasValue("");
        users.typeNewUser(user);
        assertThat(users.registerDialog()).containsText("Registering \"" + user + "\" on the DAV server.");
        assertThat(users.registerDialog()).containsText("Your deployment may include a periodic LDAP import");
        assertThat(users.field("First name")).hasValue(localPart);
        assertThat(users.field("Last name")).hasValue("");
        users.submitButton().click();
        assertThat(app.dialogError()).hasText("Last name is required");
        assertThat(users.registerDialog()).isVisible();
        assertThat(writes).isEmpty();

        users.field("First name").fill("Frank");
        users.field("Last name").fill("QA");
        users.submitButton().click();

        app.expectToast("User \"" + user + "\" registered");
        assertThat(users.registerDialog()).isHidden();
        users.searchFor(user);
        assertThat(users.row(user)).containsText("Frank QA");
        users.registerButton().click();
        users.typeNewUser(user);
        assertThat(users.accountLine("Already registered")).isVisible();
        assertThat(users.submitButton()).isDisabled();
        app.cancel();
        JsonNode registered = backend.registeredUser(user);
        assertThat(registered.path("firstname").asText()).isEqualTo("Frank");
        assertThat(registered.path("lastname").asText()).isEqualTo("QA");

        app.open("/users/user/" + URLEncoder.encode(user, StandardCharsets.UTF_8));
        assertThat(app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(Pattern.compile("^Calendars\\s*(\\(\\d+\\))?$")))).isVisible();
        assertThat(app.main().getByText("This user is not registered")).hasCount(0);
    }

    @Test
    @DisplayName("REG-03 Edit a registered user")
    void editRegisteredUser(AdminApp app, CalendarFixtures fixtures, WebAdmin webAdmin, CalendarStack stack) {
        OpsBackend backend = new OpsBackend(webAdmin, stack);
        String user = fixtures.newRegisteredUser("charlotte");
        String localPart = user.substring(0, user.indexOf('@'));

        RegisteredUsersPage users = RegisteredUsersPage.open(app).searchFor(user);
        users.rowAction(user, "Edit user").click();
        assertThat(app.dialog().getByRole(AriaRole.HEADING)).hasText("Edit Registered User");
        assertThat(app.dialog()).containsText("Your deployment may include a periodic LDAP import");
        assertThat(users.field("Email")).hasValue(user);
        assertThat(users.field("First name")).hasValue(localPart);
        assertThat(users.field("Last name")).hasValue(localPart);
        users.field("First name").fill("Charlotte");
        users.field("Last name").fill("QA");
        app.confirm();

        app.expectToast("User updated");
        assertThat(users.row(user)).containsText("Charlotte QA");
        JsonNode registered = backend.registeredUser(user);
        assertThat(registered.path("firstname").asText()).isEqualTo("Charlotte");
        assertThat(registered.path("lastname").asText()).isEqualTo("QA");
    }

    @Test
    @DisplayName("REG-04 Delete a registered user")
    void deleteRegisteredUser(AdminApp app, CalendarFixtures fixtures, WebAdmin webAdmin, CalendarStack stack) {
        OpsBackend backend = new OpsBackend(webAdmin, stack);
        String user = fixtures.newRegisteredUser("emma");

        RegisteredUsersPage users = RegisteredUsersPage.open(app).searchFor(user);
        users.rowAction(user, "Delete user").click();
        assertThat(app.dialog()).containsText("Delete registered user \"" + user + "\"?");
        app.dialog().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Delete").setExact(true)).click();
        assertThat(app.dialog()).isHidden();

        app.expectToast("User \"" + user + "\" deleted");
        assertThat(users.rowHeadings()).hasCount(0);
        assertThat(backend.registeredUser(user)).isNull();

        app.open("/users/user/" + URLEncoder.encode(user, StandardCharsets.UTF_8));
        assertThat(app.main().getByText("This user is not registered")).isVisible();
    }

    @Test
    @DisplayName("REG-05 Edit Registered User validation")
    void editRegisteredUserValidation(AdminApp app, Page page, CalendarFixtures fixtures, WebAdmin webAdmin, CalendarStack stack) {
        OpsBackend backend = new OpsBackend(webAdmin, stack);
        String user = fixtures.newRegisteredUser("bob");
        String localPart = user.substring(0, user.indexOf('@'));
        List<String> writes = registeredUserWrites(page);

        RegisteredUsersPage users = RegisteredUsersPage.open(app).searchFor(user);
        users.rowAction(user, "Edit user").click();

        users.field("Last name").fill("");
        app.clickConfirm();
        assertThat(app.dialogError()).hasText("Last name is required");
        assertThat(users.field("Last name")).hasValue("");

        users.field("Last name").fill(localPart);
        users.field("First name").fill("");
        app.clickConfirm();
        assertThat(app.dialogError()).hasText("First name is required");
        assertThat(users.field("Last name")).hasValue(localPart);

        users.field("First name").fill(localPart);
        users.field("Email").fill("not-an-email");
        app.clickConfirm();
        assertThat(app.dialogError()).hasText("Email must be a valid address, like user@domain.tld");
        assertThat(users.field("Email")).hasValue("not-an-email");
        assertThat(app.dialog()).isVisible();

        app.cancel();
        assertThat(writes).isEmpty();
        assertThat(users.row(user)).containsText(localPart + " " + localPart);
        JsonNode registered = backend.registeredUser(user);
        assertThat(registered.path("firstname").asText()).isEqualTo(localPart);
        assertThat(registered.path("lastname").asText()).isEqualTo(localPart);
    }
}
