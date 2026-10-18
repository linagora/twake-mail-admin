package com.linagora.admin.e2e.calendar.ops;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.ResourceLock;

import com.linagora.admin.e2e.CalendarAdminE2ETest;
import com.linagora.admin.e2e.backend.CalendarFixtures;
import com.linagora.admin.e2e.backend.Ids;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.docker.CalendarStack;
import com.linagora.admin.e2e.docker.Locks;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.calendar.ops.UnsentMailsPage;
import com.microsoft.playwright.Download;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Request;
import com.microsoft.playwright.options.AriaRole;

/**
 * Unsent mails are produced for real: the mock SMTP server is told to refuse a recipient unique to
 * the test, and an event organized by a user of the test invites that recipient; the side service
 * retains the invitation it could not deliver. The list is global: the class takes the lock, and
 * every test removes its refusal and its mails.
 */
@ResourceLock(Locks.CALENDAR_UNSENT_MAILS)
class UnsentMailsTest extends CalendarAdminE2ETest {
    private OpsBackend backend;
    private final List<String> markers = new ArrayList<>();
    private final List<String> senders = new ArrayList<>();

    @AfterEach
    void cleanUp() {
        if (backend == null) {
            return;
        }
        markers.forEach(backend::acceptRecipients);
        senders.forEach(backend::deleteUnsentMails);
    }

    private OpsBackend backend(WebAdmin webAdmin, CalendarStack stack) {
        backend = new OpsBackend(webAdmin, stack);
        return backend;
    }

    /** A refused recipient address, unique to the test. */
    private String refusedRecipient() {
        String marker = "refused-" + Ids.suffix(8);
        backend.rejectRecipients(marker);
        markers.add(marker);
        return marker + "@example.com";
    }

    private String sender(CalendarFixtures fixtures) {
        String sender = fixtures.newRegisteredUser("unsops");
        senders.add(sender);
        return sender;
    }

    /** Has {@code sender} invite {@code recipient}, waits for the retained mail, returns its id. */
    private String unsentMail(String sender, String recipient) {
        int before = backend.unsentMailIds(sender).size();
        backend.invite(sender, recipient);
        List<String> ids = backend.awaitUnsentMails(sender, before + 1);
        return ids.stream().filter(id -> backend.unsentMail(id).path("rcptTo").toString().contains(recipient)).findFirst().orElseThrow();
    }

    @Test
    @DisplayName("UNS-01 Unsent mails page and filters")
    void unsentMailsPageAndFilters(AdminApp app, CalendarFixtures fixtures, WebAdmin webAdmin, CalendarStack stack) {
        backend(webAdmin, stack);
        boolean empty = webAdmin.get("/unsentMails").expect(200).json().isEmpty();

        UnsentMailsPage mails = UnsentMailsPage.open(app);
        assertThat(app.main().getByText("Mails that failed SMTP delivery, retained for inspection and re-emission.")).isVisible();
        assertThat(mails.resendAll()).isEnabled();
        assertThat(mails.deleteAll()).isEnabled();
        assertThat(mails.recipientFilter()).isVisible();
        assertThat(app.main().getByText("Error")).hasCount(0);
        if (empty) {
            assertThat(app.main().getByText("No unsent mail.", new Locator.GetByTextOptions().setExact(true))).isVisible();
        }

        String sender = sender(fixtures);
        String recipient = refusedRecipient();
        String id = unsentMail(sender, recipient);
        mails = UnsentMailsPage.open(app);

        mails.senderFilter().fill(sender);
        assertThat(mails.rows()).hasCount(1);
        assertThat(mails.row(id)).containsText("Sender: " + sender);
        mails.senderFilter().fill("");
        assertThat(mails.row(id)).isVisible();
        String marker = recipient.substring(0, recipient.indexOf('@'));
        mails.recipientFilter().fill(marker);
        assertThat(mails.rows()).hasCount(1);
        assertThat(mails.row(id)).containsText("Recipient: " + recipient);
        mails.recipientFilter().fill("zzz-" + Ids.suffix(8));
        assertThat(mails.rows()).hasCount(0);
        assertThat(app.main().getByText("No unsent mail matches the filters.")).isVisible();
    }

    @Test
    @DisplayName("UNS-02 Bulk resend and delete carry the filters")
    void bulkResendAndDeleteCarryTheFilters(AdminApp app, Page page, CalendarFixtures fixtures, WebAdmin webAdmin, CalendarStack stack) {
        backend(webAdmin, stack);
        String sender = sender(fixtures);
        String recipient = refusedRecipient();
        String first = unsentMail(sender, recipient);
        // Accepted again: the resend delivers it
        backend.acceptRecipients(markers.get(0));

        UnsentMailsPage mails = UnsentMailsPage.open(app);
        mails.resendAll().click();
        assertThat(app.dialog()).containsText("Schedule a task re-emitting every retained mail?");
        app.confirm();
        Locator link = app.toast("Resend task submitted").getByRole(AriaRole.LINK);
        assertThat(link).hasText(Pattern.compile("^Task [0-9a-f-]{36}$"));
        String resendTask = link.textContent().substring("Task ".length());
        assertThat(webAdmin.awaitTask(resendTask).path("status").asText()).isEqualTo("completed");
        assertThat(backend.unsentMailIds(sender)).doesNotContain(first);

        backend.rejectRecipients(markers.get(0));
        String second = unsentMail(sender, recipient);
        mails = UnsentMailsPage.open(app);
        mails.senderFilter().fill(sender);
        assertThat(mails.row(second)).isVisible();
        mails.deleteAll().click();
        assertThat(app.dialog()).containsText("Sender: " + sender);
        Request request = page.waitForRequest(r -> r.method().equals("POST") && r.url().contains("/unsentMails?"), app::confirm);
        assertThat(request.url()).endsWith("/unsentMails?action=delete&sender=" + WebAdmin.encode(sender));
        link = app.toast("Deletion task submitted").getByRole(AriaRole.LINK);
        String deleteTask = link.textContent().substring("Task ".length());
        assertThat(webAdmin.awaitTask(deleteTask).path("status").asText()).isEqualTo("completed");
        assertThat(backend.unsentMailIds(sender)).isEmpty();
    }

    @Test
    @DisplayName("UNS-03 Unsent mail detail, resend, download and delete")
    void unsentMailDetail(AdminApp app, Page page, CalendarFixtures fixtures, WebAdmin webAdmin, CalendarStack stack) throws IOException {
        backend(webAdmin, stack);
        String sender = sender(fixtures);
        String recipient = refusedRecipient();
        String other = refusedRecipient();
        String id = unsentMail(sender, recipient);
        String otherId = unsentMail(sender, other);

        UnsentMailsPage mails = UnsentMailsPage.open(app);
        mails.senderFilter().fill(sender);
        assertThat(mails.rows()).hasCount(2);
        Locator row = mails.row(id);
        assertThat(row).containsText("Date:");
        assertThat(row).containsText("Sender: " + sender);
        assertThat(row).containsText("Recipient: " + recipient);
        for (String action : new String[] {"Resend this mail", "Download mail content", "Delete this mail"}) {
            assertThat(mails.rowAction(id, action)).isVisible();
        }

        row.getByRole(AriaRole.HEADING).click();
        assertThat(page).hasURL(Pattern.compile("/unsent-mails/mail/" + id + "$"));
        Locator detail = app.main();
        assertThat(detail.getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setName("Unsent mail details"))).isVisible();
        assertThat(detail.getByText(id, new Locator.GetByTextOptions().setExact(true))).isVisible();
        assertThat(detail.locator("dl")).containsText("Sender" + sender);
        assertThat(detail.locator("dl")).containsText("Recipient" + recipient);
        assertThat(detail.locator("dl")).containsText("Date");
        assertThat(detail.getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setName("Sending trials"))).isVisible();
        assertThat(detail.getByRole(AriaRole.LISTITEM)).hasCount(1);

        app.button("Show content").click();
        assertThat(detail.locator("pre")).containsText("Subject: New event from " + sender);
        app.button("Hide content").click();
        assertThat(detail.locator("pre")).hasCount(0);

        Download download = page.waitForDownload(() -> app.button("Download mail content").click());
        assertThat(download.suggestedFilename()).isEqualTo(id + ".eml");
        assertThat(Files.readString(download.path())).contains("To: " + recipient);

        app.button("Resend this mail").click();
        assertThat(app.dialog()).containsText("Resend unsent mail " + id + "?");
        app.confirm();
        assertThat(app.toast("Resend task submitted")).containsText("Task ");

        mails = UnsentMailsPage.open(app);
        mails.senderFilter().fill(sender);
        mails.rowAction(otherId, "Delete this mail").click();
        assertThat(app.dialog()).containsText("Delete unsent mail " + otherId + "? This cannot be undone.");
        app.confirm();
        app.expectToast("Mail deleted");
        assertThat(mails.row(otherId)).hasCount(0);
        assertThat(webAdmin.get("/unsentMails/" + otherId).status()).isEqualTo(404);
    }

    @Test
    @DisplayName("UNS-04 Bulk actions need complete addresses")
    void bulkActionsNeedCompleteAddresses(AdminApp app, CalendarFixtures fixtures, WebAdmin webAdmin, CalendarStack stack) {
        backend(webAdmin, stack);
        String tag = Ids.suffix(6);
        String alice = "al" + tag + "@open-paas.org";
        String malice = "mal" + tag + "@open-paas.org";
        for (String user : new String[] {alice, malice}) {
            webAdmin.put("/users/" + user, "{\"password\":\"secret\"}").expect(204);
            fixtures.register(user);
            senders.add(user);
        }
        String recipient = refusedRecipient();
        backend.invite(alice, recipient);
        backend.invite(malice, recipient);
        String aliceMail = backend.awaitUnsentMails(alice, 1).get(0);
        String maliceMail = backend.awaitUnsentMails(malice, 1).get(0);

        UnsentMailsPage mails = UnsentMailsPage.open(app);
        mails.senderFilter().fill("al" + tag);
        assertThat(mails.resendAll()).isDisabled();
        assertThat(mails.deleteAll()).isDisabled();
        assertThat(mails.bulkHint()).isVisible();
        assertThat(mails.row(aliceMail)).isVisible();
        assertThat(mails.row(maliceMail)).isVisible();

        mails.senderFilter().fill(alice);
        assertThat(mails.resendAll()).isEnabled();
        assertThat(mails.deleteAll()).isEnabled();
        assertThat(mails.bulkHint()).isHidden();
        assertThat(mails.row(aliceMail)).isVisible();
        assertThat(mails.row(maliceMail)).hasCount(0);

        mails.recipientFilter().fill(recipient.substring(0, 10));
        assertThat(mails.resendAll()).isDisabled();
        assertThat(mails.bulkHint()).isVisible();
        mails.recipientFilter().fill(recipient.toUpperCase());
        assertThat(mails.resendAll()).isEnabled();
        assertThat(mails.deleteAll()).isEnabled();
        assertThat(mails.bulkHint()).isHidden();
        assertThat(mails.row(aliceMail)).isVisible();

        mails.filter("", "");
        assertThat(mails.resendAll()).isEnabled();
        assertThat(mails.bulkHint()).isHidden();
    }
}
