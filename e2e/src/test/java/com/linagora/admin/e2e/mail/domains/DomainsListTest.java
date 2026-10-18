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
import com.microsoft.playwright.Page;

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
        assertThat(domains.createButton()).isDisabled();
        domains.newDomainInput().fill(domain);
        assertThat(domains.createButton()).isEnabled();

        // Cancelling creates nothing
        domains.createButton().click();
        assertThat(app.dialog()).containsText("Create Domain");
        assertThat(app.dialog()).containsText("Create \"" + domain + "\"? Please make sure this is the domain you intend to create.");
        app.cancel();
        assertThat(webAdmin.get("/domains/" + domain).status()).isEqualTo(404);

        domains.createButton().click();
        app.confirm();
        app.expectToast("Domain \"" + domain + "\" created");
        assertThat(domains.newDomainInput()).hasValue("");

        // Alphabetically sorted, "N/ domain"
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

        domains.search(domain);
        assertThat(domains.domainLink(domain)).isVisible();
        domains.deleteButtons().click();
        assertThat(app.dialog()).containsText("Delete Domain");
        assertThat(app.dialog()).containsText("Delete \"" + domain
            + "\"? The domain can be re-created afterwards and existing user data will not be affected.");
        app.confirm();

        app.expectToast("Domain \"" + domain + "\" deleted");
        assertThat(domains.domainLink(domain)).hasCount(0);
        assertThat(webAdmin.get("/domains/" + domain).status()).isEqualTo(404);
    }

    @Test
    @DisplayName("DOM-03 Create domain errors")
    void createDomainErrors(AdminApp app, MailFixtures fixtures) {
        String existing = fixtures.domain();
        DomainsPage domains = DomainsPage.open(app);

        domains.create("not a domain!");
        app.expectToast("Error creating domain");
        assertThat(app.toast("Error creating domain")).containsText("Domain parts ASCII chars must be a-z A-Z 0-9 - or _ in not a domain!");
        assertThat(app.toast("Error creating domain")).not().containsText("{");
        assertThat(domainList(fixtures.webAdmin())).doesNotContain("not a domain!");

        // Existing domain: idempotent success or an error, but never a duplicate row
        domains.create(existing);
        assertThat(app.toast("Domain \"" + existing + "\" created").or(app.toast("Error creating domain"))).isVisible();
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
            assertThat(domains.paginationLabel()).hasText("Page 1 / 1 — Total: 1");
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
    @DisplayName("DOM-16 Enter in \"New domain name\" opens the confirmation")
    void enterOpensConfirmation(AdminApp app, WebAdmin webAdmin, Page page) {
        String domain = Ids.unique("qa-enter") + ".e2e.test";
        DomainsPage domains = DomainsPage.open(app);

        // A blank field opens nothing
        domains.newDomainInput().fill("   ");
        domains.newDomainInput().press("Enter");
        assertThat(app.dialog()).hasCount(0);

        // Surrounding spaces are trimmed
        domains.newDomainInput().fill("  " + domain + "  ");
        domains.newDomainInput().press("Enter");
        assertThat(app.dialog()).containsText("Create \"" + domain + "\"? Please make sure this is the domain you intend to create.");
        // Not dismissed by the keystroke that opened it, and nothing created yet
        assertThat(webAdmin.get("/domains/" + domain).status()).isEqualTo(404);
        assertThat(app.dialog()).isVisible();

        page.keyboard().press("Escape");
        assertThat(app.dialog()).isHidden();
        assertThat(webAdmin.get("/domains/" + domain).status()).isEqualTo(404);

        domains.newDomainInput().press("Enter");
        assertThat(app.dialog()).containsText("Create \"" + domain + "\"?");
        app.confirm();
        app.expectToast("Domain \"" + domain + "\" created");
        domains.search(domain);
        assertThat(domains.domainLink(domain)).isVisible();
        assertThat(domainList(webAdmin)).contains(domain);
    }

    static List<String> domainList(WebAdmin webAdmin) {
        JsonNode domains = webAdmin.get("/domains").expect(200).json();
        return java.util.stream.StreamSupport.stream(domains.spliterator(), false).map(JsonNode::asText).toList();
    }
}
