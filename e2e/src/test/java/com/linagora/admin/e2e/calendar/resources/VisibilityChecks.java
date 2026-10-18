package com.linagora.admin.e2e.calendar.resources;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.calendar.resources.DomainCalendarRow;
import com.linagora.admin.e2e.pages.calendar.resources.PublicVisibilityDialog;
import com.microsoft.playwright.Locator;

/** RES-06 and TCAL-06 share the dialog. */
final class VisibilityChecks {
    private VisibilityChecks() {
    }

    static void expectNothingPreselected(PublicVisibilityDialog dialog) {
        assertThat(dialog.root()).isVisible();
        assertThat(dialog.root()).containsText(PublicVisibilityDialog.HINT);
        assertThat(dialog.publicOption()).not().isChecked();
        assertThat(dialog.privateOption()).not().isChecked();
        assertThat(dialog.saveButton()).isDisabled();
    }

    static void choose(AdminApp app, PublicVisibilityDialog dialog, Locator option) {
        option.check();
        assertThat(dialog.saveButton()).isEnabled();
        dialog.saveButton().click();
        app.expectToast("Visibility updated");
        assertThat(dialog.root()).isHidden();
    }

    static void makePublicThenPrivate(AdminApp app, DomainCalendarRow row) {
        PublicVisibilityDialog dialog = row.openVisibility();
        expectNothingPreselected(dialog);
        choose(app, dialog, dialog.publicOption());

        dialog = row.openVisibility();
        expectNothingPreselected(dialog);
        choose(app, dialog, dialog.privateOption());
    }
}
