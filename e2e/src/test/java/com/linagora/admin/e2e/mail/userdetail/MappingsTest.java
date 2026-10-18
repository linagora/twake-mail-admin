package com.linagora.admin.e2e.mail.userdetail;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.userdetail.MailUserDetailPage;
import com.linagora.admin.e2e.pages.mail.userdetail.MappingsPage;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Request;
import com.microsoft.playwright.options.AriaRole;

/**
 * The Mappings table lists every mapping of the server: each test seeds its mappings in its own
 * domain and filters the table on it before reading or deleting rows.
 */
class MappingsTest extends MailAdminE2ETest {

    @Test
    @DisplayName("MAP-01 List and add/remove an address mapping")
    void addAndRemoveAddressMapping(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin) {
        String domain = fixtures.domain();
        String alice = fixtures.newUser("alice");
        String bob = fixtures.newUser("bob");
        String brian = fixtures.newUser("brian");
        String charlotte = fixtures.newUser("charlotte");
        String aliceAlias = "alice.alias@" + domain;
        webAdmin.put("/address/aliases/" + alice + "/sources/" + aliceAlias).expect(204);
        webAdmin.put("/address/forwards/" + brian + "/targets/" + charlotte).expect(204);
        String source = "qa.map@" + domain;

        app.open("/");
        app.navigate("Mappings");
        MappingsPage mappings = new MappingsPage(app);
        assertThat(mappings.table()).isVisible();
        mappings.filter(domain);
        assertThat(mappings.table().getByRole(AriaRole.COLUMNHEADER)).hasText(new String[] {
            "#", "Source", "Type", "Destination", "Action"});
        assertThat(mappings.row(aliceAlias, "Alias", alice)).hasCount(1);
        assertThat(mappings.row(brian, "Forward", charlotte)).hasCount(1);
        assertThat(mappings.rows()).hasCount(2);
        assertThat(mappings.pageLabel()).hasText("Page 1 / 1 — Total: 2");

        mappings.addAddress(source, bob);
        app.expectToast("Address mapping created successfully");
        mappings.filter("qa.map@" + domain);
        Locator row = mappings.row(source, "Address", bob);
        assertThat(row).hasCount(1);
        assertThat(mappings.rows()).hasCount(1);
        assertThat(mappingsOf(webAdmin, source).toString()).contains("\"type\":\"Address\"").contains(bob);

        mappings.removeButton(row).click();
        assertThat(app.dialog()).containsText("Remove address mapping \"" + source + "\" → \"" + bob + "\"?");
        app.confirm();
        app.expectToast("Address mapping removed successfully");
        assertThat(row).hasCount(0);
        assertThat(app.main().getByText("No mappings found.")).isVisible();
        assertThat(mappingsOf(webAdmin, source).isMissingNode()).isTrue();
    }

    @Test
    @DisplayName("MAP-02 Regex and domain mappings")
    void regexAndDomainMappings(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin, Page page) {
        String domain = fixtures.domain();
        String bob = fixtures.newUser("bob");
        String sourceDomain = fixtures.newDomain("qa-src");
        String regexSource = "qa.regex@" + domain;
        String regex = "qa.*@" + domain + ":" + bob;
        List<String> domainAliasCalls = new CopyOnWriteArrayList<>();
        page.onRequest(request -> {
            if (request.url().contains("/domainAliases")) {
                domainAliasCalls.add(request.url());
            }
        });
        MappingsPage mappings = new MappingsPage(app).open();

        mappings.addRegex(regexSource, regex);
        app.expectToast("Regex mapping created successfully");
        mappings.openDomainForm(sourceDomain, domain);
        assertThat(mappings.domainHint()).hasText("Mail addressed to the source domain will be rewritten to the "
            + "destination domain. No loop check is performed.");
        mappings.button("Create").click();
        app.expectToast("Domain mapping created successfully");

        mappings.filter(domain);
        Locator regexRow = mappings.row(regexSource, "Regex", regex);
        Locator domainRow = mappings.row(sourceDomain, "Domain", domain);
        assertThat(regexRow).hasCount(1);
        assertThat(domainRow).hasCount(1);

        mappings.removeButton(regexRow).click();
        app.confirm();
        app.expectToast("Regex mapping removed successfully");
        assertThat(regexRow).hasCount(0);
        assertThat(mappingsOf(webAdmin, regexSource).isMissingNode()).isTrue();

        mappings.removeButton(domainRow).click();
        assertThat(app.dialog()).containsText("Remove domain mapping \"" + sourceDomain + "\" → \"" + domain + "\"?");
        Request delete = page.waitForRequest(
            request -> request.method().equals("DELETE") && request.url().contains("/domainMappings/"), app::confirm);
        assertThat(delete.url()).endsWith("/domainMappings/" + sourceDomain);
        assertThat(delete.postData()).isEqualTo(domain);
        app.expectToast("Domain mapping removed successfully");
        assertThat(domainRow).hasCount(0);
        assertThat(app.toast("Error removing domain mapping")).hasCount(0);
        assertThat(domainAliasCalls).isEmpty();
        assertThat(webAdmin.get("/domainMappings").expect(200).json().has(sourceDomain)).isFalse();
    }

    @Test
    @DisplayName("MAP-03 Remove alias / forward mappings from the global table")
    void removeAliasAndForwardMappings(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin) {
        String domain = fixtures.domain();
        String brian = fixtures.newUser("brian");
        String charlotte = fixtures.newUser("charlotte");
        String alias = "brian.alias@" + domain;
        webAdmin.put("/address/forwards/" + brian + "/targets/" + charlotte).expect(204);
        webAdmin.put("/address/aliases/" + brian + "/sources/" + alias).expect(204);
        MappingsPage mappings = new MappingsPage(app).open();
        mappings.filter(domain);

        Locator forward = mappings.row(brian, "Forward", charlotte);
        mappings.removeButton(forward).click();
        assertThat(app.dialog().getByRole(AriaRole.HEADING)).hasText("Remove Forward Mapping");
        app.confirm();
        app.expectToast("Forward mapping removed successfully");
        assertThat(forward).hasCount(0);
        assertThat(webAdmin.get("/address/forwards/" + brian).body()).doesNotContain(charlotte);

        Locator aliasRow = mappings.row(alias, "Alias", brian);
        mappings.removeButton(aliasRow).click();
        app.confirm();
        app.expectToast("Alias mapping removed successfully");
        assertThat(app.main().getByText("No mappings found.")).isVisible();
        assertThat(webAdmin.get("/address/aliases/" + brian).json().size()).isZero();

        MailUserDetailPage detail = new MailUserDetailPage(app).open(brian);
        assertThat(detail.sectionToggle("Forwards", 0)).isVisible();
        detail.toggle("Forwards");
        assertThat(app.main().getByText("No forwards configured.")).isVisible();
    }

    @Test
    @DisplayName("MAP-04 Delete the displayed page of mappings")
    void deleteDisplayedPage(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin) {
        String domain = fixtures.domain();
        String bob = fixtures.newUser("bob");
        String alice = fixtures.newUser("alice");
        String alias = "alice.alias@" + domain;
        webAdmin.put("/address/aliases/" + alice + "/sources/" + alias).expect(204);
        webAdmin.put("/address/forwards/" + alice + "/targets/" + bob).expect(204);
        // The page to delete lives in a domain of its own: filtering on it shows these 3 rows only
        String pageDomain = fixtures.newDomain("qa-p");
        List<String> sources = List.of("qa.p1@" + pageDomain, "qa.p2@" + pageDomain, "qa.p3@" + pageDomain);
        for (String source : sources) {
            webAdmin.post("/mappings/address/" + source + "/targets/" + bob, null).expect(204);
        }

        MappingsPage mappings = new MappingsPage(app).open();
        mappings.filter("@" + pageDomain);
        assertThat(mappings.rows()).hasCount(3);
        assertThat(mappings.deletePageButton()).hasText("Delete page (3)");
        mappings.deletePageButton().click();

        assertThat(app.dialog().getByRole(AriaRole.HEADING)).hasText("Delete Displayed Mappings");
        assertThat(app.dialog()).containsText("The following 3 mapping(s) displayed on this page will be permanently removed:");
        Locator items = app.dialog().getByRole(AriaRole.LISTITEM);
        // Never confirm unless the dialog lists exactly the rows of this test
        assertThat(items).hasCount(3);
        for (int i = 0; i < 3; i++) {
            assertThat(items.nth(i)).hasText("Address" + sources.get(i) + "→" + bob);
        }
        app.confirm();
        app.expectToast("3 mapping(s) removed successfully");
        assertThat(app.main().getByText("No mappings found.")).isVisible();

        for (String source : sources) {
            assertThat(mappingsOf(webAdmin, source).isMissingNode()).as(source).isTrue();
        }
        assertThat(mappingsOf(webAdmin, alias).toString()).contains(alice);
        assertThat(mappingsOf(webAdmin, alice).toString()).contains(bob);
    }

    private static JsonNode mappingsOf(WebAdmin webAdmin, String source) {
        return webAdmin.get("/mappings").expect(200).json().path(source);
    }
}
