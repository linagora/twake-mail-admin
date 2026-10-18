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
 * {@code /domains/{domain}/signature-templates} call answers 404, as noted in the test plan): the
 * editor is covered up to the request, and saving / deleting must show the WebAdmin refusal.
 */
class DomainSignatureTemplatesTest extends MailAdminE2ETest {

    @Test
    @DisplayName("DOM-11 Signature templates: add, save, delete")
    void signatureTemplates(AdminApp app, MailFixtures fixtures) {
        String domain = fixtures.domain();
        DomainDetailPage detail = DomainDetailPage.open(app, domain).openSection("Signature Templates");
        assertThat(detail.text("No signature templates configured.")).isVisible();
        assertThat(detail.button("Save changes")).hasCount(0);

        detail.button("Add signature template").click();
        assertThat(detail.sectionButton("Signature Templates", 1)).isVisible();
        assertThat(detail.button("Save changes")).isVisible();

        // Each label focuses its field
        Locator language = detail.main().getByLabel("Language code", new Locator.GetByLabelOptions().setExact(true));
        Locator text = detail.main().getByLabel("Text signature", new Locator.GetByLabelOptions().setExact(true));
        Locator html = detail.main().getByLabel("HTML signature", new Locator.GetByLabelOptions().setExact(true));
        detail.text("Language code").click();
        assertThat(language).isFocused();
        detail.text("Text signature").click();
        assertThat(text).isFocused();
        detail.text("HTML signature").click();
        assertThat(html).isFocused();
        language.fill("en");
        text.fill("Regards");
        html.fill("<p>Regards</p>");
        assertThat(detail.button("Remove template \"en\"")).isVisible();

        // A second template, removed by its own row button only
        detail.button("Add signature template").click();
        assertThat(detail.button("Remove template \"new template\"")).isVisible();
        detail.main().getByLabel("Language code", new Locator.GetByLabelOptions().setExact(true)).fill("fr");
        detail.button("Remove template \"fr\"").click();
        assertThat(detail.button("Remove template \"fr\"")).hasCount(0);
        assertThat(detail.button("Remove template \"en\"")).isVisible();
        assertThat(detail.sectionButton("Signature Templates", 1)).isVisible();

        // Saving: this backend has no such route, the refusal is displayed as text
        detail.button("Save changes").click();
        app.expectToast("Error saving signature templates");
        assertThat(app.toast("Error saving signature templates"))
            .containsText("PUT /domains/" + domain + "/signature-templates can not be found");
        assertThat(app.toast("Error saving signature templates")).not().containsText("{");

        // Delete all asks first
        detail.button("Delete all").click();
        assertThat(app.dialog()).containsText("Delete all signature templates for domain \"" + domain + "\"? This cannot be undone.");
        app.cancel();
        assertThat(detail.button("Remove template \"en\"")).isVisible();
        detail.button("Delete all").click();
        app.confirm();
        app.expectToast("Error deleting signature templates");
        assertThat(app.toast("Error deleting signature templates"))
            .containsText("DELETE /domains/" + domain + "/signature-templates can not be found");

        // After a reload, nothing was stored
        app.page().reload();
        detail = DomainDetailPage.open(app, domain).openSection("Signature Templates");
        assertThat(detail.text("No signature templates configured.")).isVisible();
        assertThat(detail.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Delete all"))).hasCount(0);
    }
}
