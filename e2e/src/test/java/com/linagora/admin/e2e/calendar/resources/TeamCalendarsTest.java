package com.linagora.admin.e2e.calendar.resources;

import static com.linagora.admin.e2e.calendar.resources.DomainCalendarsBackend.DOMAIN;
import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.linagora.admin.e2e.CalendarAdminE2ETest;
import com.linagora.admin.e2e.backend.Ids;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.calendar.resources.CalendarDomainPage;
import com.linagora.admin.e2e.pages.calendar.resources.DomainCalendarRow;
import com.linagora.admin.e2e.pages.calendar.resources.PublicVisibilityDialog;
import com.linagora.admin.e2e.pages.calendar.resources.TeamCalendarsSection;

/** Team calendars of open-paas.org: create, rename, delete, visibility and search (TCAL-01, 02, 04, 06). */
class TeamCalendarsTest extends CalendarAdminE2ETest {
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
    @DisplayName("TCAL-01 Create a team calendar")
    void createTeamCalendar(AdminApp app) {
        String suffix = Ids.suffix(6);
        String first = "qa-team-" + suffix + "-a";
        String firstDisplayName = "QA Team " + suffix;
        String second = "qa-team-" + suffix + "-b";

        TeamCalendarsSection section = CalendarDomainPage.open(app, DOMAIN).teamCalendars();
        section.create(first, firstDisplayName);
        backend.teamCalendarNamed(first).ifPresent(t -> backend.trackTeamCalendar(t.path("id").asText()));
        section.create(second, null);
        backend.teamCalendarNamed(second).ifPresent(t -> backend.trackTeamCalendar(t.path("id").asText()));

        // Sorted by name; the display name defaults to the name, then it is not repeated
        section.search(suffix);
        assertThat(section.rowTitles()).containsText(new String[] {first, second});
        assertThat(section.rowTitles().first()).containsText(firstDisplayName);
        assertThat(section.rowTitles().nth(1)).hasText("2/" + second);
        for (String name : new String[] {first, second}) {
            DomainCalendarRow row = section.row(name);
            assertThat(row.eventCount()).isVisible();
            assertThat(row.exportButton()).isVisible();
            assertThat(row.importButton()).isVisible();
            assertThat(row.visibilityButton()).isVisible();
            assertThat(row.button("Manage members")).isVisible();
            assertThat(row.button("Edit display name")).isVisible();
            assertThat(row.button("Delete team calendar")).isVisible();
        }

        JsonNode firstCreated = backend.teamCalendarNamed(first).orElseThrow();
        assertThat(firstCreated.path("displayName").asText()).isEqualTo(firstDisplayName);
        JsonNode secondCreated = backend.teamCalendarNamed(second).orElseThrow();
        assertThat(secondCreated.path("displayName").asText()).isEqualTo(second);
    }

    @Test
    @DisplayName("TCAL-02 Edit a team calendar display name")
    void editTeamCalendarDisplayName(AdminApp app) {
        String suffix = Ids.suffix(6);
        String name = "qa-team-" + suffix;
        String id = backend.createTeamCalendar(name, "QA Team " + suffix);
        String renamed = "QA Team Renamed " + suffix;

        TeamCalendarsSection section = CalendarDomainPage.open(app, DOMAIN).teamCalendars().search(name);

        // Enter saves
        section.row(name).button("Edit display name").click();
        assertThat(section.editDisplayNameBox(name)).hasValue("QA Team " + suffix);
        section.editDisplayNameBox(name).fill(renamed);
        section.editDisplayNameBox(name).press("Enter");
        app.expectToast("Team calendar updated");
        assertThat(section.editDisplayNameBox(name)).isHidden();
        assertThat(section.row(name).root()).containsText(renamed);
        assertThat(backend.teamCalendar(id).orElseThrow().path("displayName").asText()).isEqualTo(renamed);

        // Escape cancels
        section.row(name).button("Edit display name").click();
        section.editDisplayNameBox(name).fill("Discarded " + suffix);
        section.editDisplayNameBox(name).press("Escape");
        assertThat(section.editDisplayNameBox(name)).isHidden();
        assertThat(section.row(name).root()).containsText(renamed);
        assertThat(backend.teamCalendar(id).orElseThrow().path("displayName").asText()).isEqualTo(renamed);

        // An empty display name cannot be saved
        section.row(name).button("Edit display name").click();
        section.editDisplayNameBox(name).fill("");
        assertThat(section.row(name).button("Save")).isDisabled();
    }

    @Test
    @DisplayName("TCAL-04 Delete a team calendar")
    void deleteTeamCalendar(AdminApp app) {
        String name = "qa-team2-" + Ids.suffix(6);
        String id = backend.createTeamCalendar(name, name);

        TeamCalendarsSection section = CalendarDomainPage.open(app, DOMAIN).teamCalendars().search(name);
        section.row(name).button("Delete team calendar").click();
        assertThat(app.dialog()).containsText("Delete team calendar \"" + name + "\"?");
        app.confirm();

        app.expectToast("Team calendar deleted");
        assertThat(section.rowTitles()).hasCount(0);
        assertThat(backend.teamCalendar(id)).isEmpty();
    }

    @Test
    @DisplayName("TCAL-06 Team calendar public visibility and search")
    void teamCalendarPublicVisibilityAndSearch(AdminApp app) {
        String suffix = Ids.suffix(6);
        String name = "qa-team-" + suffix;
        // A display name word the name does not hold: the search must match display names too
        String marker = Ids.suffix(6);
        String displayName = "QA Team Renamed " + marker;
        backend.createTeamCalendar(name, displayName);

        TeamCalendarsSection section = CalendarDomainPage.open(app, DOMAIN).teamCalendars().search(name);
        PublicVisibilityDialog dialog = section.row(name, displayName).openVisibility();
        VisibilityChecks.expectNothingPreselected(dialog);
        VisibilityChecks.choose(app, dialog, dialog.publicOption());

        // Search matches the display name, and the name
        section.search("renamed " + marker);
        assertThat(section.rowTitles()).hasCount(1);
        assertThat(section.rowTitles()).containsText(name);
        section.search(suffix);
        assertThat(section.rowTitles()).containsText(new String[] {name});
        section.search("zzz" + Ids.suffix(8));
        assertThat(section.noSearchResults()).isVisible();
        assertThat(section.rowTitles()).hasCount(0);
    }
}
