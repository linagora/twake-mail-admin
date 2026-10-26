package com.linagora.admin.e2e.mail.userdetail;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.Ids;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.userdetail.MailUserDetailPage;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

class UserDetailSectionsTest extends MailAdminE2ETest {

    @Test
    @DisplayName("UDT-23 Mapping-related sections refresh together")
    void mappingSectionsRefreshTogether(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin) {
        String user = fixtures.newUser("alice");
        String david = fixtures.newUser("david");
        String alias = "alice.qa2-" + Ids.suffix(6) + "@" + fixtures.domain();
        MailUserDetailPage detail = new MailUserDetailPage(app).open(user);

        assertThat(detail.sectionToggle("Aliases", 0)).isVisible();
        assertThat(detail.sectionToggle("Mappings", 0)).isVisible();
        assertThat(detail.sectionToggle("Allowed From Headers", 1)).isVisible();
        detail.toggle("Aliases").toggle("Forwards").toggle("Mappings").toggle("Allowed From Headers");

        detail.iconButton("Add alias").click();
        detail.dialog().getByLabel("Alias address", new Locator.GetByLabelOptions().setExact(true)).fill(alias);
        dialogButton(detail, "Add").click();
        app.expectToast("Alias added successfully");

        // No reload: the other sections follow
        assertThat(detail.sectionToggle("Aliases", 1)).isVisible();
        assertThat(detail.sectionToggle("Mappings", 1)).isVisible();
        assertThat(detail.sectionToggle("Allowed From Headers", 2)).isVisible();
        assertThat(app.main().getByText("Sources pointing to this user")).isVisible();
        assertThat(app.main().getByText(alias)).hasCount(3);
        assertThat(webAdmin.get("/address/aliases/" + user).json().size()).isEqualTo(1);
        assertThat(webAdmin.get("/users/" + user + "/allowedFromHeaders").json().size()).isEqualTo(2);

        detail.iconButton("Remove all Alias sources").click();
        assertThat(app.dialog()).containsText("Remove all Alias sources of " + user + " (" + alias + ")?");
        detail.confirm("Remove");
        app.expectToast("Alias sources of " + user + " removed");
        assertThat(detail.sectionToggle("Aliases", 0)).isVisible();
        assertThat(app.main().getByText("No aliases configured.")).isVisible();
        assertThat(detail.sectionToggle("Allowed From Headers", 1)).isVisible();
        assertThat(detail.sectionToggle("Mappings", 0)).isVisible();
        assertThat(app.main().getByText(alias)).hasCount(0);
        assertThat(webAdmin.get("/address/aliases/" + user).json().size()).isZero();
        assertThat(webAdmin.get("/users/" + user + "/allowedFromHeaders").json().get(0).asText()).isEqualTo(user);

        // Keeping a copy (the default) makes the user one of its own forward destinations
        detail.iconButton("Add forward").click();
        detail.dialog().getByLabel("Destination address", new Locator.GetByLabelOptions().setExact(true)).fill(david);
        dialogButton(detail, "Add").click();
        app.expectToast("Forward added successfully");
        assertThat(app.main().getByText("Mappings from this user")).isVisible();
        Locator mappingRows = app.main().getByRole(AriaRole.TABLE).getByRole(AriaRole.ROW);
        Locator forwardRow = mappingRows.filter(new Locator.FilterOptions().setHasText(david));
        Locator copyRow = mappingRows.filter(new Locator.FilterOptions().setHasText(user));
        assertThat(forwardRow).containsText("Forward");
        assertThat(copyRow).containsText("Forward");
        assertThat(detail.sectionToggle("Forwards", 1)).isVisible();
        // Two forwards from the user, and the user as the source of a forward to itself
        assertThat(detail.sectionToggle("Mappings", 3)).isVisible();
        assertThat(webAdmin.get("/mappings/user/" + user).body()).contains(david);

        detail.iconButton("Remove forward to \"" + david + "\"").click();
        detail.confirm("Remove");
        app.expectToast("Forward removed successfully");
        // The last forward gone, the copy kept for the user goes too: plain delivery, no mapping left
        assertThat(forwardRow).hasCount(0);
        assertThat(copyRow).hasCount(0);
        assertThat(detail.sectionToggle("Mappings", 0)).isVisible();
        assertThat(webAdmin.get("/mappings/user/" + user).json().size()).isZero();
    }

    private static Locator dialogButton(MailUserDetailPage detail, String name) {
        return detail.dialog().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(name).setExact(true));
    }

    @Test
    @DisplayName("UDT-24 Vacation: an enabled vacation must end after it starts")
    void vacationMustEndAfterItStarts(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin, Page page) {
        String user = fixtures.newUser("charlotte");
        MailUserDetailPage detail = new MailUserDetailPage(app).open(user);
        detail.toggle("Vacation");
        Locator from = app.main().getByLabel("From", new Locator.GetByLabelOptions().setExact(true));
        Locator to = app.main().getByLabel("To", new Locator.GetByLabelOptions().setExact(true));
        Locator error = app.main().getByText("The end date must be after the start date");
        Locator save = detail.button("Save");

        app.main().getByLabel("Enabled").check();
        from.fill("2026-12-20T10:00");
        to.fill("2026-12-10T10:00");
        assertThat(error).isVisible();
        assertThat(to).hasAttribute("aria-invalid", "true");
        assertThat(save).isDisabled();

        to.fill("2026-12-20T10:00");
        assertThat(error).isVisible();
        assertThat(save).isDisabled();

        to.fill("2026-12-31T10:00");
        app.main().getByLabel("Subject", new Locator.GetByLabelOptions().setExact(true)).fill("Out");
        assertThat(error).hasCount(0);
        assertThat(to).hasAttribute("aria-invalid", "false");
        save.click();
        app.expectToast("Vacation settings updated");
        JsonNode stored = webAdmin.get("/vacation/" + user).expect(200).json();
        assertThat(stored.path("enabled").asBoolean()).isTrue();
        assertThat(stored.path("subject").asText()).isEqualTo("Out");

        // An inconsistent enabled vacation stored behind the console's back can still be turned off
        webAdmin.post("/vacation/" + user, "{\"enabled\":true,\"fromDate\":\"2026-12-20T10:00:00Z\","
            + "\"toDate\":\"2026-12-10T10:00:00Z\",\"subject\":\"Out\"}").expect(204);
        page.reload();
        detail.toggle("Vacation");
        assertThat(error).isVisible();
        assertThat(save).isDisabled();
        app.main().getByLabel("Enabled").uncheck();
        assertThat(error).hasCount(0);
        assertThat(save).isEnabled();
        save.click();
        app.expectToast("Vacation settings updated");
        assertThat(webAdmin.get("/vacation/" + user).expect(200).json().path("enabled").asBoolean()).isFalse();
    }

    @Test
    @DisplayName("UDT-25 Delegated users: self and unknown accounts")
    void delegatedUsersSelfAndUnknown(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin) {
        String bob = fixtures.newUser("bob");
        String alice = fixtures.newUser("alice");
        String ghost = Ids.unique("ghost") + "@" + fixtures.domain();
        MailUserDetailPage detail = new MailUserDetailPage(app).open(bob);
        detail.toggle("Delegated Users");
        detail.iconButton("Add delegated user").click();
        Locator input = detail.dialog().getByRole(AriaRole.COMBOBOX, new Locator.GetByRoleOptions().setName("Delegated user").setExact(true));
        Locator add = dialogButton(detail, "Add");

        input.fill(bob);
        assertThat(detail.dialog().getByText("You cannot delegate a user to themself")).isVisible();
        assertThat(add).isDisabled();
        input.fill(bob.toUpperCase());
        assertThat(detail.dialog().getByText("You cannot delegate a user to themself")).isVisible();
        assertThat(add).isDisabled();

        input.fill("a@b@c");
        assertThat(detail.dialog().getByText("Invalid username")).isVisible();
        assertThat(add).isDisabled();

        input.fill(ghost);
        assertThat(detail.dialog().getByText("User not found")).isVisible();
        add.click();
        assertThat(app.dialog().getByRole(AriaRole.HEADING)).hasText("Unknown user");
        assertThat(app.dialog()).containsText("\"" + ghost + "\" does not exist and will not be able to log in. "
            + "Add it as delegated user anyway?");
        // Declined: the add modal stays open with the typed user
        app.dialog().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Cancel").setExact(true)).click();
        assertThat(app.page().getByRole(AriaRole.HEADING, new Page.GetByRoleOptions().setName("Unknown user"))).hasCount(0);
        assertThat(input).hasValue(ghost);
        assertThat(webAdmin.get("/users/" + bob + "/authorizedUsers").json().size()).isZero();

        add.click();
        app.confirm();
        app.expectToast("Delegated user added");
        assertThat(app.dialog()).hasCount(0);
        assertThat(app.main().getByText(ghost)).isVisible();

        detail.iconButton("Add delegated user").click();
        input.fill(alice);
        assertThat(detail.dialog().getByText("User exists")).isVisible();
        add.click();
        app.expectToast("Delegated user added");
        assertThat(app.dialog()).hasCount(0);
        assertThat(app.main().getByText(alice)).isVisible();

        List<String> delegated = new ArrayList<>();
        webAdmin.get("/users/" + bob + "/authorizedUsers").json().forEach(node -> delegated.add(node.asText()));
        assertThat(delegated).containsExactlyInAnyOrder(ghost, alice).doesNotContain(bob);
    }
}
