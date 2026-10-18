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
 * Settings are stored per domain and the side service keeps them for any domain of WebAdmin: each
 * test changes the settings of a domain of its own, never those of open-paas.org that other tests
 * (user search, public visibility) depend on.
 */
class DomainSettingsTest extends CalendarAdminE2ETest {
    private static final String USER_SEARCH = "User search mode";
    private static final String RESOURCE_SEARCH = "Resource search";
    private static final String VISIBILITY = "Default calendar public visibility";
    private static final String VISIBILITY_SETTING = "Allow users to manage Calendar public visibility setting";

    @Test
    @DisplayName("DSET-01 View and change domain settings")
    void viewAndChangeDomainSettings(AdminApp app, Page page, CalendarFixtures fixtures, WebAdmin webAdmin) {
        String domain = fixtures.newDomain("settings");
        CalendarDomainPage detail = new CalendarDomainPage(app).open(domain).expand(CalendarDomainPage.SETTINGS);

        for (String setting : List.of(USER_SEARCH, RESOURCE_SEARCH, VISIBILITY, VISIBILITY_SETTING)) {
            assertThat(detail.setting(setting)).hasText("Use system default");
        }
        assertThat(detail.effectiveValues()).hasText(new String[] {
            USER_SEARCH + "Enabled", RESOURCE_SEARCH + "Enabled", VISIBILITY + "Private", VISIBILITY_SETTING + "Enabled"});
        assertThat(detail.settingsButton("Save")).hasCount(0);
        assertThat(detail.settingsButton("Cancel")).hasCount(0);

        detail.choose(USER_SEARCH, "Limited");
        assertThat(detail.settingsButton("Save")).isVisible();
        assertThat(detail.settingsButton("Cancel")).isVisible();
        detail.choose(VISIBILITY, "Read");
        detail.settingsButton("Save").click();

        app.expectToast("Domain settings saved");
        assertThat(detail.effectiveValues()).hasText(new String[] {
            USER_SEARCH + "Limited", RESOURCE_SEARCH + "Enabled", VISIBILITY + "Read", VISIBILITY_SETTING + "Enabled"});
        assertThat(detail.settingsButton("Save")).hasCount(0);
        JsonNode stored = webAdmin.get("/domains/" + domain + "/settings").expect(200).json();
        assertThat(stored.path("userSearchMode").asText()).isEqualTo("limited");
        assertThat(stored.path("defaultCalendarPublicVisibility").asText()).isEqualTo("read");
        assertThat(stored.path("resourceSearchEnabled").isNull()).isTrue();
        assertThat(stored.path("calendarPublicVisibilitySettingEnabled").isNull()).isTrue();

        page.reload();
        detail.expand(CalendarDomainPage.SETTINGS);
        assertThat(detail.setting(USER_SEARCH)).hasText("Limited");
        assertThat(detail.setting(VISIBILITY)).hasText("Read");
        assertThat(detail.setting(RESOURCE_SEARCH)).hasText("Use system default");
        assertThat(detail.effectiveValues()).hasText(new String[] {
            USER_SEARCH + "Limited", RESOURCE_SEARCH + "Enabled", VISIBILITY + "Read", VISIBILITY_SETTING + "Enabled"});
    }

    @Test
    @DisplayName("DSET-02 Cancel and back to system default")
    void cancelAndBackToSystemDefault(AdminApp app, Page page, CalendarFixtures fixtures, WebAdmin webAdmin) {
        String domain = fixtures.newDomain("settings");
        webAdmin.put("/domains/" + domain + "/settings", "{\"userSearchMode\":\"limited\",\"resourceSearchEnabled\":null,"
            + "\"defaultCalendarPublicVisibility\":\"read\",\"calendarPublicVisibilitySettingEnabled\":null}").expect(204);
        List<String> writes = new CopyOnWriteArrayList<>();
        page.onRequest(request -> {
            if ("PUT".equals(request.method()) && request.url().contains("/settings")) {
                writes.add(request.postData());
            }
        });
        CalendarDomainPage detail = new CalendarDomainPage(app).open(domain).expand(CalendarDomainPage.SETTINGS);
        assertThat(detail.setting(USER_SEARCH)).hasText("Limited");

        detail.choose(RESOURCE_SEARCH, "Disabled");
        detail.settingsButton("Cancel").click();
        assertThat(detail.setting(RESOURCE_SEARCH)).hasText("Use system default");
        assertThat(detail.settingsButton("Save")).hasCount(0);
        assertThat(detail.settingsButton("Cancel")).hasCount(0);
        assertThat(writes).isEmpty();

        detail.choose(USER_SEARCH, "Use system default");
        detail.settingsButton("Save").click();

        app.expectToast("Domain settings saved");
        assertThat(detail.effectiveValues().first()).hasText(USER_SEARCH + "Enabled");
        assertThat(detail.setting(VISIBILITY)).hasText("Read");
        JsonNode stored = webAdmin.get("/domains/" + domain + "/settings").expect(200).json();
        assertThat(stored.path("userSearchMode").isNull()).isTrue();
        assertThat(stored.path("resolved").path("userSearchMode").asText()).isEqualTo("enabled");
        assertThat(stored.path("defaultCalendarPublicVisibility").asText()).isEqualTo("read");
        assertThat(writes).hasSize(1);
    }
}
