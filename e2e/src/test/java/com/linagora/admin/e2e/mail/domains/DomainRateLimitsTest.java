package com.linagora.admin.e2e.mail.domains;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.domains.DetailPage;
import com.linagora.admin.e2e.pages.mail.domains.DomainDetailPage;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;

class DomainRateLimitsTest extends MailAdminE2ETest {
    private static final List<String> LABELS = List.of(
        "Mails sent / minute", "Mails sent / hour", "Mails sent / day",
        "Recipients sent / minute", "Recipients sent / hour", "Recipients sent / day",
        "Mails received / minute", "Mails received / hour", "Mails received / day");

    @Test
    @DisplayName("DOM-12 Domain rate limits")
    void domainRateLimits(AdminApp app, MailFixtures fixtures) {
        String domain = fixtures.domain();
        WebAdmin webAdmin = fixtures.webAdmin();
        String path = "/domains/" + domain + "/ratelimits";

        DomainDetailPage detail = DomainDetailPage.open(app, domain).openSection("Rate Limiting");
        for (String label : LABELS) {
            assertThat(detail.rateLimit(label)).hasAttribute("placeholder", "default");
            assertThat(detail.rateLimit(label)).hasValue("");
        }
        assertThat(detail.main().getByText("Leave empty to fall back to the default limit (null), -1 means unlimited.",
            new Locator.GetByTextOptions())).isVisible();

        detail.rateLimit("Mails sent / minute").fill("10");
        detail.rateLimit("Recipients sent / day").fill("-1");
        detail.button("Save").click();
        app.expectToast("Rate limits updated");
        JsonNode limits = webAdmin.get(path).expect(200).json();
        assertThat(limits.path("mailsSentPerMinute").asLong()).isEqualTo(10);
        assertThat(limits.path("recipientsSentPerDays").asLong()).isEqualTo(-1);
        assertThat(limits.path("mailsSentPerHours").isNull()).isTrue();

        // Persisted on reopen
        detail.toggleSection("Rate Limiting");
        assertThat(detail.rateLimit("Mails sent / minute")).hasCount(0);
        detail.toggleSection("Rate Limiting");
        assertThat(detail.rateLimit("Mails sent / minute")).hasValue("10");
        assertThat(detail.rateLimit("Recipients sent / day")).hasValue("-1");
        assertThat(detail.rateLimit("Mails sent / hour")).hasValue("");

        // Emptying a field brings it back to default
        detail.rateLimit("Mails sent / minute").fill("");
        detail.button("Save").click();
        app.expectToast("Rate limits updated");
        limits = webAdmin.get(path).expect(200).json();
        assertThat(limits.path("mailsSentPerMinute").isNull()).isTrue();
        assertThat(limits.path("recipientsSentPerDays").asLong()).isEqualTo(-1);
    }

    @Test
    @DisplayName("DOM-15 Rate limits reject invalid values (domain)")
    void domainRateLimitsRejectInvalidValues(AdminApp app, MailFixtures fixtures, Page page) {
        String domain = fixtures.domain();
        DomainDetailPage detail = DomainDetailPage.open(app, domain).openSection("Rate Limiting");
        rejectsInvalidValues(app, detail, page, fixtures.webAdmin(), "/domains/" + domain + "/ratelimits");
    }

    @Test
    @DisplayName("DOM-15 Rate limits reject invalid values (user)")
    void userRateLimitsRejectInvalidValues(AdminApp app, MailFixtures fixtures, Page page) {
        String bob = fixtures.newUser("bob");
        app.open("/users/user/" + WebAdmin.encode(bob));
        DetailPage detail = new DetailPage(app);
        detail.toggleSection("Rate Limiting");
        rejectsInvalidValues(app, detail, page, fixtures.webAdmin(), "/users/" + bob + "/ratelimits");
    }

    private static void rejectsInvalidValues(AdminApp app, DetailPage detail, Page page, WebAdmin webAdmin, String path) {
        List<String> writes = new CopyOnWriteArrayList<>();
        page.onRequest(request -> {
            if (request.url().contains("/ratelimits") && !request.method().equals("GET")) {
                writes.add(request.method() + " " + request.url());
            }
        });
        String before = webAdmin.get(path).body();
        Locator field = detail.rateLimit("Mails sent / minute");
        assertThat(field).hasValue("");

        for (String invalid : List.of("-5", "1.5", "1e2")) {
            field.fill(invalid);
            assertThat(field).hasAttribute("aria-invalid", "true");
            detail.button("Save").click();
            app.expectToast("Invalid rate limit");
            assertThat(app.toast("Invalid rate limit"))
                .containsText("Enter a positive integer, -1 for unlimited, or leave empty for the default limit.");
        }
        assertThat(writes).isEmpty();
        assertThat(webAdmin.get(path).body()).isEqualTo(before);

        field.fill("-1");
        assertThat(field).hasAttribute("aria-invalid", "false");
        detail.button("Save").click();
        app.expectToast("Rate limits updated");
        assertThat(webAdmin.get(path).expect(200).json().path("mailsSentPerMinute").asLong()).isEqualTo(-1);
        detail.toggleSection("Rate Limiting");
        detail.toggleSection("Rate Limiting");
        assertThat(field).hasValue("-1");
    }
}
