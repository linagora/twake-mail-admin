package com.linagora.admin.e2e.mail.domains;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.domains.DomainDetailPage;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.AriaRole;

/**
 * DOM-11. The tmail-backend of the e2e stack has no signature templates routes (every
 * {@code /domains/{domain}/signature-templates} call answers a route-missing 404, as noted in the test
 * plan): the section says so up front, instead of an editor that cannot save.
 */
class DomainSignatureTemplatesTest extends MailAdminE2ETest {

    @Test
    @DisplayName("DOM-11 Signature templates: not available on this server")
    void signatureTemplates(AdminApp app, MailFixtures fixtures) {
        String domain = fixtures.domain();
        DomainDetailPage detail = DomainDetailPage.open(app, domain).openSection("Signature Templates");

        Locator unavailable = unavailable(detail);
        assertThat(unavailable).isVisible();
        assertThat(unavailable).containsText(
            "This server does not expose the signature template routes (/domains/{domain}/signature-templates).");
        assertThat(unavailable.getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName("doc").setExact(true))).isVisible();
        assertThat(detail.main()).not().containsText("can not be found");
        assertThat(detail.text("No signature templates configured.")).hasCount(0);

        // Nothing to edit: no counter, no add, no save, no delete
        assertThat(detail.sectionButton("Signature Templates")).not().containsText("(");
        assertThat(detail.button("Add signature template")).hasCount(0);
        assertThat(detail.button("Save changes")).hasCount(0);
        assertThat(detail.button("Delete all")).hasCount(0);

        // The domain task applying the templates cannot run either
        detail.openSection("Tasks");
        assertThat(applySignatureTemplatesRunButton(detail)).isDisabled();

        // Still said after a reload
        app.page().reload();
        detail = DomainDetailPage.open(app, domain).openSection("Signature Templates");
        assertThat(unavailable(detail)).isVisible();
    }

    private static Locator unavailable(DomainDetailPage detail) {
        return detail.main().getByRole(AriaRole.STATUS)
            .filter(new Locator.FilterOptions().setHasText("Signature templates are not available on this server"));
    }

    private static Locator applySignatureTemplatesRunButton(DomainDetailPage detail) {
        return detail.text("Apply signature templates").locator("xpath=ancestor::div[.//button][1]")
            .getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(AdminApp.RUN_TASK_BUTTON));
    }
}
