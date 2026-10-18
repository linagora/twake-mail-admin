package com.linagora.admin.e2e.calendar.domains;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.regex.Pattern;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.linagora.admin.e2e.CalendarAdminE2ETest;
import com.linagora.admin.e2e.backend.CalendarFixtures;
import com.linagora.admin.e2e.backend.Ids;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.calendar.domains.DomainsPage;
import com.microsoft.playwright.FileChooser;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;
import com.microsoft.playwright.options.FilePayload;

class DomainsListTest extends CalendarAdminE2ETest {

    @Test
    @DisplayName("DOM-01 Domain list and search")
    void domainListAndSearch(AdminApp app, Page page, CalendarFixtures fixtures) {
        // Other tests create domains (WebAdmin cannot delete them): the list is searched for ours
        String mine = fixtures.newDomain("list");
        DomainsPage domains = new DomainsPage(app);
        app.open("/health-check");
        app.navigate("Domains");

        // Other tests keep adding domains: open-paas.org may be beyond the first page, it is searched
        assertThat(domains.pagination()).isVisible();
        assertThat(domains.domainLinks().first()).isVisible();

        domains.search("paas");
        assertThat(domains.domainLink(CalendarFixtures.DOMAIN)).isVisible();
        assertThat(domains.row(CalendarFixtures.DOMAIN)).hasText(Pattern.compile("^\\d+/open-paas\\.org$"));
        assertThat(domains.deleteButton(CalendarFixtures.DOMAIN)).isVisible();
        assertThat(domains.domainLink(mine)).hasCount(0);

        domains.search(mine.substring(0, mine.indexOf('.')));
        assertThat(domains.domainLinks()).hasText(new String[] {mine});
        assertThat(domains.row(mine)).hasText("1/" + mine);
        assertThat(domains.pagination()).hasText("Page 1 / 1 — Total: 1");

        domains.search("zzz-" + Ids.suffix(8));
        String query = domains.searchInput().inputValue();
        assertThat(app.main().getByText("No domain matches \"" + query + "\".")).isVisible();
        assertThat(domains.domainLinks()).hasCount(0);
    }

    @Test
    @DisplayName("DOM-02 Create a domain")
    void createDomain(AdminApp app, Page page, CalendarFixtures fixtures, WebAdmin webAdmin) {
        String token = Ids.suffix(8);
        String before = "a-" + token + ".e2e.test";
        String created = "b-" + token + ".e2e.test";
        webAdmin.put("/domains/" + before).expect(204);
        DomainsPage domains = new DomainsPage(app).open();

        assertThat(domains.createButton()).isDisabled();
        domains.newDomainInput().fill("   ");
        assertThat(domains.createButton()).isDisabled();
        domains.newDomainInput().fill(created);
        assertThat(domains.createButton()).isEnabled();

        domains.createButton().click();
        assertThat(app.dialog().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setName("Create Domain"))).isVisible();
        assertThat(app.dialog()).containsText("Create \"" + created + "\"?");
        app.cancel();
        assertThat(domainList(webAdmin)).doesNotContain(created);

        domains.newDomainInput().press("Enter");
        assertThat(app.dialog()).isVisible();
        assertThat(app.dialog()).containsText("Create \"" + created + "\"?");
        app.confirm();

        app.expectToast("Domain \"" + created + "\" created");
        assertThat(domains.newDomainInput()).hasValue("");
        domains.search(token);
        assertThat(domains.domainLinks()).hasText(new String[] {before, created});
        assertThat(domainList(webAdmin)).contains(created);
    }

    @Test
    @DisplayName("DOM-03 Delete a domain")
    void deleteDomain(AdminApp app, CalendarFixtures fixtures, WebAdmin webAdmin) {
        String domain = fixtures.newDomain("qa-delete");
        DomainsPage domains = new DomainsPage(app).open().search(domain);

        domains.deleteButton(domain).click();
        assertThat(app.dialog().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setName("Delete Domain"))).isVisible();
        assertThat(app.dialog()).containsText("Delete \"" + domain
            + "\"? The domain can be re-created afterwards and existing user data will not be affected.");
        app.confirm();

        // The side service of the stack does not implement DELETE /domains/{domain} (500 "Not implemented
        // exception"): the console reports the refusal and keeps the domain
        app.expectToast("Error deleting domain");
        assertThat(app.toast("Error deleting domain")).containsText("Not implemented exception");
        assertThat(domains.domainLink(domain)).isVisible();
        assertThat(domainList(webAdmin)).contains(domain);
    }

    @Test
    @DisplayName("DOM-04 Import domains from a text file")
    void importDomains(AdminApp app, Page page, WebAdmin webAdmin) {
        String token = Ids.suffix(8);
        String first = "qa-imp1-" + token + ".e2e.test";
        String second = "qa-imp2-" + token + ".e2e.test";
        DomainsPage domains = new DomainsPage(app).open();

        domains.importHelpButton().focus();
        Locator tooltip = page.getByRole(AriaRole.TOOLTIP);
        assertThat(tooltip).containsText("one domain per line");
        assertThat(tooltip).containsText("Comments start with # or //");
        assertThat(tooltip).containsText("Blank lines and comment-only lines are skipped.");
        assertThat(tooltip).containsText("Only the domains that do not exist yet are created.");
        page.keyboard().press("Escape");

        String content = "# comment\n" + first + "\n" + second + " // trailing\n\nopen-paas.org\nnot a domain\n";
        FileChooser chooser = page.waitForFileChooser(() -> domains.importButton().click());
        chooser.setFiles(new FilePayload("domains.txt", "text/plain", content.getBytes(StandardCharsets.UTF_8)));

        Locator toast = app.toast("Domain import finished");
        assertThat(toast).isVisible();
        assertThat(toast).containsText("Created: 2, Already exist: 1, Errors: 1");
        toast.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("More details")).click();
        Locator failures = page.getByRole(AriaRole.DIALOG, new Page.GetByRoleOptions().setName("Domains that could not be created (1)"));
        assertThat(failures).isVisible();
        assertThat(failures.getByRole(AriaRole.LISTITEM)).hasCount(1);
        assertThat(failures.getByRole(AriaRole.LISTITEM)).containsText(Pattern.compile("^not a domain — .+"));
        page.keyboard().press("Escape");
        assertThat(failures).isHidden();

        domains.search(token);
        assertThat(domains.domainLinks()).hasText(new String[] {first, second});
        assertThat(domainList(webAdmin)).contains(first, second).doesNotContain("not a domain");
    }

    private static List<String> domainList(WebAdmin webAdmin) {
        return WebAdmin.JSON.convertValue(webAdmin.get("/domains").expect(200).json(),
            WebAdmin.JSON.getTypeFactory().constructCollectionType(List.class, String.class));
    }
}
