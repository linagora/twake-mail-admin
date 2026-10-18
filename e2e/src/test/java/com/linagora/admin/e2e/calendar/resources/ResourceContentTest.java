package com.linagora.admin.e2e.calendar.resources;

import static com.linagora.admin.e2e.calendar.resources.DomainCalendarsBackend.DOMAIN;
import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.time.Duration;
import java.util.regex.Pattern;

import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.linagora.admin.e2e.CalendarAdminE2ETest;
import com.linagora.admin.e2e.backend.CalendarFixtures;
import com.linagora.admin.e2e.backend.Ids;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.calendar.resources.CalendarDomainPage;
import com.linagora.admin.e2e.pages.calendar.resources.DomainCalendarRow;
import com.microsoft.playwright.Download;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.assertions.LocatorAssertions;
import com.microsoft.playwright.options.AriaRole;

/** Content and visibility of a calendar resource: import, count, export, public right (RES-05, RES-06). */
class ResourceContentTest extends CalendarAdminE2ETest {
    private DomainCalendarsBackend backend;

    @BeforeEach
    void setUp(WebAdmin webAdmin) {
        backend = new DomainCalendarsBackend(webAdmin);
    }

    @AfterEach
    void tearDown() {
        backend.cleanUp();
    }

    @Test
    @DisplayName("RES-05 Import events into a resource, count and export")
    void importCountAndExportResourceEvents(AdminApp app, CalendarFixtures fixtures) throws IOException {
        String suffix = Ids.suffix(6);
        String name = "QA Room " + suffix;
        String id = backend.createResource(name, "events " + suffix, "laptop", fixtures.newRegisteredUser("creator"));
        String uid = DomainCalendarsBackend.uid();

        DomainCalendarRow row = CalendarDomainPage.open(app, DOMAIN).resources().search(name).row(name);
        assertThat(row.eventCount()).hasText("0");

        row.importIcs(DomainCalendarsBackend.ics(uid));
        assertThat(row.importButton()).isDisabled();
        assertThat(app.toast("Task created")).isVisible();
        assertThat(app.toast("Task created").getByRole(AriaRole.LINK, new Locator.GetByRoleOptions()
            .setName(Pattern.compile("^Task [0-9a-f-]+$")))).isVisible();
        assertThat(row.importButton()).isEnabled(new LocatorAssertions.IsEnabledOptions().setTimeout(60_000));
        assertThat(row.eventCount()).hasText("1", new LocatorAssertions.HasTextOptions().setTimeout(20_000));
        Awaitility.await().atMost(Duration.ofSeconds(20)).until(() -> backend.eventCount("resources", id) == 1);

        Download download = row.export();
        assertThat(download.suggestedFilename()).isEqualTo(name.replace(' ', '_') + ".ics");
        assertThat(Files.readString(download.path(), StandardCharsets.UTF_8)).contains("UID:" + uid);
        assertThat(app.toast("Error exporting calendar")).isHidden();
    }

    @Test
    @DisplayName("RES-06 Resource public visibility")
    void resourcePublicVisibility(AdminApp app, CalendarFixtures fixtures) {
        String name = "QA Room " + Ids.suffix(6);
        backend.createResource(name, "visibility " + Ids.suffix(8), "laptop", fixtures.newRegisteredUser("creator"));

        DomainCalendarRow row = CalendarDomainPage.open(app, DOMAIN).resources().search(name).row(name);
        VisibilityChecks.makePublicThenPrivate(app, row);
    }
}
