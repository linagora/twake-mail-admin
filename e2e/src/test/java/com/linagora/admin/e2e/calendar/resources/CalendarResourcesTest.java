package com.linagora.admin.e2e.calendar.resources;

import static com.linagora.admin.e2e.calendar.resources.DomainCalendarsBackend.DOMAIN;
import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.regex.Pattern;

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
import com.linagora.admin.e2e.pages.calendar.resources.ResourceDetailPage;
import com.linagora.admin.e2e.pages.calendar.resources.ResourcesSection;
import com.microsoft.playwright.options.AriaRole;

/** Calendar resources of open-paas.org: creation, list, deletion (RES-01, RES-04, RES-07). */
class CalendarResourcesTest extends CalendarAdminE2ETest {
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
    @DisplayName("RES-01 Create a calendar resource")
    void createCalendarResource(AdminApp app, CalendarFixtures fixtures) {
        String creator = fixtures.newRegisteredUser("creator");
        String administrator = fixtures.newRegisteredUser("admin");
        String suffix = Ids.suffix(6);
        String name = "QA Room " + suffix;
        String description = "Meeting room " + suffix;

        ResourcesSection section = CalendarDomainPage.open(app, DOMAIN).resources().openCreateForm();

        // A modal, its fields named, not only by their placeholder
        assertThat(section.nameBox()).isVisible();
        assertThat(section.nameBox()).isFocused();
        assertThat(section.descriptionBox()).isVisible();
        assertThat(section.creatorBox()).isVisible();
        assertThat(section.administratorsBox()).isVisible();
        assertThat(section.createButton()).isDisabled();

        section.nameBox().fill(name);
        assertThat(section.createButton()).isDisabled();
        section.descriptionBox().fill(description);
        section.iconPicker().pick("Projector");
        section.creatorBox().fill(creator);
        assertThat(section.createButton()).isEnabled();

        section.administratorsBox().fill(administrator);
        section.addAdministratorButton().click();
        assertThat(section.stagedAdministrator(administrator)).isVisible();
        assertThat(section.administratorsBox()).hasValue("");

        section.createButton().click();
        app.expectToast("Calendar resource created");
        assertThat(section.form()).isHidden();

        JsonNode created = backend.activeResourceNamed(name).orElseThrow();
        backend.track(created.path("id").asText());
        assertThat(created.path("creator").asText()).isEqualTo(creator);
        assertThat(DomainCalendarsBackend.administrators(created)).containsExactly(administrator);
        assertThat(created.path("icon").asText()).isEqualTo("projector");
        assertThat(created.path("description").asText()).isEqualTo(description);

        assertThat(section.toggle()).hasAccessibleName(Pattern.compile("^Calendar Resources\\s*\\(\\d+\\)$"));
        section.search(name);
        var row = section.row(name);
        assertThat(row.root()).containsText("1/");
        assertThat(row.root()).containsText(description);
        assertThat(row.eventCount()).hasText("0");
        assertThat(row.exportButton()).isVisible();
        assertThat(row.importButton()).isVisible();
        assertThat(row.visibilityButton()).isVisible();
        assertThat(row.button("Delete resource")).isVisible();
    }

    @Test
    @DisplayName("RES-04 Delete a calendar resource")
    void deleteCalendarResource(AdminApp app, CalendarFixtures fixtures) {
        String name = "QA Delete Room " + Ids.suffix(6);
        String id = backend.createResource(name, "to delete " + Ids.suffix(8), "laptop", fixtures.newRegisteredUser("creator"));

        ResourcesSection section = CalendarDomainPage.open(app, DOMAIN).resources().search(name);
        section.clickDelete(name);
        assertThat(app.dialog()).containsText("Delete calendar resource \"" + name + "\"?");
        CalendarDomainPage.confirmWith(app, "Delete");

        app.expectToast("Calendar resource deleted");
        assertThat(section.link(name)).hasCount(0);
        assertThat(backend.isActive(id)).isFalse();
    }

    @Test
    @DisplayName("RES-07 Resources without a name or with an unknown icon")
    void resourcesWithoutNameOrWithUnknownIcon(AdminApp app, CalendarFixtures fixtures) {
        String creator = fixtures.newRegisteredUser("creator");
        String nameless = backend.createResource(null, "no name " + Ids.suffix(8), "laptop", creator);
        String oddName = "QA Odd Icon " + Ids.suffix(6);
        String odd = backend.createResource(oddName, "odd icon " + Ids.suffix(8), "not-an-icon", creator);

        // The domain page renders, the nameless resource is listed and found under its ID
        CalendarDomainPage domainPage = CalendarDomainPage.open(app, DOMAIN);
        ResourcesSection section = domainPage.resources().search(nameless.substring(6, 18));
        assertThat(section.link(nameless)).isVisible();

        // The odd icon is shown as text, without a broken image; Edit keeps it rather than replacing it with Home
        section.search(oddName);
        section.link(oddName).click();
        ResourceDetailPage detail = new ResourceDetailPage(app);
        assertThat(detail.heading(oddName)).isVisible();
        assertThat(detail.field("Icon", "not-an-icon")).isVisible();
        assertThat(detail.field("Icon", "not-an-icon").locator("img")).hasCount(0);
        detail.edit();
        assertThat(detail.iconPicker().trigger()).hasAccessibleName("Icon not-an-icon");
        detail.cancelButton().click();
        assertThat(detail.nameBox()).isHidden();

        // Both can be deleted, the nameless one is named by its ID
        section = CalendarDomainPage.open(app, DOMAIN).resources().search(nameless);
        section.clickDelete(nameless);
        assertThat(app.dialog()).containsText("Delete calendar resource \"" + nameless + "\"?");
        CalendarDomainPage.confirmWith(app, "Delete");
        app.expectToast("Calendar resource deleted");
        assertThat(section.link(nameless)).hasCount(0);

        section.search(oddName);
        section.clickDelete(oddName);
        CalendarDomainPage.confirmWith(app, "Delete");
        assertThat(section.link(oddName)).hasCount(0);

        assertThat(backend.isActive(nameless)).isFalse();
        assertThat(backend.isActive(odd)).isFalse();
    }
}
