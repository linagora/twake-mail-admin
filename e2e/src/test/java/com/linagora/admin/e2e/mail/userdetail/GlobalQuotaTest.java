package com.linagora.admin.e2e.mail.userdetail;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.regex.Pattern;

import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.ResourceLock;

import com.fasterxml.jackson.databind.JsonNode;
import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.docker.Locks;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.userdetail.GlobalQuotaPage;
import com.linagora.admin.e2e.pages.mail.userdetail.MailUserDetailPage;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Response;
import com.microsoft.playwright.options.AriaRole;

/** Drives {@code /quota}, the default of every user of the server: holds the global quota lock and restores it. */
@ResourceLock(Locks.MAIL_GLOBAL_QUOTA)
class GlobalQuotaTest extends MailAdminE2ETest {
    private static final long GB = 1024L * 1024 * 1024;
    private static final long MB = 1024L * 1024;
    private static final double SLOW_WRITE_MS = 90_000;

    private JsonNode initialQuota;

    @BeforeEach
    void rememberGlobalQuota(WebAdmin webAdmin) {
        initialQuota = webAdmin.get("/quota").expect(200).json();
    }

    @AfterEach
    void restoreGlobalQuota(WebAdmin webAdmin) {
        restore(webAdmin, "size");
        restore(webAdmin, "count");
    }

    private void restore(WebAdmin webAdmin, String field) {
        JsonNode value = initialQuota.path(field);
        if (webAdmin.get("/quota").expect(200).json().path(field).equals(value)) {
            return;
        }
        if (value.isNull() || value.isMissingNode()) {
            webAdmin.delete("/quota/" + field).expect(204);
        } else {
            webAdmin.put("/quota/" + field, value.asText()).expect(204);
        }
    }

    @Test
    @DisplayName("GQ-01 Update the global quota size")
    void updateGlobalQuotaSize(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin) {
        String user = fixtures.newUser("bob");
        if (!webAdmin.get("/quota").json().path("size").isNull()) {
            webAdmin.delete("/quota/size").expect(204);
        }
        GlobalQuotaPage quota = new GlobalQuotaPage(app).open();

        assertThat(quota.size()).hasText("not set");
        assertThat(quota.count()).isVisible();
        assertThat(quota.button("Update size limit")).isVisible();
        assertThat(quota.button("Remove size limit")).hasCount(0);

        quota.updateSize("10", "GB");
        expectSlowToast(app, "Global quota size updated");
        assertThat(quota.size()).hasText("10.0 GB");
        assertThat(quota.button("Remove size limit")).isVisible();
        assertThat(webAdmin.get("/quota").json().path("size").asLong()).isEqualTo(10 * GB);

        MailUserDetailPage detail = new MailUserDetailPage(app).open(user);
        detail.toggle("Quota");
        assertThat(globalRow(app)).containsText("10.0 GB");

        quota.open();
        quota.button("Remove size limit").click();
        assertThat(app.dialog().getByRole(AriaRole.HEADING)).hasText("Remove size limit");
        assertThat(app.dialog()).containsText("Remove the global quota size limit? Users without a domain or user "
            + "specific limit will have unlimited storage.");
        app.cancel();
        assertThat(quota.size()).hasText("10.0 GB");
        assertThat(webAdmin.get("/quota").json().path("size").asLong()).isEqualTo(10 * GB);

        quota.button("Remove size limit").click();
        app.confirm();
        expectSlowToast(app, "Global quota size limit removed");
        assertThat(quota.size()).hasText("not set");
        assertThat(quota.button("Remove size limit")).hasCount(0);
        assertThat(webAdmin.get("/quota").json().path("size").isNull()).isTrue();

        detail.open(user);
        detail.toggle("Quota");
        assertThat(app.main().getByText("Per user limit")).isVisible();
        // The Global row reads "not set", or is left out when WebAdmin has no global quota at all
        assertThat(app.main().getByText("10.0 GB")).hasCount(0);

        quota.open();
        quota.updateSize("-1", "GB");
        expectSlowToast(app, "Global quota size updated");
        assertThat(quota.size()).hasText("unlimited");
        assertThat(webAdmin.get("/quota").json().path("size").asLong()).isEqualTo(-1);
    }

    @Test
    @DisplayName("GQ-02 Quota reports: specific quotas, aggregated extras, usage, explorer")
    void quotaReports(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin, Page page) {
        String user = userAtOneThird(fixtures, webAdmin);

        List<String> reports = new CopyOnWriteArrayList<>();
        page.onRequest(request -> {
            if (request.url().contains("/reports/quota/")) {
                reports.add(request.url());
            }
        });
        GlobalQuotaPage quota = new GlobalQuotaPage(app).open();
        // The reports scan every user: they are only fetched when their section is opened
        assertThat(quota.toggle("Aggregated extra quotas")).isVisible();
        assertThat(quota.toggle("Users with specific quotas")).isVisible();
        assertThat(reports).isEmpty();

        Response sumResponse = page.waitForResponse(
            response -> response.url().contains("/reports/quota/users/sum"),
            () -> quota.toggle("Aggregated extra quotas").click());
        JsonNode sum = parse(sumResponse.text());
        Locator extra = quota.aggregatedExtra();
        assertThat(GlobalQuotaPage.value(extra, "Total extra storage:")).hasText(formatSize(sum.path("totalExtraStorageLimit")));
        assertThat(GlobalQuotaPage.value(extra, "Total extra count:")).hasText(formatCount(sum.path("totalExtraCountLimit")));
        assertThat(GlobalQuotaPage.value(extra, "Users with unlimited storage:")).hasText(sum.path("totalUnlimitedStorage").asText());
        assertThat(GlobalQuotaPage.value(extra, "Users with unlimited count:")).hasText(sum.path("totalUnlimitedCount").asText());

        quota.toggle("Users with specific quotas").click();
        assertThat(quota.toggle("Users with specific quotas (")).isVisible();
        Locator link = app.main().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName(user).setExact(true));
        Locator next = app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Next").setExact(true));
        while (link.count() == 0 && next.count() > 0 && next.first().isEnabled()) {
            next.first().click();
        }
        assertThat(link).isVisible();
        assertThat(link).hasAttribute("href", MailUserDetailPage.path(user));
        Locator row = link.locator("xpath=../..");
        assertThat(row).containsText("Count: 3");
        assertThat(row).containsText("Size: 50.0 MB");

        quota.toggle("Global resource usage").click();
        Locator usedSize = app.main().getByText("Size:", new Locator.GetByTextOptions().setExact(true))
            .locator("xpath=following-sibling::*[1]");
        assertThat(usedSize).hasText(Pattern.compile("^[1-9][\\d,.]* (B|KB|MB|GB)$"));
        assertThat(app.main().getByText("Count:", new Locator.GetByTextOptions().setExact(true))
            .locator("xpath=following-sibling::*[1]")).hasText(Pattern.compile("^[1-9][\\d,]*$"));

        quota.toggle("Explore User Quota").click();
        explore(quota, "33", "34");
        Locator found = app.main().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName(user).setExact(true)).last();
        assertThat(found.locator("xpath=..")).containsText("33.3%");
                explore(quota, "0", "100");
        assertThat(app.main().getByText(Pattern.compile("^Page 1 — \\d+ result\\(s\\)$"))).isVisible();
        explore(quota, "61.37", "61.38");
        assertThat(app.main().getByText("No users found in this occupation range.")).isVisible();
    }

    @Test
    @DisplayName("GQ-03 Explore User Quota: occupation range validation")
    void exploreUserQuotaRangeValidation(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin, Page page) {
        String user = userAtOneThird(fixtures, webAdmin);
        GlobalQuotaPage quota = new GlobalQuotaPage(app).open();
        List<String> searches = new CopyOnWriteArrayList<>();
        page.onRequest(request -> {
            if (request.url().contains("/quota/users?")) {
                searches.add(request.url());
            }
        });

        quota.toggle("Explore User Quota").click();
        assertThat(quota.minOccupation()).hasValue("80");
        assertThat(quota.maxOccupation()).hasValue("100");
        Locator percentError = app.main().getByText("Enter a percentage between 0 and 100.");
        Locator orderError = app.main().getByText("Must not be lower than the min occupation.");

        explore(quota, "-5", "150");
        assertThat(percentError).hasCount(2);
        assertThat(quota.minOccupation()).hasAttribute("aria-invalid", "true");
        assertThat(quota.maxOccupation()).hasAttribute("aria-invalid", "true");

        explore(quota, "80", "20");
        assertThat(percentError).hasCount(0);
        assertThat(orderError).isVisible();
        assertThat(quota.minOccupation()).hasAttribute("aria-invalid", "false");
        assertThat(quota.maxOccupation()).hasAttribute("aria-invalid", "true");
        assertThat(quota.maxOccupation()).hasAttribute("aria-describedby", orderError.getAttribute("id"));

        explore(quota, "", "100");
        assertThat(percentError).hasCount(1);
        assertThat(quota.minOccupation()).hasAttribute("aria-invalid", "true");
        assertThat(searches).isEmpty();
        assertThat(app.main().getByText("Request failed with status code 400")).hasCount(0);

        explore(quota, "33", "34");
        assertThat(percentError).hasCount(0);
        assertThat(orderError).hasCount(0);
        Locator found = app.main().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName(user).setExact(true));
        assertThat(found.locator("xpath=..")).containsText("33.3%");
        assertThat(searches).hasSize(1);
        assertThat(searches.get(0)).contains("minOccupationRatio=0.33").contains("maxOccupationRatio=0.34");

        explore(quota, "61.37", "61.38");
        assertThat(app.main().getByText("No users found in this occupation range.")).isVisible();
        assertThat(found).hasCount(0);
    }

    /** A user with a specific quota (3 messages, 50 MB) holding 1 message: occupation ratio 33.3 %. */
    private static String userAtOneThird(MailFixtures fixtures, WebAdmin webAdmin) {
        String user = fixtures.newUser("quota");
        webAdmin.put("/quota/users/" + user + "/count", "3").expect(204);
        webAdmin.put("/quota/users/" + user + "/size", String.valueOf(50 * MB)).expect(204);
        fixtures.sendMail("sender@e2e.test", user, "Quota filler", "hello");
        // The occupation ratio is indexed asynchronously
        Awaitility.await().atMost(Duration.ofSeconds(30)).pollInterval(Duration.ofMillis(500)).until(() ->
            webAdmin.get("/quota/users?minOccupationRatio=0.33&maxOccupationRatio=0.34&limit=500").body().contains(user));
        return user;
    }

    private static void explore(GlobalQuotaPage quota, String min, String max) {
        quota.minOccupation().fill(min);
        quota.maxOccupation().fill(max);
        quota.searchButton().click();
    }

    /**
     * On the shared stack (hundreds of users) tmail-backend took 7 to 25 s to answer PUT /quota and
     * DELETE /quota/size (measured with curl), beyond the default timeout: wait for the outcome accordingly.
     */
    private static void expectSlowToast(AdminApp app, String text) {
        assertThat(app.toast(text)).isVisible(new com.microsoft.playwright.assertions.LocatorAssertions.IsVisibleOptions()
            .setTimeout(SLOW_WRITE_MS));
    }

    private static Locator globalRow(AdminApp app) {
        return app.main().getByText("Global", new Locator.GetByTextOptions().setExact(true)).locator("xpath=..");
    }

    private static JsonNode parse(String json) {
        try {
            return WebAdmin.JSON.readTree(json);
        } catch (java.io.IOException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String formatSize(JsonNode bytes) {
        if (bytes.isNull()) {
            return "not set";
        }
        long value = bytes.asLong();
        if (value == -1) {
            return "unlimited";
        }
        String[] units = {"B", "KB", "MB", "GB"};
        int exponent = value >= GB ? 3 : value >= MB ? 2 : value >= 1024 ? 1 : 0;
        if (exponent == 0) {
            return String.format(Locale.US, "%,d B", value);
        }
        return String.format(Locale.US, "%,.1f %s", value / Math.pow(1024, exponent), units[exponent]);
    }

    private static String formatCount(JsonNode count) {
        if (count.isNull()) {
            return "not set";
        }
        return count.asLong() == -1 ? "unlimited" : String.format(Locale.US, "%,d", count.asLong());
    }
}
