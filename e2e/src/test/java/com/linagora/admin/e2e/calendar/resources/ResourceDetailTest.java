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
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

/** The detail page of a calendar resource: edit, administrators (RES-02, RES-03). */
class ResourceDetailTest extends CalendarAdminE2ETest {
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
    @DisplayName("RES-02 Resource detail and edit")
    void resourceDetailAndEdit(AdminApp app, Page page, CalendarFixtures fixtures) {
        String creator = fixtures.newRegisteredUser("creator");
        String suffix = Ids.suffix(6);
        String name = "QA Room " + suffix;
        String description = "Meeting room " + suffix;
        String id = backend.createResource(name, description, "laptop", creator);

        CalendarDomainPage.open(app, DOMAIN).resources().search(name).link(name).click();

        ResourceDetailPage detail = new ResourceDetailPage(app);
        assertThat(page).hasURL(Pattern.compile("/domains/domain/" + DOMAIN.replace(".", "\\.") + "/resource/" + id + "$"));
        assertThat(detail.heading(name)).isVisible();
        assertThat(detail.field("Name", name)).isVisible();
        assertThat(detail.field("Resource ID", id)).isVisible();
        assertThat(detail.field("Domain", DOMAIN)).isVisible();
        assertThat(detail.field("Description", description)).isVisible();
        assertThat(detail.field("Icon", "laptop")).isVisible();
        assertThat(detail.field("Icon", "laptop").getByRole(AriaRole.IMG, new Locator.GetByRoleOptions().setName("laptop"))).isVisible();
        assertThat(detail.field("Creator", creator)).isVisible();
        assertThat(app.main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions()
            .setName("Administrators").setExact(true))).isVisible();

        // Edit and save
        String newName = "QA Room 2 " + suffix;
        String newDescription = "Board room " + suffix;
        detail.edit();
        assertThat(detail.nameBox()).hasValue(name);
        assertThat(detail.descriptionBox()).hasValue(description);
        assertThat(detail.iconPicker().trigger()).hasAccessibleName("Icon Laptop");
        detail.nameBox().fill("");
        assertThat(detail.saveButton()).isDisabled();
        detail.nameBox().fill(newName);
        detail.descriptionBox().fill(newDescription);
        detail.iconPicker().pick("Camera");
        detail.saveButton().click();

        app.expectToast("Calendar resource updated");
        assertThat(detail.heading(newName)).isVisible();
        assertThat(detail.field("Name", newName)).isVisible();
        assertThat(detail.field("Description", newDescription)).isVisible();
        assertThat(detail.field("Icon", "camera")).isVisible();
        JsonNode saved = backend.resource(id);
        assertThat(saved.path("name").asText()).isEqualTo(newName);
        assertThat(saved.path("description").asText()).isEqualTo(newDescription);
        assertThat(saved.path("icon").asText()).isEqualTo("camera");

        // Cancel discards the edit
        detail.edit();
        detail.nameBox().fill("Discarded " + suffix);
        detail.cancelButton().click();
        assertThat(detail.nameBox()).isHidden();
        assertThat(detail.field("Name", newName)).isVisible();
        assertThat(backend.resource(id).path("name").asText()).isEqualTo(newName);
    }

    @Test
    @DisplayName("RES-03 Manage resource administrators")
    void manageResourceAdministrators(AdminApp app, CalendarFixtures fixtures) {
        String creator = fixtures.newRegisteredUser("creator");
        String administrator = fixtures.newRegisteredUser("charlotte");
        String name = "QA Room " + Ids.suffix(6);
        String id = backend.createResource(name, "admins " + Ids.suffix(8), "laptop", creator);

        ResourceDetailPage detail = ResourceDetailPage.open(app, DOMAIN, id);
        assertThat(detail.heading(name)).isVisible();

        detail.addAdministrator(administrator);
        app.expectToast("Administrator added");
        assertThat(detail.administrator(administrator)).isVisible();
        assertThat(DomainCalendarsBackend.administrators(backend.resource(id))).containsExactly(administrator);

        // Adding the same address again is refused, without a duplicate
        detail.addAdministrator(administrator);
        app.expectToast("Administrator already in the list");
        assertThat(detail.administratorEntries(administrator)).hasCount(1);
        assertThat(DomainCalendarsBackend.administrators(backend.resource(id))).containsExactly(administrator);

        detail.administrator(administrator).getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions()
            .setName("Remove administrator").setExact(true)).click();
        assertThat(app.dialog()).containsText("Remove \"" + administrator + "\" from administrators?");
        app.confirm();
        app.expectToast("Administrator removed");
        assertThat(detail.administratorEntries(administrator)).hasCount(0);
        assertThat(DomainCalendarsBackend.administrators(backend.resource(id))).isEmpty();
    }
}
