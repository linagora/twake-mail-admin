package com.linagora.admin.e2e.mail.domains;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;

import org.awaitility.Awaitility;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.Ids;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.domains.DomainDetailPage;
import com.linagora.admin.e2e.pages.mail.domains.DomainsPage;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.AriaRole;

class DomainSectionsTest extends MailAdminE2ETest {

    @Test
    @DisplayName("DOM-06 Domain detail page structure")
    void detailPageStructure(AdminApp app, MailFixtures fixtures) {
        String domain = fixtures.domain();
        DomainsPage domains = DomainsPage.open(app);
        domains.search(domain);
        domains.domainLink(domain).click();

        // Headed with the domain, a "Domain" subtitle, and a breadcrumb back to the list
        DomainDetailPage detail = DomainDetailPage.open(app, domain);
        assertThat(detail.title()).hasText(domain);
        assertThat(detail.text("Domain")).isVisible();
        assertThat(detail.breadcrumb()).hasText("Domains");
        assertThat(detail.breadcrumb()).hasAttribute("href", "/domains");
        assertThat(app.page()).hasTitle(domain + " — Twake Mail Admin");
        // The number of its users, linking to the Users list filtered on it
        Locator users = detail.main().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName("Users: 0").setExact(true));
        assertThat(users).hasAttribute("href", "/users?domain=" + WebAdmin.encode(domain));
        assertThat(detail.sectionButton("Quota")).isVisible();
        assertThat(detail.sectionButton("Domain Aliases", 0)).isVisible();
        assertThat(detail.sectionButton("Team Mailboxes", 0)).isVisible();
        assertThat(detail.sectionButton("Domain Contacts", 0)).isVisible();
        assertThat(detail.sectionButton("Signature Templates", 0)).isVisible();
        assertThat(detail.sectionButton("Rate Limiting")).isVisible();
        assertThat(detail.sectionButton("JMAP Settings Report")).isVisible();
        assertThat(detail.sectionButton("Tasks")).isVisible();

        detail.breadcrumb().click();
        assertThat(app.page()).hasURL(java.util.regex.Pattern.compile("/domains$"));
    }

    @Test
    @DisplayName("DOM-09 Domain aliases: add and remove")
    void addAndRemoveAlias(AdminApp app, MailFixtures fixtures) {
        String domain = fixtures.domain();
        String source = fixtures.newDomain("alias");
        WebAdmin webAdmin = fixtures.webAdmin();

        DomainDetailPage detail = DomainDetailPage.open(app, domain).openSection("Domain Aliases");
        assertThat(detail.text("No domain aliases configured.")).isVisible();
        // The "+" opens a modal
        detail.button("Add domain alias").click();
        assertThat(detail.dialog()).containsText("Add domain alias");
        assertThat(detail.dialogButton("Add")).isDisabled();
        detail.dialogField("Domain name").fill(source);
        detail.dialogButton("Add").click();

        app.expectToast("Domain alias added successfully");
        assertThat(detail.dialog()).isHidden();
        assertThat(detail.sectionButton("Domain Aliases", 1)).isVisible();
        assertThat(detail.rowHeading(source)).isVisible();
        assertThat(aliases(webAdmin, domain)).contains(source);

        detail.rowButton(source, "Remove alias \"" + source + "\"").click();
        assertThat(app.dialog()).containsText("Remove alias \"" + source + "\" from " + domain + "?");
        detail.confirmWith("Remove");
        app.expectToast("Domain alias removed successfully");
        assertThat(detail.text("No domain aliases configured.")).isVisible();
        assertThat(detail.sectionButton("Domain Aliases", 0)).isVisible();
        assertThat(aliases(webAdmin, domain)).doesNotContain(source);
    }

    @Test
    @DisplayName("DOM-10 Domain contacts (manual corrections)")
    void domainContacts(AdminApp app, MailFixtures fixtures) {
        String domain = fixtures.domain();
        WebAdmin webAdmin = fixtures.webAdmin();
        String localPart = Ids.unique("qa.contact");
        String email = localPart + "@" + domain;
        String contactPath = "/domains/" + domain + "/contacts/" + localPart;

        DomainDetailPage detail = DomainDetailPage.open(app, domain).openSection("Domain Contacts");
        assertThat(detail.text("Contacts are automatically populated from LDAP. This section allows manual corrections by an administrator.")).isVisible();
        assertThat(detail.text("No domain contacts.")).isVisible();

        // The "+" opens the "New Contact" modal
        detail.button("Create contact").click();
        assertThat(detail.dialog()).containsText("New Contact");
        detail.dialogField("Email").fill(email);
        detail.dialogField("First name").fill("Qa");
        detail.dialogField("Surname").fill("Contact");
        detail.dialogButton("Create").click();
        app.expectToast("Contact created");
        assertThat(detail.dialog()).isHidden();
        // Shown at once, although the server listing is eventually consistent
        assertThat(detail.rowHeading(email)).isVisible();
        assertThat(detail.sectionButton("Domain Contacts", 1)).isVisible();
        assertThat(webAdmin.get(contactPath).expect(200).json().path("surname").asText()).isEqualTo("Contact");

        // Details, then edit from there
        detail.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(email).setExact(true)).click();
        assertThat(app.dialog()).containsText("Contact Details");
        assertThat(app.dialog()).containsText("First name:Qa");
        assertThat(app.dialog()).containsText("Surname:Contact");
        app.dialog().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Edit").setExact(true)).click();
        assertThat(app.dialog()).containsText("Edit Contact — " + email);
        app.dialog().getByLabel("Surname", new Locator.GetByLabelOptions().setExact(true)).fill("Corrected");
        app.dialog().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Save").setExact(true)).click();
        app.expectToast("Contact updated");
        assertThat(app.dialog()).isHidden();
        assertThat(webAdmin.get(contactPath).expect(200).json().path("surname").asText()).isEqualTo("Corrected");

        // "Edit contact" from the row opens the same form
        detail.rowButton(email, "Edit contact").click();
        assertThat(app.dialog().getByLabel("Surname", new Locator.GetByLabelOptions().setExact(true))).hasValue("Corrected");
        app.dialog().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Cancel").setExact(true)).click();
        assertThat(app.dialog()).isHidden();

        // Search
        detail.placeholder("Search contacts...").fill("QA.CONTACT");
        assertThat(detail.rowHeading(email)).isVisible();
        detail.placeholder("Search contacts...").fill("zzz-nothing");
        assertThat(detail.text("No contacts match your search.")).isVisible();
        detail.placeholder("Search contacts...").fill(localPart);
        assertThat(detail.rowHeading(email)).isVisible();

        detail.rowButton(email, "Remove contact").click();
        assertThat(app.dialog()).containsText("Delete contact \"" + email + "\" from " + domain + "?");
        detail.confirmWith("Delete");
        app.expectToast("Contact deleted");
        assertThat(detail.rowHeading(email)).hasCount(0);
        assertThat(detail.sectionButton("Domain Contacts", 0)).isVisible();
        assertThat(webAdmin.get(contactPath).status()).isEqualTo(404);
        Awaitility.await().atMost(Duration.ofSeconds(20)).pollInterval(Duration.ofMillis(300))
            .until(() -> !webAdmin.get("/domains/" + domain + "/contacts").body().contains(email));

        // A reload does not bring it back; the section is still expanded, as it was left
        app.page().reload();
        detail = DomainDetailPage.open(app, domain);
        assertThat(detail.sectionButton("Domain Contacts")).hasAttribute("aria-expanded", "true");
        assertThat(detail.text("No domain contacts.")).isVisible();
    }

    @Test
    @DisplayName("DOM-13 Domain JMAP settings report")
    void jmapSettingsReport(AdminApp app, MailFixtures fixtures) {
        String domain = fixtures.domain();
        WebAdmin webAdmin = fixtures.webAdmin();
        String alice = fixtures.newUser("alice");

        DomainDetailPage detail = DomainDetailPage.open(app, domain).openSection("JMAP Settings Report");
        assertThat(detail.text("No data — no users have JMAP settings configured.")).isVisible();

        webAdmin.put("/users/" + alice + "/jmap/settings", "{\"language\":\"fr\"}").expect(204);
        // A setting in another domain is not counted
        String stranger = fixtures.newUser("stranger", fixtures.newDomain());
        webAdmin.put("/users/" + stranger + "/jmap/settings", "{\"language\":\"fr\"}").expect(204);

        detail.toggleSection("JMAP Settings Report");
        detail.toggleSection("JMAP Settings Report");
        assertThat(detail.text("language")).isVisible();
        Locator table = detail.main().getByRole(AriaRole.TABLE);
        assertThat(table.getByRole(AriaRole.COLUMNHEADER)).hasText(new String[] {"Value", "Users"});
        assertThat(table.getByRole(AriaRole.ROW).nth(1).getByRole(AriaRole.CELL)).hasText(new String[] {"fr", "1"});
        assertThat(table.getByRole(AriaRole.ROW)).hasCount(2);
    }

    private static java.util.List<String> aliases(WebAdmin webAdmin, String domain) {
        JsonNode aliases = webAdmin.get("/domains/" + domain + "/aliases").expect(200).json();
        return java.util.stream.StreamSupport.stream(aliases.spliterator(), false)
            .map(alias -> alias.path("source").asText()).toList();
    }
}
