package com.linagora.admin.e2e.calendar.domains;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.util.List;
import java.util.regex.Pattern;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.linagora.admin.e2e.CalendarAdminE2ETest;
import com.linagora.admin.e2e.backend.CalendarFixtures;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.calendar.domains.CalendarDomainPage;
import com.linagora.admin.e2e.pages.calendar.domains.DomainsPage;
import com.microsoft.playwright.Page;

class DomainDetailTest extends CalendarAdminE2ETest {

    @Test
    @DisplayName("DOM-05 Calendar domain detail page")
    void calendarDomainDetailPage(AdminApp app, Page page, CalendarFixtures fixtures) {
        // A domain of its own: open-paas.org gets admins from other tests, its counter would vary
        String domain = fixtures.newDomain("detail");
        DomainsPage domains = new DomainsPage(app).open().search(domain);
        CalendarDomainPage detail = new CalendarDomainPage(app);

        domains.domainLink(domain).click();

        assertThat(page).hasURL(Pattern.compile("/domains/domain/" + CalendarDomainPage.regexQuote(domain) + "$"));
        assertThat(detail.title()).isVisible();
        assertThat(app.main().getByText("Domain: " + domain, new com.microsoft.playwright.Locator.GetByTextOptions().setExact(true))).isVisible();
        assertThat(detail.backButton()).isVisible();
        assertThat(detail.sectionToggles()).hasText(new Pattern[] {
            Pattern.compile("^Domain Admins\\s*\\(0\\)$"),
            Pattern.compile("^Calendar Resources"),
            Pattern.compile("^Team Calendars"),
            Pattern.compile("^Domain settings$"),
            Pattern.compile("^Domain contacts$"),
            Pattern.compile("^Tasks$")});
        for (String mailSection : List.of("Aliases", "Quota", "Rate limiting", "Team Mailboxes", "Signature templates",
            "JMAP settings report")) {
            assertThat(app.main().getByText(mailSection)).hasCount(0);
        }

        detail.backButton().click();
        assertThat(page).hasURL(Pattern.compile("/domains$"));
        assertThat(domains.searchInput()).isVisible();
    }
}
