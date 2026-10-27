package com.linagora.admin.e2e.mail.shell;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Pattern;

import org.awaitility.Awaitility;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.ResourceLock;

import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.Ids;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.docker.Locks;
import com.linagora.admin.e2e.mail.ops.OpsBackend;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.ops.Dialogs;
import com.linagora.admin.e2e.pages.mail.ops.MailRepositoryDetailPage;
import com.linagora.admin.e2e.pages.mail.shell.Shell;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Route;
import com.microsoft.playwright.options.AriaRole;

class KeyboardTest extends MailAdminE2ETest {

    private static Locator sectionToggle(AdminApp app, String title) {
        return app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(Pattern.compile("^" + Shell.quote(title) + "( \\(\\d+\\))?$")));
    }

    /** Presses Tab until {@code target} has the focus. */
    private static void tabTo(Page page, Locator target) {
        for (int i = 0; i < 40; i++) {
            if ((Boolean) target.evaluate("e => e === document.activeElement")) {
                return;
            }
            page.keyboard().press("Tab");
        }
        throw new AssertionError("Tab never reached " + target);
    }

    /** Opens the detail dialog of {@code label} with {@code key}, closes it with Escape, checks the focus comes back. */
    private static void openWithKey(AdminApp app, Locator label, String key, String dialogTitle, String loadedText) {
        tabTo(app.page(), label);
        app.page().keyboard().press(key);
        Locator dialog = app.page().getByRole(AriaRole.DIALOG, new Page.GetByRoleOptions().setName(dialogTitle));
        assertThat(dialog).isVisible();
        // Escape once the detail is loaded: see contactDismissedWhileLoadingStaysClosed
        assertThat(dialog).containsText(loadedText);
        app.page().keyboard().press("Escape");
        assertThat(dialog).isHidden();
        assertThat(label).isFocused();
    }

    @Test
    @DisplayName("NAV-09 Open list details from the keyboard")
    void openDetailsFromKeyboard(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin) {
        String user = fixtures.newUser("kbd");
        String name = Ids.unique("Nick");
        webAdmin.post("/users/" + user + "/identities",
            "{\"name\":\"" + name + "\",\"email\":\"" + user + "\",\"textSignature\":\"\",\"htmlSignature\":\"\",\"sortOrder\":0}").expect(201);
        String contact = Ids.unique("contact") + "@" + fixtures.domain();
        webAdmin.post("/domains/" + fixtures.domain() + "/contacts", "{\"emailAddress\":\"" + contact + "\",\"firstname\":\"Kim\",\"surname\":\"Board\"}")
            .expect(201);

        // 1. JMAP identities of the user
        app.open("/users/user/" + WebAdmin.encode(user));
        sectionToggle(app, "JMAP Identities").click();
        Locator identity = app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(name + " <" + user + ">").setExact(true));
        assertThat(identity).isVisible();
        sectionToggle(app, "JMAP Identities").focus();
        openWithKey(app, identity, "Enter", "Identity — " + name, user);
        openWithKey(app, identity, " ", "Identity — " + name, user);
        // Same dialog as a mouse click
        identity.click();
        assertThat(app.page().getByRole(AriaRole.DIALOG, new Page.GetByRoleOptions().setName("Identity — " + name))).isVisible();
        app.page().keyboard().press("Escape");

        // 2. Domain contacts: the listing is served by an eventually consistent index
        Awaitility.await().atMost(Duration.ofSeconds(30)).pollInterval(Duration.ofMillis(300))
            .until(() -> webAdmin.get("/domains/" + fixtures.domain() + "/contacts").body().contains(contact));
        app.open("/domains/domain/" + fixtures.domain());
        sectionToggle(app, "Domain Contacts").click();
        Locator contactLabel = app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(contact).setExact(true));
        assertThat(contactLabel).isVisible();
        sectionToggle(app, "Domain Contacts").focus();
        openWithKey(app, contactLabel, "Enter", "Contact Details", contact);
        openWithKey(app, contactLabel, " ", "Contact Details", contact);
    }

    // known-bug: closing the contact detail dialog (Escape) while it is loading does not cancel the load:
    // the dialog opens again once WebAdmin answers (domain-contacts.tsx openView sets viewContact anyway)
    @Test
    @Tag("known-bug")
    @DisplayName("NAV-09 A contact detail dismissed while loading stays closed")
    void contactDismissedWhileLoadingStaysClosed(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin, Page page) {
        String contact = Ids.unique("contact") + "@" + fixtures.domain();
        webAdmin.post("/domains/" + fixtures.domain() + "/contacts", "{\"emailAddress\":\"" + contact + "\"}").expect(201);
        Awaitility.await().atMost(Duration.ofSeconds(30)).pollInterval(Duration.ofMillis(300))
            .until(() -> webAdmin.get("/domains/" + fixtures.domain() + "/contacts").body().contains(contact));
        // Holds the detail request until the dialog has been dismissed
        AtomicReference<Route> held = new AtomicReference<>();
        String detailPath = "/domains/" + fixtures.domain() + "/contacts/" + contact.substring(0, contact.indexOf('@'));
        page.route(url -> java.net.URI.create(url).getRawPath().equals(detailPath), held::set);

        app.open("/domains/domain/" + fixtures.domain());
        sectionToggle(app, "Domain Contacts").click();
        app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(contact).setExact(true)).click();
        Locator dialog = page.getByRole(AriaRole.DIALOG, new Page.GetByRoleOptions().setName("Contact Details"));
        assertThat(dialog).isVisible();
        Awaitility.await().atMost(Duration.ofSeconds(10)).until(() -> {
            page.evaluate("() => 0");
            return held.get() != null;
        });
        page.keyboard().press("Escape");
        assertThat(dialog).isHidden();

        held.get().resume();
        page.waitForResponse(response -> response.url().endsWith(detailPath), () -> { });
        assertThat(dialog).isHidden();
    }

    @Test
    @DisplayName("NAV-10 Toasts stay accessible while a dialog is open")
    @ResourceLock(Locks.MAIL_REPOSITORIES)
    void toastsAccessibleOverDialog(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin) {
        String repository = OpsBackend.createRepository(webAdmin, "qa-toast");
        String key = OpsBackend.injectMails(fixtures, fixtures.newUser("toast"), OpsBackend.rrtErrorRecipient(fixtures), repository, 1).get(0);

        // The JSON dialog of a mail stays open once its Copy button toasts
        app.open("/mail-repositories/repository/" + WebAdmin.encode(repository));
        new MailRepositoryDetailPage(app).viewJson(key).click();
        assertThat(app.dialog()).isVisible();
        Dialogs.button(app, "Copy").click();

        // Located by role: an aria-hidden toast (hidden by the modal) would not be found
        Locator toast = app.toast("Copied to clipboard");
        assertThat(toast).isVisible();
        assertThat(app.page().locator("body").ariaSnapshot()).contains("Copied to clipboard");

        // Closed by its button: Escape goes to the topmost layer, the toast, not the dialog
        assertThat(app.dialog()).isVisible();
        app.cancel("Close");
    }
}
