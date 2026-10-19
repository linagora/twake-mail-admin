package com.linagora.admin.e2e.calendar.resources;

import static com.linagora.admin.e2e.calendar.resources.DomainCalendarsBackend.DOMAIN;
import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;

import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.calendar.resources.DomainCalendarRow;
import com.linagora.admin.e2e.pages.calendar.resources.PublicVisibilityDialog;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Request;

/** RES-06 and TCAL-06 share the dialog. */
final class VisibilityChecks {
    static final String PUBLIC = "{DAV:}read";
    static final String PRIVATE = "";

    private VisibilityChecks() {
    }

    /** {@code /domains/open-paas.org/{resources|team-calendars}/{id}}. */
    static String calendarPath(String collection, String id) {
        return "/domains/" + DOMAIN + "/" + collection + "/" + id;
    }

    static void expectNothingPreselected(PublicVisibilityDialog dialog) {
        assertThat(dialog.root()).isVisible();
        assertThat(dialog.root()).containsText(PublicVisibilityDialog.HINT);
        assertThat(dialog.publicOption()).not().isChecked();
        assertThat(dialog.privateOption()).not().isChecked();
        assertThat(dialog.saveButton()).isDisabled();
    }

    /** Chooses {@code option} and saves: one request, for that calendar, carrying {@code expectedRight}. */
    static void choose(AdminApp app, PublicVisibilityDialog dialog, Locator option, String calendarPath, String expectedRight) {
        option.check();
        assertThat(dialog.saveButton()).isEnabled();
        Request request = app.page().waitForRequest(r -> r.url().endsWith("/publicRight"), () -> dialog.saveButton().click());
        assertThat(request.method()).isEqualTo("POST");
        assertThat(request.url()).endsWith(calendarPath + "/publicRight");
        assertThat(publicRight(request)).isEqualTo(expectedRight);
        app.expectToast("Visibility updated");
        assertThat(dialog.root()).isHidden();
    }

    /**
     * Public, then Private, then Public cancelled, on the calendar {@code id} of {@code row}: checks
     * each request and, through Sabre, the right applied; {@code untouchedIds} are calendars listed
     * next to it, whose visibility must not change.
     */
    static void makePublicThenPrivate(AdminApp app, DomainCalendarRow row, String collection, String id,
                                      PublicReadProbe probe, String... untouchedIds) {
        String path = calendarPath(collection, id);
        List<Boolean> untouched = List.of(untouchedIds).stream().map(probe::isPublic).toList();

        PublicVisibilityDialog dialog = row.openVisibility();
        expectNothingPreselected(dialog);
        choose(app, dialog, dialog.publicOption(), path, PUBLIC);
        assertThat(probe.isPublic(id)).isTrue();

        dialog = row.openVisibility();
        expectNothingPreselected(dialog);
        choose(app, dialog, dialog.privateOption(), path, PRIVATE);
        assertThat(probe.isPublic(id)).isFalse();

        // Cancel applies nothing
        List<String> sent = new CopyOnWriteArrayList<>();
        Consumer<Request> recorder = r -> {
            if (r.url().endsWith("/publicRight")) {
                sent.add(r.url());
            }
        };
        app.page().onRequest(recorder);
        try {
            dialog = row.openVisibility();
            dialog.publicOption().check();
            app.cancel();
            assertThat(dialog.root()).isHidden();
        } finally {
            app.page().offRequest(recorder);
        }
        assertThat(sent).isEmpty();
        assertThat(probe.isPublic(id)).isFalse();

        // The dialog acted on its own row only
        assertThat(List.of(untouchedIds).stream().map(probe::isPublic).toList()).isEqualTo(untouched);
    }

    private static String publicRight(Request request) {
        try {
            return WebAdmin.JSON.readTree(request.postData()).path("public_right").asText(null);
        } catch (IOException e) {
            throw new IllegalStateException("Not JSON: " + request.postData(), e);
        }
    }
}
