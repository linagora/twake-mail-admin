package com.linagora.admin.e2e.calendar.domains;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.linagora.admin.e2e.CalendarAdminE2ETest;
import com.linagora.admin.e2e.backend.CalendarFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.calendar.domains.CalendarDomainPage;
import com.microsoft.playwright.Page;

/**
 * Each test administers a domain of its own with brand new registered users (the side service
 * refuses an admin that is not a registered user): the admin list and its counter are ours alone.
 */
class DomainAdminsTest extends CalendarAdminE2ETest {

    @Test
    @DisplayName("DADM-01 Add a calendar domain admin")
    void addCalendarDomainAdmin(AdminApp app, CalendarFixtures fixtures, WebAdmin webAdmin) {
        String domain = fixtures.newDomain("admins");
        String alice = fixtures.newRegisteredUser("alice");
        CalendarDomainPage detail = new CalendarDomainPage(app).open(domain).expand(CalendarDomainPage.ADMINS);

        assertThat(app.main().getByText("Domain admins can manage the domain address book.")).isVisible();
        assertThat(app.main().getByText("No domain admins.")).isVisible();
        detail.addAdminButton().click();

        detail.typeAdmin("nobody-" + alice);
        assertThat(detail.indicator("User not found")).isVisible();
        assertThat(detail.adminAddButton()).isDisabled();
        detail.typeAdmin("a@b@c");
        assertThat(detail.indicator("Invalid username")).isVisible();
        assertThat(detail.adminAddButton()).isDisabled();
        detail.typeAdmin(alice);
        assertThat(detail.indicator("User exists")).isVisible();
        assertThat(detail.adminAddButton()).isEnabled();

        detail.adminAddButton().click();

        app.expectToast("Admin added");
        assertThat(detail.adminInput()).isHidden();
        assertThat(detail.adminRows()).hasText(new String[] {"1/" + alice});
        assertThat(detail.sectionToggle(CalendarDomainPage.ADMINS)).hasText(java.util.regex.Pattern.compile("^Domain Admins\\s*\\(1\\)$"));
        assertThat(admins(webAdmin, domain)).containsExactly(alice);
    }

    @Test
    @DisplayName("DADM-02 Search and remove a domain admin")
    void searchAndRemoveDomainAdmin(AdminApp app, CalendarFixtures fixtures, WebAdmin webAdmin) {
        String domain = fixtures.newDomain("admins");
        String alice = fixtures.newRegisteredUser("alice");
        String bob = fixtures.newRegisteredUser("bob");
        webAdmin.put("/domains/" + domain + "/admins/" + alice).expect(204);
        webAdmin.put("/domains/" + domain + "/admins/" + bob).expect(204);
        CalendarDomainPage detail = new CalendarDomainPage(app).open(domain).expand(CalendarDomainPage.ADMINS);
        assertThat(detail.adminRows()).hasText(new String[] {"1/" + alice, "2/" + bob});

        detail.adminSearch().fill("bob");
        assertThat(detail.adminRows()).hasText(new String[] {"1/" + bob});
        detail.adminSearch().fill("");
        assertThat(detail.adminRows()).hasCount(2);

        detail.removeAdminButton(bob).click();
        assertThat(app.dialog()).containsText("Remove \"" + bob + "\" from admins of " + domain + "?");
        app.confirm();

        app.expectToast("Admin removed");
        assertThat(detail.adminRows()).hasText(new String[] {"1/" + alice});
        assertThat(admins(webAdmin, domain)).containsExactly(alice);
    }

    @Test
    @DisplayName("DADM-03 An existing admin cannot be added again")
    void existingAdminCannotBeAddedAgain(AdminApp app, Page page, CalendarFixtures fixtures, WebAdmin webAdmin) {
        String domain = fixtures.newDomain("admins");
        String alice = fixtures.newRegisteredUser("alice");
        webAdmin.put("/domains/" + domain + "/admins/" + alice).expect(204);
        List<String> puts = new CopyOnWriteArrayList<>();
        page.onRequest(request -> {
            if ("PUT".equals(request.method()) && request.url().contains("/admins/")) {
                puts.add(request.url());
            }
        });
        CalendarDomainPage detail = new CalendarDomainPage(app).open(domain).expand(CalendarDomainPage.ADMINS);
        assertThat(detail.adminRows()).hasCount(1);
        detail.addAdminButton().click();

        detail.typeAdmin(alice);
        assertThat(detail.indicator("Already an admin")).isVisible();
        assertThat(detail.indicator("User exists")).hasCount(0);
        assertThat(detail.adminAddButton()).isDisabled();
        detail.adminInput().press("Enter");

        String shouted = " " + alice.substring(0, alice.indexOf('@')).toUpperCase() + alice.substring(alice.indexOf('@')) + " ";
        detail.typeAdmin(shouted);
        assertThat(detail.indicator("Already an admin")).isVisible();
        assertThat(detail.indicator("User exists")).hasCount(0);
        assertThat(detail.adminAddButton()).isDisabled();
        detail.adminInput().press("Enter");

        assertThat(detail.adminRows()).hasText(new String[] {"1/" + alice});
        assertThat(puts).isEmpty();
        assertThat(admins(webAdmin, domain)).containsExactly(alice);
    }

    private static List<String> admins(WebAdmin webAdmin, String domain) {
        JsonNode json = webAdmin.get("/domains/" + domain + "/admins").expect(200).json();
        return WebAdmin.JSON.convertValue(json, WebAdmin.JSON.getTypeFactory().constructCollectionType(List.class, String.class));
    }
}
