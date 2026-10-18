package com.linagora.admin.e2e.mail.users;

import static com.linagora.admin.e2e.mail.users.UserDetailTest.texts;
import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.Ids;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.users.UserDetailPage;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

/** User detail: vacation, delegation, allowed From, identities, labels, JMAP settings, rate limits. */
class UserDetailSettingsTest extends MailAdminE2ETest {

    private static Locator label(Locator scope, String label) {
        return scope.getByLabel(label, new Locator.GetByLabelOptions().setExact(true));
    }

    @Test
    @DisplayName("UDT-08 Vacation: save and delete")
    void vacationSaveDelete(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin, Page page) {
        String charlotte = fixtures.newUser("charlotte");

        UserDetailPage detail = UserDetailPage.open(app, charlotte);
        Locator vacation = detail.expand("Vacation");
        vacation.getByRole(AriaRole.CHECKBOX, new Locator.GetByRoleOptions().setName("Enabled").setExact(true)).click();
        label(vacation, "From").fill("2026-12-01T08:00");
        label(vacation, "To").fill("2026-12-05T18:00");
        label(vacation, "Subject").fill("Out of office");
        label(vacation, "Text body").fill("Back soon");
        detail.button(vacation, "Save").click();
        app.expectToast("Vacation settings updated");

        JsonNode stored = webAdmin.get("/vacation/" + charlotte).expect(200).json();
        assertThat(stored.path("enabled").asBoolean()).isTrue();
        assertThat(stored.path("subject").asText()).isEqualTo("Out of office");
        assertThat(stored.path("textBody").asText()).isEqualTo("Back soon");
        // 08:00 in Paris in December (UTC+1) is 07:00Z
        assertThat(Instant.parse(stored.path("fromDate").asText())).isEqualTo(Instant.parse("2026-12-01T07:00:00Z"));
        assertThat(Instant.parse(stored.path("toDate").asText())).isEqualTo(Instant.parse("2026-12-05T17:00:00Z"));

        // Collapse and reopen: the values are reloaded identically
        detail.toggle("Vacation").click();
        assertThat(label(vacation, "From")).hasCount(0);
        detail.toggle("Vacation").click();
        assertVacationForm(vacation);

        page.reload();
        detail = UserDetailPage.open(app, charlotte);
        vacation = detail.expand("Vacation");
        assertVacationForm(vacation);

        detail.button(vacation, "Delete").click();
        assertThat(app.dialog()).containsText("Delete vacation settings for \"" + charlotte + "\"?");
        app.confirm();
        app.expectToast("Vacation settings deleted");
        assertThat(label(vacation, "Subject")).hasValue("");
        assertThat(label(vacation, "Text body")).hasValue("");
        assertThat(label(vacation, "From")).hasValue("");
        assertThat(vacation.getByRole(AriaRole.CHECKBOX, new Locator.GetByRoleOptions().setName("Enabled").setExact(true)))
            .not().isChecked();
        assertThat(webAdmin.get("/vacation/" + charlotte).expect(200).json().path("enabled").asBoolean()).isFalse();
    }

    private static void assertVacationForm(Locator vacation) {
        assertThat(vacation.getByRole(AriaRole.CHECKBOX, new Locator.GetByRoleOptions().setName("Enabled").setExact(true)))
            .isChecked();
        assertThat(label(vacation, "From")).hasValue("2026-12-01T08:00");
        assertThat(label(vacation, "To")).hasValue("2026-12-05T18:00");
        assertThat(label(vacation, "Subject")).hasValue("Out of office");
        assertThat(label(vacation, "Text body")).hasValue("Back soon");
    }

    @Test
    @DisplayName("UDT-09 Delegated users")
    void delegatedUsers(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin) {
        String bob = fixtures.newUser("bob");
        String alice = fixtures.newUser("alice");

        UserDetailPage detail = UserDetailPage.open(app, bob);
        assertThat(detail.toggle("Delegated Users", 0)).isVisible();
        Locator delegation = detail.expand("Delegated Users");
        assertThat(delegation.getByText("Users listed here can access " + bob + "'s data through delegation.")).isVisible();

        detail.button(delegation, "Add delegated user").click();
        delegation.getByPlaceholder("user@domain.tld").fill(alice);
        assertThat(delegation.getByText("User exists", new Locator.GetByTextOptions().setExact(true))).isVisible();
        detail.button(delegation, "Add").click();
        app.expectToast("Delegated user added");
        assertThat(detail.item(delegation, alice)).isVisible();
        assertThat(texts(webAdmin.get("/users/" + bob + "/authorizedUsers").expect(200).json(), null))
            .containsExactly(alice);

        detail.clickItemButton(delegation, alice, "Remove delegated user");
        app.confirm();
        app.expectToast("Delegated user removed");
        assertThat(delegation.getByText("No delegated users.")).isVisible();
        assertThat(webAdmin.get("/users/" + bob + "/authorizedUsers").expect(200).json()).isEmpty();
    }

    @Test
    @DisplayName("UDT-10 Allowed From headers")
    void allowedFromHeaders(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin, Page page) {
        String alice = fixtures.newUser("alice");

        UserDetailPage detail = UserDetailPage.open(app, alice);
        Locator allowedFrom = detail.expand("Allowed From Headers");
        assertThat(detail.items(allowedFrom)).hasText(new String[] {"1/" + alice});
        assertThat(allowedFrom.getByRole(AriaRole.BUTTON)).hasCount(1);

        String alias = Ids.unique("alice.qa") + "@" + fixtures.domain();
        webAdmin.put("/address/aliases/" + alice + "/sources/" + alias).expect(204);
        List<String> expected = texts(webAdmin.get("/users/" + alice + "/allowedFromHeaders").expect(200).json(), null);
        assertThat(expected).containsExactlyInAnyOrder(alice, alias);

        page.reload();
        detail = UserDetailPage.open(app, alice);
        assertThat(detail.toggle("Allowed From Headers", 2)).isVisible();
        allowedFrom = detail.expand("Allowed From Headers");
        for (String header : expected) {
            assertThat(detail.item(allowedFrom, header)).isVisible();
        }
        assertThat(detail.items(allowedFrom)).hasCount(expected.size());
    }

    @Test
    @DisplayName("UDT-11 JMAP identities: create, view, edit, delete")
    void jmapIdentities(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin) {
        String bob = fixtures.newUser("bob");
        String alice = fixtures.newUser("alice");

        UserDetailPage detail = UserDetailPage.open(app, bob);
        assertThat(detail.toggle("JMAP Identities", 1)).isVisible();
        Locator identities = detail.expand("JMAP Identities");
        detail.button(identities, "Create identity").click();
        label(identities, "Name").fill("Bob QA");
        label(identities, "Email").fill(bob);
        identities.getByText("Text Signature", new Locator.GetByTextOptions().setExact(true)).click();
        assertThat(label(identities, "Text Signature")).isFocused();
        label(identities, "Text Signature").fill("--bob");
        label(identities, "Sort Order").fill("5");
        detail.button(identities, "Create").click();
        app.expectToast("Identity created");
        assertThat(detail.toggle("JMAP Identities", 2)).isVisible();

        JsonNode created = identity(webAdmin, bob, "Bob QA");
        assertThat(created.path("email").asText()).isEqualTo(bob);
        assertThat(created.path("textSignature").asText()).isEqualTo("--bob");
        assertThat(created.path("sortOrder").asInt()).isEqualTo(5);
        String id = created.path("id").asText();

        identities.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Bob QA <" + bob + ">").setExact(true)).click();
        Locator view = app.dialog();
        assertThat(view.getByRole(AriaRole.HEADING)).hasText("Identity — Bob QA");
        assertThat(view).containsText("ID:" + id);
        assertThat(view).containsText("Name:Bob QA");
        assertThat(view).containsText("Email:" + bob);
        assertThat(view).containsText("May Delete:Yes");
        assertThat(view).containsText("Text Signature--bob");

        view.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Edit").setExact(true)).click();
        Locator edit = app.dialog();
        label(edit, "Name").fill("Bob QA edited");
        edit.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Save").setExact(true)).click();
        app.expectToast("Identity updated");
        assertThat(app.dialog()).isHidden();
        assertThat(identities.getByRole(AriaRole.BUTTON,
            new Locator.GetByRoleOptions().setName("Bob QA edited <" + bob + ">").setExact(true))).isVisible();
        assertThat(identity(webAdmin, bob, "Bob QA edited").path("id").asText()).isEqualTo(id);

        // The name of an identity is a button inside its heading: find the row by that button
        Locator identityRow = identities.locator("div")
            .filter(new Locator.FilterOptions().setHas(app.page().getByRole(AriaRole.BUTTON,
                new Page.GetByRoleOptions().setName("Bob QA edited <" + bob + ">").setExact(true))))
            .filter(new Locator.FilterOptions().setHas(app.page().getByRole(AriaRole.BUTTON,
                new Page.GetByRoleOptions().setName("Delete identity").setExact(true))))
            .last();
        detail.button(identityRow, "Delete identity").click();
        assertThat(app.dialog()).containsText("Delete identity \"Bob QA edited <" + bob + ">\"?");
        app.confirm();
        app.expectToast("Identity deleted");
        assertThat(detail.toggle("JMAP Identities", 1)).isVisible();
        assertThat(texts(webAdmin.get("/users/" + bob + "/identities").expect(200).json(), "id")).doesNotContain(id);

        // An address bob may not send from is refused
        detail.button(identities, "Create identity").click();
        label(identities, "Name").fill("Not bob");
        label(identities, "Email").fill(alice);
        detail.button(identities, "Create").click();
        app.expectToast("Error creating identity");
        assertThat(webAdmin.get("/users/" + bob + "/identities").expect(200).json()).hasSize(1);
    }

    private static JsonNode identity(WebAdmin webAdmin, String user, String name) {
        for (JsonNode identity : webAdmin.get("/users/" + user + "/identities").expect(200).json()) {
            if (identity.path("name").asText().equals(name)) {
                return identity;
            }
        }
        throw new AssertionError("No identity named " + name + " for " + user);
    }

    @Test
    @DisplayName("UDT-12 Labels: create, edit, delete")
    void labelsCreateEditDelete(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin) {
        String bob = fixtures.newUser("bob");

        UserDetailPage detail = UserDetailPage.open(app, bob);
        assertThat(detail.toggle("Labels", 0)).isVisible();
        Locator labels = detail.expand("Labels");
        detail.button(labels, "Create label").click();
        label(labels, "Display Name *").fill("Work");
        label(labels, "Color (optional)").fill("#ff0000");
        label(labels, "Description (optional)").fill("Work emails");
        detail.button(labels, "Create").click();
        app.expectToast("Label created");
        assertThat(detail.toggle("Labels", 1)).isVisible();
        JsonNode created = webAdmin.get("/users/" + bob + "/labels").expect(200).json().get(0);
        assertThat(created.path("displayName").asText()).isEqualTo("Work");
        assertThat(created.path("keyword").asText()).isNotBlank();
        assertThat(created.path("color").asText()).isEqualToIgnoringCase("#ff0000");
        Locator row = labels.getByRole(AriaRole.ROW).filter(new Locator.FilterOptions().setHasText("Work emails"));
        assertThat(row).containsText(created.path("keyword").asText());

        detail.button(row, "Edit label").click();
        Locator edit = app.dialog();
        assertThat(edit.getByRole(AriaRole.HEADING)).hasText("Edit Label — Work");
        label(edit, "Color").fill("#00ff00");
        detail.button(edit, "Save").click();
        app.expectToast("Label updated");
        assertThat(app.dialog()).isHidden();
        assertThat(row).containsText("#00ff00");
        assertThat(webAdmin.get("/users/" + bob + "/labels").expect(200).json().get(0).path("color").asText())
            .isEqualToIgnoringCase("#00ff00");

        detail.button(row, "Edit label").click();
        edit = app.dialog();
        assertThat(label(edit, "Color")).hasAttribute("placeholder", "#ff0000");
        label(edit, "Color").fill("");
        assertThat(edit.getByText("The colour of a label cannot be removed: the current colour (#00ff00) will be kept."))
            .isVisible();
        label(edit, "Description").fill("Work and projects");
        detail.button(edit, "Save").click();
        app.expectToast("Label updated");
        assertThat(app.dialog()).isHidden();
        row = labels.getByRole(AriaRole.ROW).filter(new Locator.FilterOptions().setHasText("Work and projects"));
        assertThat(row).containsText("#00ff00");
        JsonNode updated = webAdmin.get("/users/" + bob + "/labels").expect(200).json().get(0);
        assertThat(updated.path("description").asText()).isEqualTo("Work and projects");
        assertThat(updated.path("color").asText()).isEqualToIgnoringCase("#00ff00");

        detail.button(row, "Delete label").click();
        assertThat(app.dialog()).containsText("Delete label \"Work\"?");
        app.confirm();
        app.expectToast("Label deleted");
        assertThat(labels.getByText("No labels configured.")).isVisible();
        assertThat(webAdmin.get("/users/" + bob + "/labels").expect(200).json()).isEmpty();
    }

    @Test
    @DisplayName("UDT-13 JMAP settings: edit key/value pairs")
    void jmapSettings(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin, Page page) {
        String alice = fixtures.newUser("alice");

        UserDetailPage detail = UserDetailPage.open(app, alice);
        Locator settings = detail.expand("JMAP Settings");
        assertThat(detail.toggle("JMAP Settings", 0)).isVisible();
        Locator keys = settings.getByPlaceholder("e.g. language");
        Locator values = settings.getByPlaceholder("Value", new Locator.GetByPlaceholderOptions().setExact(true));

        detail.button(settings, "Add setting").click();
        keys.nth(0).fill("language");
        values.nth(0).fill("fr");
        detail.button(settings, "Save").click();
        app.expectToast("JMAP settings saved");
        assertThat(detail.toggle("JMAP Settings", 1)).isVisible();
        assertThat(webAdmin.get("/users/" + alice + "/jmap/settings").expect(200).json().path("language").asText())
            .isEqualTo("fr");

        detail.button(settings, "Add setting").click();
        keys.nth(1).fill("bad key!");
        values.nth(1).fill("x");
        detail.button(settings, "Save").click();
        assertThat(settings.getByText("Key must be non-empty, at most 255 characters, and contain only alphanumeric "
            + "characters, ., -, _, or #.")).isVisible();

        detail.button(settings, "Add setting").click();
        keys.nth(2).fill("language");
        values.nth(2).fill("en");
        detail.button(settings, "Save").click();
        assertThat(settings.getByText("Duplicate key", new Locator.GetByTextOptions().setExact(true))).isVisible();
        // Nothing was sent
        assertThat(webAdmin.get("/users/" + alice + "/jmap/settings").expect(200).json().size()).isEqualTo(1);

        Locator remove = settings.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Remove this entry").setExact(true));
        remove.nth(2).click();
        remove.nth(1).click();
        assertThat(remove).hasCount(1);
        detail.button(settings, "Add setting").click();
        keys.nth(1).fill("theme");
        values.nth(1).fill("dark");
        detail.button(settings, "Save").click();
        app.expectToast("JMAP settings saved");
        assertThat(detail.toggle("JMAP Settings", 2)).isVisible();

        page.reload();
        detail = UserDetailPage.open(app, alice);
        settings = detail.expand("JMAP Settings");
        assertThat(detail.toggle("JMAP Settings", 2)).isVisible();
        Locator reloadedKeys = settings.getByPlaceholder("e.g. language");
        assertThat(reloadedKeys).hasCount(2);
        assertThat(reloadedKeys.evaluateAll("inputs => inputs.map(input => input.value).sort().join(',')"))
            .isEqualTo("language,theme");
        JsonNode stored = webAdmin.get("/users/" + alice + "/jmap/settings").expect(200).json();
        assertThat(stored.path("language").asText()).isEqualTo("fr");
        assertThat(stored.path("theme").asText()).isEqualTo("dark");
    }

    @Test
    @DisplayName("UDT-14 User rate limits")
    void userRateLimits(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin) {
        String bob = fixtures.newUser("bob");

        UserDetailPage detail = UserDetailPage.open(app, bob);
        Locator rateLimits = detail.expand("Rate Limiting");
        for (String field : List.of("Mails sent / minute", "Mails sent / hour", "Mails sent / day",
            "Recipients sent / minute", "Recipients sent / hour", "Recipients sent / day",
            "Mails received / minute", "Mails received / hour", "Mails received / day")) {
            assertThat(label(rateLimits, field)).hasValue("");
        }
        label(rateLimits, "Mails received / hour").fill("100");
        detail.button(rateLimits, "Save").click();
        app.expectToast("Rate limits updated");
        assertThat(webAdmin.get("/users/" + bob + "/ratelimits").expect(200).json().path("mailsReceivedPerHours").asLong())
            .isEqualTo(100L);

        detail.toggle("Rate Limiting").click();
        assertThat(label(rateLimits, "Mails received / hour")).hasCount(0);
        detail.toggle("Rate Limiting").click();
        assertThat(label(rateLimits, "Mails received / hour")).hasValue("100");
        assertThat(label(rateLimits, "Mails sent / minute")).hasValue("");
    }
}
