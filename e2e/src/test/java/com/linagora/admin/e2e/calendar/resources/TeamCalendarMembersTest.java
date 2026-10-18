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

import com.fasterxml.jackson.databind.JsonNode;
import com.linagora.admin.e2e.CalendarAdminE2ETest;
import com.linagora.admin.e2e.backend.CalendarFixtures;
import com.linagora.admin.e2e.backend.Ids;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.calendar.resources.CalendarDomainPage;
import com.linagora.admin.e2e.pages.calendar.resources.DomainCalendarRow;
import com.linagora.admin.e2e.pages.calendar.resources.MembersDialog;
import com.linagora.admin.e2e.pages.calendar.resources.TeamCalendarsSection;
import com.microsoft.playwright.Download;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.assertions.LocatorAssertions;
import com.microsoft.playwright.options.AriaRole;

/** Members and content of a team calendar (TCAL-03, TCAL-05). */
class TeamCalendarMembersTest extends CalendarAdminE2ETest {
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
    @DisplayName("TCAL-03 Manage team calendar members")
    void manageTeamCalendarMembers(AdminApp app, CalendarFixtures fixtures) {
        String alice = fixtures.newRegisteredUser("alice");
        String bob = fixtures.newRegisteredUser("bob");
        String suffix = Ids.suffix(6);
        String name = "qa-team-" + suffix;
        String displayName = "QA Team " + suffix;
        String id = backend.createTeamCalendar(name, displayName);

        TeamCalendarsSection section = CalendarDomainPage.open(app, DOMAIN).teamCalendars().search(name);
        MembersDialog members = section.openMembers(name, displayName);
        assertThat(members.root()).isVisible();
        assertThat(members.root()).containsText("No member.");
        assertThat(members.applyButton()).isDisabled();

        // Stage two additions, then apply
        members.stage(alice, "Viewer");
        assertThat(members.member(alice)).containsText("Viewer");
        assertThat(members.applyButton()).isEnabled();
        members.stage(bob, "Manager");
        assertThat(members.member(bob)).containsText("Manager");
        members.applyButton().click();

        app.expectToast("Members updated");
        assertThat(members.roleOf(alice)).hasValue("viewer");
        assertThat(members.roleOf(bob)).hasValue("manager");
        assertThat(members.applyButton()).isDisabled();

        // An existing member cannot be added again
        members.emailBox().fill(alice);
        assertThat(members.root().getByText("Already a member", new Locator.GetByTextOptions().setExact(true))).isVisible();
        assertThat(members.addButton()).isDisabled();
        members.emailBox().fill("");

        // Change a role, remove a member, apply
        members.roleOf(alice).selectOption("member");
        members.member(bob).getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Remove").setExact(true)).click();
        assertThat(members.memberAddress(bob)).hasCSS("text-decoration-line", "line-through");
        assertThat(members.member(bob).getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions()
            .setName("Undo removal").setExact(true))).isVisible();
        assertThat(members.roleOf(bob)).isDisabled();
        members.applyButton().click();

        app.expectToast("Members updated");
        assertThat(members.memberAddress(bob)).hasCount(0);
        assertThat(members.roleOf(alice)).hasValue("member");

        JsonNode saved = backend.members(id);
        assertThat(saved).hasSize(1);
        assertThat(saved.get(0).path("username").asText()).isEqualTo(alice);
        assertThat(saved.get(0).path("role").asText()).isEqualTo("member");
    }

    @Test
    @DisplayName("TCAL-05 Import, count and export team calendar events")
    void importCountAndExportTeamCalendarEvents(AdminApp app) throws IOException {
        String suffix = Ids.suffix(6);
        String name = "qa-team-" + suffix;
        String displayName = "QA Team " + suffix;
        String id = backend.createTeamCalendar(name, displayName);
        String uid = DomainCalendarsBackend.uid();

        DomainCalendarRow row = CalendarDomainPage.open(app, DOMAIN).teamCalendars().search(name).row(name);
        assertThat(row.eventCount()).hasText("0");

        row.importIcs(DomainCalendarsBackend.ics(uid));
        assertThat(app.toast("Task created")).isVisible();
        assertThat(app.toast("Task created").getByRole(AriaRole.LINK, new Locator.GetByRoleOptions()
            .setName(Pattern.compile("^Task [0-9a-f-]+$")))).isVisible();
        assertThat(row.importButton()).isEnabled(new LocatorAssertions.IsEnabledOptions().setTimeout(60_000));
        assertThat(row.eventCount()).hasText("1", new LocatorAssertions.HasTextOptions().setTimeout(20_000));
        Awaitility.await().atMost(Duration.ofSeconds(20)).until(() -> backend.eventCount("team-calendars", id) == 1);

        // Named after the display name
        Download download = row.export();
        assertThat(download.suggestedFilename()).isEqualTo(displayName.replace(' ', '_') + ".ics");
        assertThat(Files.readString(download.path(), StandardCharsets.UTF_8)).contains("UID:" + uid);
        assertThat(app.toast("Error exporting calendar")).isHidden();
    }
}
