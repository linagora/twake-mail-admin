package com.linagora.admin.e2e.mail.domains;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import org.awaitility.Awaitility;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.docker.BrowserLog;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.domains.DomainDetailPage;
import com.linagora.admin.e2e.pages.mail.domains.Regex;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

class DomainQuotaTest extends MailAdminE2ETest {

    @Test
    @DisplayName("DOM-07 Domain quota: update and reset size limit")
    void updateAndResetSizeLimit(AdminApp app, MailFixtures fixtures, Page page) {
        String domain = fixtures.domain();
        WebAdmin webAdmin = fixtures.webAdmin();
        List<String> quotaWrites = new CopyOnWriteArrayList<>();
        page.onRequest(request -> {
            if (request.url().contains("/quota/domains/") && !request.method().equals("GET")) {
                quotaWrites.add(request.method() + " " + request.url());
            }
        });

        DomainDetailPage detail = DomainDetailPage.open(app, domain).openSection("Quota");
        assertThat(detail.text("Per user limit")).isVisible();
        assertThat(detail.quotaRow("Computed (effective)")).containsText("Count: not set");
        assertThat(detail.quotaRow("Domain")).hasText(java.util.regex.Pattern.compile("Domain\\s*Count: not set\\s*Size: not set"));
        assertThat(detail.quotaRow("Global")).containsText("Count:");
        assertThat(detail.button("Update size limit")).isVisible();
        assertThat(detail.button("Reset to global default")).hasCount(0);

        // 2 GB
        detail.saveSizeLimit("2", "GB");
        app.expectToast("Domain quota size updated");
        assertThat(detail.quotaRow("Domain")).containsText("Size: 2.0 GB");
        assertThat(domainQuota(webAdmin, domain).path("domain").path("size").asLong()).isEqualTo(2147483648L);
        assertThat(detail.button("Reset to global default")).isVisible();

        // Reset: Cancel changes nothing, Confirm removes the domain size
        detail.button("Reset to global default").click();
        assertThat(app.dialog()).containsText("Reset Quota Size");
        assertThat(app.dialog()).containsText("Remove the domain quota size limit for \"" + domain + "\"? The global limit will apply again.");
        app.cancel();
        assertThat(detail.quotaRow("Domain")).containsText("Size: 2.0 GB");
        assertThat(domainQuota(webAdmin, domain).path("domain").path("size").asLong()).isEqualTo(2147483648L);
        detail.button("Reset to global default").click();
        app.confirm();
        app.expectToast("Domain quota size reset to global default");
        assertThat(detail.quotaRow("Domain")).containsText("Size: not set");
        assertThat(detail.button("Reset to global default")).hasCount(0);
        assertThat(domainQuota(webAdmin, domain).path("domain").path("size").isNull()).isTrue();

        // 0 and -5 are refused before any request
        int writes = quotaWrites.size();
        for (String invalid : List.of("0", "-5")) {
            detail.saveSizeLimit(invalid, "GB");
            app.expectToast("Invalid size");
            assertThat(app.toast("Invalid size")).containsText("Enter a positive number or -1 for unlimited.");
        }
        assertThat(quotaWrites).hasSize(writes);
        assertThat(domainQuota(webAdmin, domain).path("domain").path("size").isNull()).isTrue();

        // -1 is unlimited, and can be reset the same way
        detail.saveSizeLimit("-1", "GB");
        app.expectToast("Domain quota size updated");
        assertThat(detail.quotaRow("Domain")).containsText("Size: unlimited");
        assertThat(domainQuota(webAdmin, domain).path("domain").path("size").asLong()).isEqualTo(-1L);
        detail.button("Reset to global default").click();
        app.confirm();
        app.expectToast("Domain quota size reset to global default");
        assertThat(detail.quotaRow("Domain")).containsText("Size: not set");
        assertThat(domainQuota(webAdmin, domain).path("domain").path("size").isNull()).isTrue();
    }

    @Test
    @DisplayName("DOM-08 Domain resource usage and user quota explorer")
    void resourceUsageAndQuotaExplorer(AdminApp app, MailFixtures fixtures, BrowserLog browserLog) {
        String domain = fixtures.domain();
        WebAdmin webAdmin = fixtures.webAdmin();
        String bob = fixtures.newUser("bob");
        String alice = fixtures.newUser("alice");
        webAdmin.put("/quota/users/" + bob + "/size", String.valueOf(50L * 1024 * 1024)).expect(204);
        webAdmin.put("/quota/users/" + alice + "/count", "1000").expect(204);
        // An other domain's user with a quota too: it must not be listed
        String stranger = fixtures.newUser("stranger", fixtures.newDomain());
        webAdmin.put("/quota/users/" + stranger + "/size", String.valueOf(10L * 1024 * 1024)).expect(204);
        // The explorer reads a search index, fed asynchronously
        Awaitility.await().atMost(Duration.ofSeconds(30)).pollInterval(Duration.ofMillis(300))
            .until(() -> webAdmin.get("/quota/users?minOccupationRatio=0&maxOccupationRatio=1&domain=" + domain)
                .json().size() == 2);

        DomainDetailPage detail = DomainDetailPage.open(app, domain).openSection("Quota");

        // Never crashes: usage figures, or "Could not load quota usage." (this backend answers the domain limits)
        detail.toggleSection("Domain resource usage");
        assertThat(detail.text("Could not load quota usage.")).isVisible();
        assertThat(detail.text("Per user limit")).isVisible();
        assertThat(browserLog.pageErrors()).isEmpty();
        assertThat(browserLog.consoleErrors()).noneMatch(error -> error.contains("TypeError"));

        detail.toggleSection("Explore User Quota");
        Locator min = detail.main().getByLabel("Min occupation (%)");
        Locator max = detail.main().getByLabel("Max occupation (%)");
        min.fill("0");
        max.fill("100");
        detail.button("Search").click();
        for (String header : List.of("Username", "Occupation Size", "Occupation Count", "Ratio Max", "Computed Limit")) {
            assertThat(detail.text(header)).isVisible();
        }
        Locator users = detail.main().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions()
            .setName(java.util.regex.Pattern.compile("@" + Regex.quote(domain) + "$")));
        assertThat(users).hasCount(2);
        assertThat(detail.main().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName(stranger))).hasCount(0);
        Locator bobRow = detail.main().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName(bob).setExact(true))
            .locator("xpath=..");
        assertThat(bobRow).containsText("50.0 MB / —");
        assertThat(detail.text("Page 1 — 2 result(s)")).isVisible();

        min.fill("80");
        detail.button("Search").click();
        assertThat(detail.text("No users found in this occupation range.")).isVisible();

        // Same range validation as the global explorer
        min.fill("90");
        max.fill("10");
        detail.button("Search").click();
        assertThat(detail.main().getByRole(AriaRole.ALERT)).hasText("Must not be lower than the min occupation.");
        min.fill("-1");
        detail.button("Search").click();
        assertThat(detail.main().getByRole(AriaRole.ALERT).first()).hasText("Enter a percentage between 0 and 100.");
    }

    private static JsonNode domainQuota(WebAdmin webAdmin, String domain) {
        return webAdmin.get("/quota/domains/" + domain).expect(200).json();
    }
}
