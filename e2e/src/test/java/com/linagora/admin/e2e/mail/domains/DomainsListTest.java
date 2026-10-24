package com.linagora.admin.e2e.mail.domains;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.IntStream;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.Ids;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.domains.DomainsPage;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

class DomainsListTest extends MailAdminE2ETest {

    @Test
    @DisplayName("DOM-01 Create a domain")
    void createDomain(AdminApp app, WebAdmin webAdmin) {
        String prefix = Ids.unique("qa-new");
        String domain = prefix + "-a.e2e.test";
        String sibling = prefix + "-b.e2e.test";
        webAdmin.put("/domains/" + sibling).expect(204);

        app.open("/").navigate("Domains");
        DomainsPage domains = new DomainsPage(app);
        // Search, "Create a domain" and "Import" on one line; the name is typed in a modal
        assertThat(domains.searchInput()).isVisible();
        assertThat(domains.importButton()).isVisible();
        domains.createButton().click();
        assertThat(app.dialog()).containsText("Create Domain");
        assertThat(app.dialog()).containsText("Make sure this is the domain you intend to create: its users will receive mail under it.");
        assertThat(domains.newDomainInput()).isFocused();
        assertThat(domains.submitCreateButton()).isDisabled();
        domains.newDomainInput().fill(domain);
        assertThat(domains.submitCreateButton()).isEnabled();

        // Cancelling creates nothing
        app.cancel();
        assertThat(webAdmin.get("/domains/" + domain).status()).isEqualTo(404);

        domains.create(domain);
        app.expectToast("Domain \"" + domain + "\" created");
        assertThat(app.dialog()).isHidden();
        // Opened again, the modal is empty
        domains.createButton().click();
        assertThat(domains.newDomainInput()).hasValue("");
        app.cancel();

        // Alphabetically sorted, "N. domain"
        domains.search(prefix);
        assertThat(domains.rowHeadings()).hasText(new Pattern[] {
            DomainsPage.rowHeading(1, domain), DomainsPage.rowHeading(2, sibling)});
        assertThat(domainList(webAdmin)).contains(domain);
    }

    @Test
    @DisplayName("DOM-02 Delete a domain")
    void deleteDomain(AdminApp app, WebAdmin webAdmin) {
        String domain = Ids.unique("qa-del") + ".e2e.test";
        DomainsPage domains = DomainsPage.open(app);
        domains.create(domain);
        app.expectToast("Domain \"" + domain + "\" created");

        // An empty domain: a plain confirmation, saying it holds nothing
        domains.search(domain);
        assertThat(domains.domainLink(domain)).isVisible();
        domains.deleteButton(domain).click();
        // The dialog is named after the domain, like its button
        assertThat(app.dialog()).containsText("Delete domain " + domain);
        assertThat(app.dialog()).containsText("Delete \"" + domain
            + "\"? It holds no user and no domain alias; it can be re-created afterwards.");
        app.dialog().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Delete").setExact(true)).click();
        assertThat(app.dialog()).isHidden();

        app.expectToast("Domain \"" + domain + "\" deleted");
        assertThat(domains.domainLink(domain)).hasCount(0);
        assertThat(webAdmin.get("/domains/" + domain).status()).isEqualTo(404);
    }

    @Test
    @DisplayName("DOM-02 Delete a domain that still has users and aliases: told what it holds, typed confirmation")
    void deleteDomainStillHoldingUsers(AdminApp app, MailFixtures fixtures) {
        String domain = fixtures.domain();
        WebAdmin webAdmin = fixtures.webAdmin();
        String alice = fixtures.newUser("alice");
        String bob = fixtures.newUser("bob");
        webAdmin.put("/domains/" + domain + "/aliases/" + fixtures.newDomain("alias")).expect(204);

        DomainsPage domains = DomainsPage.open(app).search(domain);
        domains.deleteButton(domain).click();
        Locator dialog = app.dialog();
        assertThat(dialog).containsText("Delete domain " + domain);
        assertThat(dialog).containsText(domain + " still has 2 users (e.g. ");
        assertThat(dialog).containsText(alice);
        assertThat(dialog).containsText(bob);
        assertThat(dialog).containsText(") and 1 domain alias.");
        assertThat(dialog).containsText("Their accounts and mailboxes stay on the server, but mail to @" + domain
            + " will no longer be delivered to them.");
        assertThat(dialog).containsText("Delete \"" + domain + "\" anyway?");
        assertThat(dialog.getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName("See the users of " + domain)))
            .hasAttribute("href", "/users?domain=" + WebAdmin.encode(domain));

        // Delete stays disabled until the domain is typed (case does not matter)
        Locator delete = dialog.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Delete").setExact(true));
        Locator typed = dialog.getByLabel("Type " + domain + " to confirm", new Locator.GetByLabelOptions().setExact(true));
        assertThat(typed).isFocused();
        assertThat(delete).isDisabled();
        typed.fill("other.e2e.test");
        assertThat(delete).isDisabled();
        typed.fill(domain.toUpperCase());
        assertThat(delete).isEnabled();

        // Cancelling keeps it
        app.cancel();
        assertThat(webAdmin.get("/domains/" + domain).status()).isNotEqualTo(404);

        domains.deleteButton(domain).click();
        typed.fill(domain);
        delete.click();
        assertThat(app.dialog()).isHidden();
        app.expectToast("Domain \"" + domain + "\" deleted");
        assertThat(domains.domainLink(domain)).hasCount(0);
        assertThat(webAdmin.get("/domains/" + domain).status()).isEqualTo(404);
    }

    @Test
    @DisplayName("DOM-03 Create domain errors")
    void createDomainErrors(AdminApp app, MailFixtures fixtures) {
        String existing = fixtures.domain();
        DomainsPage domains = DomainsPage.open(app);

        // A refusal is shown in the modal, which stays open with the typed name
        domains.create("not a domain!");
        assertThat(app.dialogError()).containsText("Domain parts ASCII chars must be a-z A-Z 0-9 - or _ in not a domain!");
        assertThat(app.dialogError()).not().containsText("{");
        assertThat(domains.newDomainInput()).hasValue("not a domain!");
        assertThat(domainList(fixtures.webAdmin())).doesNotContain("not a domain!");
        // Editing the name clears the error
        domains.newDomainInput().fill("not a domain");
        assertThat(app.dialogError()).hasCount(0);
        app.cancel();

        // Existing domain: idempotent success or an error, but never a duplicate row
        domains.create(existing);
        assertThat(app.toast("Domain \"" + existing + "\" created").or(app.dialogError())).isVisible();
        if (app.dialogError().isVisible()) {
            app.cancel();
        }
        domains.search(existing);
        assertThat(domains.domainLink(existing)).hasCount(1);
        assertThat(domainList(fixtures.webAdmin()).stream().filter(existing::equals)).hasSize(1);
    }

    @Test
    @DisplayName("DOM-04 Search and paginate the domain list")
    void searchAndPaginate(AdminApp app, WebAdmin webAdmin) {
        // Other tests add domains all the time: work on a set of domains of our own, sharing a unique prefix
        String prefix = Ids.unique("qa-page");
        List<String> created = IntStream.rangeClosed(1, 51)
            .mapToObj(i -> String.format("%s-%02d.e2e.test", prefix, i))
            .toList();
        created.parallelStream().forEach(domain -> webAdmin.put("/domains/" + domain).expect(204));
        try {
            DomainsPage domains = DomainsPage.open(app);

            // Case-insensitive substring match, 50 per page
            domains.search(prefix.toUpperCase());
            assertThat(domains.paginationLabel()).hasText("Page 1 / 2 — Total: 51");
            assertThat(domains.rowHeadings()).hasCount(50);
            assertThat(domains.rowHeadings().first()).hasText(DomainsPage.rowHeading(1, created.get(0)));
            domains.nextPageButton().click();
            assertThat(domains.paginationLabel()).hasText("Page 2 / 2 — Total: 51");
            assertThat(domains.rowHeadings()).hasText(new Pattern[] {DomainsPage.rowHeading(51, created.get(50))});
            assertThat(domains.nextPageButton()).isDisabled();

            // A new search goes back to the first page
            domains.search(prefix + "-07");
            // Everything on one page: only the total, no page controls
            assertThat(domains.paginationLabel()).hasText("Total: 1");
            assertThat(domains.nextPageButton()).hasCount(0);
            assertThat(domains.rowHeadings()).hasText(new Pattern[] {DomainsPage.rowHeading(1, created.get(6))});

            String nothing = prefix + "-zzz";
            domains.search(nothing);
            assertThat(domains.text("No domain matches \"" + nothing + "\".")).isVisible();
            assertThat(domains.rowHeadings()).hasCount(0);
            assertThat(domains.paginationLabel()).hasCount(0);

            // Clearing restores every domain
            domains.search("");
            assertThat(domains.text("No domain matches \"" + nothing + "\".")).hasCount(0);
            assertThat(domains.paginationLabel()).hasText(Pattern.compile("^Page 1 / ([2-9]|\\d{2,}) — Total: (5[1-9]|[6-9]\\d|\\d{3,})$"));
            assertThat(domains.rowHeadings()).hasCount(50);
        } finally {
            created.parallelStream().forEach(domain -> webAdmin.delete("/domains/" + domain));
        }
    }

    @Test
    @DisplayName("DOM-16 Enter in \"Domain name\" creates the domain")
    void enterCreatesDomain(AdminApp app, WebAdmin webAdmin, Page page) {
        String domain = Ids.unique("qa-enter") + ".e2e.test";
        DomainsPage domains = DomainsPage.open(app);
        domains.createButton().click();

        // A blank field submits nothing
        domains.newDomainInput().fill("   ");
        domains.newDomainInput().press("Enter");
        assertThat(domains.submitCreateButton()).isDisabled();
        assertThat(app.dialog()).isVisible();

        // Escape closes the modal, nothing created
        domains.newDomainInput().fill("  " + domain + "  ");
        page.keyboard().press("Escape");
        assertThat(app.dialog()).isHidden();
        assertThat(webAdmin.get("/domains/" + domain).status()).isEqualTo(404);

        // Surrounding spaces are trimmed
        domains.createButton().click();
        domains.newDomainInput().fill("  " + domain + "  ");
        domains.newDomainInput().press("Enter");
        app.expectToast("Domain \"" + domain + "\" created");
        assertThat(app.dialog()).isHidden();
        domains.search(domain);
        assertThat(domains.domainLink(domain)).isVisible();
        assertThat(domainList(webAdmin)).contains(domain);
    }

    static List<String> domainList(WebAdmin webAdmin) {
        JsonNode domains = webAdmin.get("/domains").expect(200).json();
        return java.util.stream.StreamSupport.stream(domains.spliterator(), false).map(JsonNode::asText).toList();
    }
}
