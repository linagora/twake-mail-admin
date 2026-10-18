package com.linagora.admin.e2e.calendar.domains;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.ResourceLock;

import com.linagora.admin.e2e.CalendarAdminE2ETest;
import com.linagora.admin.e2e.backend.CalendarFixtures;
import com.linagora.admin.e2e.backend.Ids;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.calendar.domains.CalendarDomainPage;
import com.microsoft.playwright.FileChooser;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Request;
import com.microsoft.playwright.options.AriaRole;
import com.microsoft.playwright.options.FilePayload;

/**
 * The domain address books of open-paas.org. On the side service of the stack (2.4.7.1) they do
 * not exist: import, export and clear are refused with 404 "Address book does not exist", copy with
 * 400 (only export / import actions). These are environment limitations: the tests check that the
 * console sends the documented request and reports the refusal.
 */
@ResourceLock(DomainLocks.OPEN_PAAS)
class DomainContactsTest extends CalendarAdminE2ETest {
    private static final String DAB = "Domain address book (dab)";
    private static final String MEMBERS = "Domain members";

    @Test
    @DisplayName("DCON-01 Domain address books and their actions")
    void domainAddressBooksAndTheirActions(AdminApp app) {
        CalendarDomainPage detail = new CalendarDomainPage(app).open(CalendarFixtures.DOMAIN).expand(CalendarDomainPage.CONTACTS);

        Locator dab = detail.addressBookRow(DAB);
        assertThat(dab.getByRole(AriaRole.BUTTON)).hasCount(4);
        for (String action : new String[] {"Export the address book (vCard)", "Import contacts (vCard)",
            "Copy users from another domain", "Clear contacts"}) {
            assertThat(button(dab, action)).isVisible();
        }
        Locator members = detail.addressBookRow(MEMBERS);
        assertThat(members.getByRole(AriaRole.BUTTON)).hasCount(1);
        assertThat(button(members, "Export the address book (vCard)")).isVisible();
    }

    @Test
    @DisplayName("DCON-02 Import vCards into the domain address book")
    void importVCardsIntoDomainAddressBook(AdminApp app, Page page) {
        CalendarDomainPage detail = new CalendarDomainPage(app).open(CalendarFixtures.DOMAIN).expand(CalendarDomainPage.CONTACTS);
        Locator dab = detail.addressBookRow(DAB);
        String vcard = "BEGIN:VCARD\r\nVERSION:3.0\r\nUID:" + Ids.unique("qa") + "\r\nFN:QA Contact\r\n"
            + "EMAIL:qa.contact@example.com\r\nEND:VCARD\r\n";

        FileChooser chooser = page.waitForFileChooser(() -> button(dab, "Import contacts (vCard)").click());
        Request request = page.waitForRequest(r -> r.url().contains("/domains/open-paas.org/addressbooks/dab?action=import"),
            () -> chooser.setFiles(new FilePayload("x.vcf", "text/vcard", vcard.getBytes(StandardCharsets.UTF_8))));
        assertThat(request.method()).isEqualTo("POST");
        assertThat(request.postData()).contains("FN:QA Contact");
        // Environment limitation: the dab does not exist in the side service of the stack
        Locator importError = app.toast("Error importing contacts");
        assertThat(importError).isVisible();
        assertThat(importError).containsText("Address book does not exist");
        assertThat(button(dab, "Import contacts (vCard)")).isEnabled();

        detail.expand(CalendarDomainPage.CONTACTS).expand(CalendarDomainPage.CONTACTS);
        Request export = page.waitForRequest(r -> r.url().contains("/domains/open-paas.org/addressbooks/dab?action=export"),
            () -> button(detail.addressBookRow(DAB), "Export the address book (vCard)").click());
        assertThat(export.method()).isEqualTo("POST");
        Locator exportError = app.toast("Error exporting address book");
        assertThat(exportError).isVisible();
        assertThat(exportError).containsText("Address book does not exist");
    }

    @Test
    @DisplayName("DCON-03 Copy users from another domain")
    void copyUsersFromAnotherDomain(AdminApp app, Page page, CalendarFixtures fixtures) {
        String source = fixtures.newDomain("qa-source");
        CalendarDomainPage detail = new CalendarDomainPage(app).open(CalendarFixtures.DOMAIN).expand(CalendarDomainPage.CONTACTS);

        Locator dialog = openCopyDialog(app, detail);
        assertThat(dialog).containsText("Copying again updates the existing contacts and never deletes any.");
        Locator submit = dialog.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Copy users"));
        Locator sourceDomain = dialog.getByLabel("Source domain");
        assertThat(submit).isDisabled();

        sourceDomain.fill("open-paas.org");
        assertThat(dialog.getByText("The source domain must differ from the current domain")).isVisible();
        assertThat(submit).isDisabled();
        sourceDomain.fill("bad domain");
        assertThat(dialog.getByText("Invalid domain", new Locator.GetByTextOptions().setExact(true))).isVisible();
        assertThat(submit).isDisabled();
        sourceDomain.fill(source);
        assertThat(dialog.getByText("Invalid domain", new Locator.GetByTextOptions().setExact(true))).hasCount(0);
        dialog.getByLabel("LDAP filter (optional)").fill("(employeeType=student)");
        assertThat(submit).isEnabled();

        Request request = page.waitForRequest(r -> r.url().contains("action=copyFrom"), submit::click);
        assertThat(request.url()).contains("/domains/open-paas.org/addressbooks/dab?action=copyFrom&sourceDomain=" + source)
            .contains("ldapFilter=");
        // Environment limitation: copyFrom is refused with 400, shown as the translated message
        Locator error = app.toast("Error copying users");
        assertThat(error).isVisible();
        assertThat(error).containsText("The domain, the source domain or the LDAP filter is invalid");
        assertThat(error).not().containsText("Invalid 'action'");
        assertThat(dialog).isVisible();
    }

    @Test
    @DisplayName("DCON-04 Clear the domain address book")
    void clearDomainAddressBook(AdminApp app, Page page) {
        CalendarDomainPage detail = new CalendarDomainPage(app).open(CalendarFixtures.DOMAIN).expand(CalendarDomainPage.CONTACTS);

        button(detail.addressBookRow(DAB), "Clear contacts").click();
        Locator dialog = app.dialog();
        assertThat(dialog).containsText("This permanently deletes the contacts of the address book. This cannot be undone.");
        Locator submit = dialog.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Clear contacts"));
        Locator confirmation = dialog.getByLabel("Type dab to confirm");
        Locator sourceDomain = dialog.getByLabel("Only contacts with a mail address in domain (optional)");
        assertThat(submit).isDisabled();

        sourceDomain.fill("bad domain");
        assertThat(dialog.getByText("Invalid domain", new Locator.GetByTextOptions().setExact(true))).isVisible();
        confirmation.fill("dab");
        assertThat(submit).isDisabled();
        sourceDomain.fill("");
        assertThat(dialog.getByText("Invalid domain", new Locator.GetByTextOptions().setExact(true))).hasCount(0);
        confirmation.fill("da");
        assertThat(submit).isDisabled();
        confirmation.fill("dab");
        assertThat(submit).isEnabled();

        Request request = page.waitForRequest(r -> r.url().contains("/addressbooks/dab/contacts"), submit::click);
        assertThat(request.method()).isEqualTo("DELETE");
        assertThat(request.url()).endsWith("/domains/open-paas.org/addressbooks/dab/contacts");
        // Environment limitation: the dab does not exist, the refusal is translated
        Locator error = app.toast("Error clearing contacts");
        assertThat(error).isVisible();
        assertThat(error).containsText("The domain or the address book does not exist.");
    }

    @Test
    @DisplayName("X-01 Toasts stay readable while a dialog is open")
    void toastsStayReadableWhileDialogIsOpen(AdminApp app, CalendarFixtures fixtures) {
        String source = fixtures.newDomain("qa-source");
        CalendarDomainPage detail = new CalendarDomainPage(app).open(CalendarFixtures.DOMAIN).expand(CalendarDomainPage.CONTACTS);
        Locator dialog = openCopyDialog(app, detail);
        dialog.getByLabel("Source domain").fill(source);
        dialog.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Copy users")).click();

        // Role based locators only see the accessibility tree: aria-hidden toasts would not be found
        assertThat(dialog).isVisible();
        assertThat(app.toasts()).hasAttribute("aria-label", Pattern.compile("^Notifications \\(F8\\)$"));
        Locator toast = app.toast("Error copying users");
        assertThat(toast).isVisible();
        assertThat(app.toasts().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Close").setExact(true)))
            .not().hasCount(0);
        assertThat(toast.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Close").setExact(true))).hasCount(1);
    }

    private static Locator openCopyDialog(AdminApp app, CalendarDomainPage detail) {
        button(detail.addressBookRow(DAB), "Copy users from another domain").click();
        Locator dialog = app.dialog();
        assertThat(dialog.getByRole(AriaRole.HEADING)).hasText("Copy users from another domain — open-paas.org");
        return dialog;
    }

    private static Locator button(Locator row, String title) {
        return row.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(title).setExact(true));
    }
}
