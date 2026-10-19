package com.linagora.admin.e2e.mail.ops;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.time.Duration;
import java.util.List;
import java.util.function.UnaryOperator;
import java.util.regex.Pattern;

import org.awaitility.Awaitility;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.ResourceLock;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.Ids;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.docker.BrowserLog;
import com.linagora.admin.e2e.docker.Locks;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.ops.MailRepositoriesPage;
import com.linagora.admin.e2e.pages.mail.ops.MailRepositoryDetailPage;
import com.linagora.admin.e2e.pages.mail.shell.WebAdminStub;
import com.microsoft.playwright.Download;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Request;
import com.microsoft.playwright.options.AriaRole;

/**
 * Mail repositories are server wide: every test works on repositories it creates (unique
 * paths) and on mails it injects itself, and never touches the built-in repositories' content.
 */
@ResourceLock(Locks.MAIL_REPOSITORIES)
class MailRepositoriesTest extends MailAdminE2ETest {

    @Test
    @DisplayName("MR-01 List mail repositories")
    void listMailRepositories(AdminApp app, Page page, WebAdmin webAdmin) {
        String spaced = "var/mail/qa space-" + Ids.suffix(6);
        webAdmin.put("/mailRepositories/" + WebAdmin.encode(spaced) + "?protocol=cassandra").expect(204);

        app.open("/");
        app.navigate("Mail Repositories");
        MailRepositoriesPage repositories = new MailRepositoriesPage(app);

        for (String path : List.of("var/mail/address-error", "var/mail/error", "var/mail/relay-denied", "var/mail/rrt-error")) {
            assertThat(repositories.link(path)).isVisible();
            assertThat(repositories.row(path).getByText(WebAdmin.encode(path), new Locator.GetByTextOptions().setExact(true))).isVisible();
            for (String action : List.of(MailRepositoriesPage.REPROCESS_ALL, MailRepositoriesPage.MOVE_ALL, MailRepositoriesPage.CLEAR_ALL)) {
                assertThat(repositories.action(path, action)).isVisible();
            }
        }
        assertThat(repositories.link(spaced, 0)).isVisible();
        assertThat(repositories.row(spaced).getByText(WebAdmin.encode(spaced), new Locator.GetByTextOptions().setExact(true))).isVisible();

        Request listRequest = page.waitForRequest(
            request -> request.url().contains("/mailRepositories/") && request.url().contains("/mails?"),
            () -> repositories.link(spaced, 0).click());

        assertThat(page).hasURL(Pattern.compile("/mail-repositories/repository/var%2Fmail%2Fqa%20space-"));
        assertThat(page.url()).doesNotContain("+").doesNotContain("?&");
        assertThat(listRequest.url()).contains("qa%20space-").doesNotContain("+").doesNotContain("?&");
        MailRepositoryDetailPage detail = new MailRepositoryDetailPage(app);
        assertThat(detail.title(spaced)).isVisible();
        assertThat(app.main().getByText("No emails found.")).isVisible();
        assertThat(app.main().getByText(Pattern.compile("^Error:"))).hasCount(0);
    }

    @Test
    @DisplayName("MR-02 Create a mail repository")
    void createMailRepository(AdminApp app, WebAdmin webAdmin, BrowserLog browserLog) {
        MailRepositoriesPage repositories = MailRepositoriesPage.open(app);
        String path = "var/mail/" + Ids.unique("qa-repo");
        String bad = "var/mail/" + Ids.unique("qa-bad");

        repositories.newRepositoryButton().click();
        assertThat(app.dialog().getByRole(AriaRole.HEADING)).hasText("Create Mail Repository");
        assertThat(app.dialog().getByLabel("Repository path *", new Locator.GetByLabelOptions().setExact(true))).isVisible();
        assertThat(app.dialog().getByLabel("Protocol *", new Locator.GetByLabelOptions().setExact(true))).isVisible();
        assertThat(repositories.protocolField()).hasValue("cassandra");

        // Both fields empty
        repositories.protocolField().fill("");
        app.clickConfirm();
        assertThat(app.dialog()).isVisible();
        assertThat(app.dialog().getByText("Repository path is required")).isVisible();
        assertThat(app.dialog().getByText("Protocol is required")).isVisible();
        assertThat(repositories.pathField()).hasAttribute("aria-invalid", "true");
        assertThat(repositories.protocolField()).hasAttribute("aria-invalid", "true");

        // Typing clears the error of that field only
        repositories.pathField().fill(bad);
        assertThat(app.dialog().getByText("Repository path is required")).hasCount(0);
        assertThat(repositories.pathField()).hasAttribute("aria-invalid", "false");
        assertThat(app.dialog().getByText("Protocol is required")).isVisible();

        // Refused protocol: the dialog keeps the values, the toast gives the WebAdmin reason
        repositories.protocolField().fill("nope");
        app.clickConfirm();
        assertThat(app.toast("Failed to create the mail repository")).containsText("'nope' is an unsupported protocol");
        assertThat(app.dialog()).isVisible();
        assertThat(repositories.pathField()).hasValue(bad);
        assertThat(repositories.protocolField()).hasValue("nope");
        assertThat(webAdmin.get("/mailRepositories/" + WebAdmin.encode(bad)).status()).isEqualTo(404);
        assertThat(browserLog.pageErrors()).isEmpty();

        // Cancel resets the dialog
        app.cancel();
        repositories.newRepositoryButton().click();
        assertThat(repositories.pathField()).hasValue("");
        assertThat(repositories.protocolField()).hasValue("cassandra");

        repositories.pathField().fill(path);
        app.confirm();
        app.expectToast("Mail repository created successfully");
        assertThat(repositories.link(path, 0)).isVisible();
        assertThat(webAdmin.get("/mailRepositories").expect(200).body()).contains("\"repository\":\"" + path + "\"");
    }

    @Test
    @DisplayName("MR-03 Repository bulk actions: reprocess, move, clear")
    void bulkActions(AdminApp app, Page page, MailFixtures fixtures, WebAdmin webAdmin) {
        String source = OpsBackend.createRepository(webAdmin, "qa-src");
        String target = OpsBackend.createRepository(webAdmin, "qa-dst");
        String sender = fixtures.newUser("sender");
        String recipient = OpsBackend.rrtErrorRecipient(fixtures);
        OpsBackend.injectMails(fixtures, sender, recipient, source, 2);

        MailRepositoriesPage repositories = MailRepositoriesPage.open(app);
        assertThat(repositories.link(source, 2)).isVisible();

        // Reprocess all: the mails go through the mailet container again, back to rrt-error
        repositories.action(source, MailRepositoriesPage.REPROCESS_ALL).click();
        assertThat(app.dialog().getByRole(AriaRole.HEADING)).hasText("Run Task");
        assertThat(app.dialog().getByText("Reprocess all emails in repository " + source + "?", new Locator.GetByTextOptions().setExact(true))).isVisible();
        assertThat(repositories.param("queue")).hasValue("spool");
        assertThat(repositories.param("processor")).hasValue("root");
        assertThat(repositories.param("consume")).isChecked();
        assertThat(repositories.param("limit")).hasValue("");
        assertThat(repositories.param("maxRetries")).hasValue("");
        assertThat(repositories.commandPreview()).hasText("Command: curl -XPATCH /mailRepositories/" + WebAdmin.encode(source)
            + "/mails?action=reprocess&queue=spool&processor=root&consume=true");
        app.confirm();
        Locator toast = app.toast("Task created");
        assertThat(toast.getByRole(AriaRole.LINK)).hasText(Pattern.compile("^Task [0-9a-f-]{36}$"));
        String reprocessTask = OpsBackend.taskIdOf(toast.getByRole(AriaRole.LINK).getAttribute("href"));
        assertThat(webAdmin.awaitTask(reprocessTask).path("status").asText()).isEqualTo("completed");
        assertThat(OpsBackend.size(webAdmin, source)).isZero();
        List<String> reprocessed = OpsBackend.awaitKeys(webAdmin, OpsBackend.RRT_ERROR, "sender=" + sender, keys -> keys.size() >= 2);
        for (String key : reprocessed) {
            webAdmin.patch("/mailRepositories/" + WebAdmin.encode(OpsBackend.RRT_ERROR) + "/mails/" + key,
                "{\"mailRepository\":\"" + source + "\"}").expect(204);
        }

        // Move all, to a repository picked by its plain path
        page.reload();
        repositories.action(source, MailRepositoriesPage.MOVE_ALL).click();
        assertThat(app.dialog().getByRole(AriaRole.HEADING)).hasText("Move All Mails");
        Locator select = app.dialog().getByLabel("Move all mails from " + source + " to:");
        assertThat(select.locator("option", new Locator.LocatorOptions().setHasText(target))).hasCount(1);
        assertThat(select.locator("option", new Locator.LocatorOptions().setHasText(source))).hasCount(0);
        select.selectOption(new com.microsoft.playwright.options.SelectOption().setLabel(target));
        Request move = page.waitForRequest(
            request -> request.method().equals("PATCH") && request.url().endsWith("/mails"),
            app::confirm);
        assertThat(move.url()).endsWith("/mailRepositories/" + WebAdmin.encode(source) + "/mails");
        assertThat(move.postData()).isEqualTo("{\"mailRepository\":\"" + target + "\"}");
        app.expectToast("All mails moved successfully");
        Awaitility.await().atMost(Duration.ofSeconds(20)).untilAsserted(() ->
            assertThat(OpsBackend.mailKeys(webAdmin, target)).containsExactlyInAnyOrderElementsOf(reprocessed));
        assertThat(OpsBackend.size(webAdmin, source)).isZero();
        page.reload();
        assertThat(repositories.link(target, 2)).isVisible();

        // Clear all
        repositories.action(target, MailRepositoriesPage.CLEAR_ALL).click();
        assertThat(app.dialog().getByText("Do you want to clear the mail repository: " + target + ".", new Locator.GetByTextOptions().setExact(true))).isVisible();
        app.confirm();
        Locator clearToast = app.toast("Task created");
        String clearTask = OpsBackend.taskIdOf(clearToast.getByRole(AriaRole.LINK).getAttribute("href"));
        assertThat(webAdmin.awaitTask(clearTask).path("status").asText()).isEqualTo("completed");
        assertThat(OpsBackend.size(webAdmin, target)).isZero();
        page.reload();
        assertThat(repositories.link(target, 0)).isVisible();
    }

    @Test
    @DisplayName("MR-03 Reprocess parameters: custom processor, empty fields, refusal kept in the dialog")
    void reprocessParameters(AdminApp app, Page page, WebAdmin webAdmin) {
        String repository = OpsBackend.createRepository(webAdmin, "qa-reprocess");
        MailRepositoriesPage repositories = MailRepositoriesPage.open(app);

        repositories.action(repository, MailRepositoriesPage.REPROCESS_ALL).click();
        repositories.param("maxRetries").fill("abc");
        app.clickConfirm();
        assertThat(app.dialogError()).containsText("Can not parse maxRetries");
        assertThat(app.dialog()).isVisible();
        assertThat(repositories.param("maxRetries")).hasValue("abc");

        repositories.param("maxRetries").fill("");
        repositories.param("processor").fill("transport");
        assertThat(repositories.commandPreview()).hasText("Command: curl -XPATCH /mailRepositories/" + WebAdmin.encode(repository)
            + "/mails?action=reprocess&queue=spool&processor=transport&consume=true");
        Request reprocess = page.waitForRequest(
            request -> request.method().equals("PATCH") && request.url().contains("action=reprocess"),
            app::confirm);
        String query = reprocess.url().substring(reprocess.url().indexOf('?') + 1);
        assertThat(query.split("&")).filteredOn(param -> param.startsWith("processor=")).containsExactly("processor=transport");
        assertThat(query).doesNotContain("limit=").doesNotContain("maxRetries=").doesNotContain("&&");
        Locator toast = app.toast("Task created");
        String taskId = OpsBackend.taskIdOf(toast.getByRole(AriaRole.LINK).getAttribute("href"));
        assertThat(webAdmin.awaitTask(taskId).path("status").asText()).isEqualTo("completed");
    }

    /** A repository holding 4 mails: 3 from a long sender to recipient A, 1 from a short one to recipient B. */
    private record Seeded(String repository, String other, String longSender, String shortSender,
                          String recipientA, String recipientB, List<String> longKeys, String shortKey) {
    }

    private Seeded seed(MailFixtures fixtures, WebAdmin webAdmin) {
        String repository = OpsBackend.createRepository(webAdmin, "qa-detail");
        String other = OpsBackend.createRepository(webAdmin, "qa-other");
        String longSender = fixtures.newUser("a-much-longer-sender-name");
        String shortSender = fixtures.newUser("s");
        String recipientA = OpsBackend.rrtErrorRecipient(fixtures);
        String recipientB = OpsBackend.rrtErrorRecipient(fixtures);
        List<String> longKeys = OpsBackend.injectMails(fixtures, longSender, recipientA, repository, 3);
        String shortKey = OpsBackend.injectMails(fixtures, shortSender, recipientB, repository, 1).get(0);
        return new Seeded(repository, other, longSender, shortSender, recipientA, recipientB, longKeys, shortKey);
    }

    @Test
    @DisplayName("MR-04 Repository detail and filters")
    void detailAndFilters(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin) {
        Seeded seeded = seed(fixtures, webAdmin);
        MailRepositoriesPage repositories = MailRepositoriesPage.open(app);
        repositories.link(seeded.repository(), 4).click();

        MailRepositoryDetailPage detail = new MailRepositoryDetailPage(app);
        assertThat(detail.title(seeded.repository())).isVisible();
        assertThat(app.main().getByText("Page 1 / 1", new Locator.GetByTextOptions().setExact(true))).isVisible();
        for (String key : seeded.longKeys()) {
            assertThat(detail.mailKey(key)).isVisible();
        }
        assertThat(detail.mailKey(seeded.shortKey())).isVisible();

        detail.filtersToggle().click();
        detail.senderFilter().fill(seeded.shortSender());
        detail.applyFilters().click();
        assertThat(detail.filtersToggle()).containsText("1 filter(s) active");
        assertThat(detail.mailKey(seeded.shortKey())).isVisible();
        assertThat(detail.mailKey(seeded.longKeys().get(0))).hasCount(0);

        detail.resetFilters().click();
        assertThat(detail.mailKey(seeded.longKeys().get(0))).isVisible();
        detail.recipientFilter().fill(seeded.recipientA());
        detail.updatedAfterFilter().fill("1d");
        detail.applyFilters().click();
        assertThat(detail.filtersToggle()).containsText("2 filter(s) active");
        for (String key : seeded.longKeys()) {
            assertThat(detail.mailKey(key)).isVisible();
        }
        assertThat(detail.mailKey(seeded.shortKey())).hasCount(0);

        detail.resetFilters().click();
        detail.updatedBeforeFilter().fill("1d");
        detail.applyFilters().click();
        assertThat(app.main().getByText("No emails found.")).isVisible();
        assertThat(detail.mailKey(seeded.shortKey())).hasCount(0);
    }

    @Test
    @DisplayName("MR-04 Extended view: columns, sort, mail details")
    void extendedView(AdminApp app, Page page, MailFixtures fixtures, WebAdmin webAdmin) {
        Seeded seeded = seed(fixtures, webAdmin);
        MailRepositoriesPage repositories = MailRepositoriesPage.open(app);
        repositories.link(seeded.repository(), 4).click();
        MailRepositoryDetailPage detail = new MailRepositoryDetailPage(app);
        detail.extendedViewLink().click();

        assertThat(detail.extendedTitle()).isVisible();
        for (String column : List.of("Name / Sender", "Recipients", "Last Updated", "Size", "Actions")) {
            assertThat(app.main().getByText(column, new Locator.GetByTextOptions().setExact(true))
                .filter(new Locator.FilterOptions().setVisible(true)).first()).isVisible();
        }
        assertThat(detail.mailButtons()).hasCount(4);
        assertThat(detail.extendedRow(seeded.shortKey())).containsText(seeded.shortSender());
        assertThat(detail.extendedRow(seeded.shortKey())).containsText(seeded.recipientB());
        assertThat(detail.extendedRow(seeded.shortKey()).getByText(Pattern.compile("^\\d+ B$"))).isVisible();

        // The size is estimated from the JSON of the mail: the long sender makes the larger mails
        detail.sortField().selectOption("size");
        assertThat(detail.sortDirection()).hasText("Ascending");
        assertThat(detail.mailButtons().first()).hasText(seeded.shortKey());
        detail.sortDirection().click();
        assertThat(detail.sortDirection()).hasText("Descending");
        assertThat(detail.mailButtons().last()).hasText(seeded.shortKey());

        // The mail name opens its details, with the mouse and from the keyboard
        detail.mailButton(seeded.shortKey()).click();
        assertThat(app.dialog().getByRole(AriaRole.HEADING)).hasText("Email Details");
        assertThat(app.dialog()).containsText(seeded.shortSender());
        page.keyboard().press("Escape");
        assertThat(app.dialog()).isHidden();
        assertThat(detail.mailButton(seeded.shortKey())).isFocused();
        page.keyboard().press("Enter");
        assertThat(app.dialog().getByRole(AriaRole.HEADING)).hasText("Email Details");
        page.keyboard().press("Escape");
        assertThat(app.dialog()).isHidden();
        detail.mailButton(seeded.longKeys().get(0)).focus();
        page.keyboard().press(" ");
        assertThat(app.dialog()).containsText(seeded.longKeys().get(0));
        page.keyboard().press("Escape");
        assertThat(app.dialog()).isHidden();
    }

    @Test
    @DisplayName("MR-04 Per mail actions: download, reprocess, move, delete")
    void perMailActions(AdminApp app, Page page, MailFixtures fixtures, WebAdmin webAdmin) {
        Seeded seeded = seed(fixtures, webAdmin);
        String downloaded = seeded.longKeys().get(0);
        String reprocessed = seeded.longKeys().get(1);
        String deleted = seeded.longKeys().get(2);
        String vanished = seeded.shortKey();

        app.open("/mail-repositories/repository/" + WebAdmin.encode(seeded.repository()) + "/extended?page=1&size=4");
        MailRepositoryDetailPage detail = new MailRepositoryDetailPage(app);
        assertThat(detail.mailButtons()).hasCount(4);

        Download download = page.waitForDownload(() -> detail.rowAction(downloaded, MailRepositoryDetailPage.DOWNLOAD).click());
        assertThat(download.suggestedFilename()).isEqualTo(downloaded + ".eml");

        // A failed download tells the WebAdmin reason
        webAdmin.delete("/mailRepositories/" + WebAdmin.encode(seeded.repository()) + "/mails/" + vanished).expect(204);
        detail.rowAction(vanished, MailRepositoryDetailPage.DOWNLOAD).click();
        Locator error = app.toast("Error downloading mail");
        assertThat(error).containsText("Could not retrieve " + vanished);
        assertThat(error).not().containsText("Request failed with status code");

        detail.rowAction(reprocessed, MailRepositoryDetailPage.REPROCESS).click();
        assertThat(app.dialog().getByRole(AriaRole.HEADING)).hasText("Reprocess Email");
        app.confirm();
        Locator scheduled = app.toast("Reprocessing scheduled");
        String taskId = OpsBackend.taskIdOf(scheduled.getByRole(AriaRole.LINK).getAttribute("href"));
        assertThat(webAdmin.awaitTask(taskId).path("status").asText()).isEqualTo("completed");
        assertThat(OpsBackend.mailKeys(webAdmin, seeded.repository())).doesNotContain(reprocessed);

        detail.rowAction(downloaded, MailRepositoryDetailPage.MOVE).click();
        assertThat(app.dialog().getByRole(AriaRole.HEADING)).hasText("Move Email");
        app.dialog().getByRole(AriaRole.COMBOBOX).selectOption(new com.microsoft.playwright.options.SelectOption().setLabel(seeded.other()));
        app.confirm();
        app.expectToast("Email moved successfully");
        assertThat(OpsBackend.mailKeys(webAdmin, seeded.other())).containsExactly(downloaded);

        detail.rowAction(deleted, MailRepositoryDetailPage.DELETE).click();
        assertThat(app.dialog().getByRole(AriaRole.HEADING)).hasText("Delete Email");
        app.confirm();
        app.expectToast("Email removed successfully");
        assertThat(detail.mailButton(deleted)).hasCount(0);
        Awaitility.await().atMost(Duration.ofSeconds(10))
            .untilAsserted(() -> assertThat(OpsBackend.mailKeys(webAdmin, seeded.repository())).doesNotContain(deleted, downloaded));
    }

    @Test
    @DisplayName("MR-04 Basic view: (JSON) and (MIME) of a mail, its HTML shown as text")
    void jsonAndMimeOfAMail(AdminApp app, Page page, MailFixtures fixtures, WebAdmin webAdmin) throws Exception {
        String repository = OpsBackend.createRepository(webAdmin, "qa-json");
        String sender = fixtures.newUser("json");
        String recipient = OpsBackend.rrtErrorRecipient(fixtures);
        String marker = Ids.unique("qa");
        // What an outside sender may write: the popup must show it as text, never parse it
        String hostile = "<img src=x onerror=\"window.opener.__xss=1\">" + marker + "<b>bold</b>";
        String key = OpsBackend.injectMail(fixtures, sender, recipient, repository, hostile, hostile);
        String mailPath = "/mailRepositories/" + WebAdmin.encode(repository) + "/mails/" + key;

        // The (JSON) request asks for no additionalFields: WebAdmin answers headers and bodies as
        // null. The real answer is completed, for this browser only, with the hostile Subject in the
        // fields that carry it when asked for, and in the error
        UnaryOperator<JsonNode> withHostileFields = mail -> {
            ObjectNode completed = mail.deepCopy();
            completed.put("error", hostile).put("textBody", hostile).put("htmlBody", hostile);
            completed.putObject("headers").putArray("Subject").add(hostile);
            return completed;
        };
        WebAdminStub.rewrite(page, webAdmin, path -> path.endsWith("/mails/" + key),
            body -> withHostileFields.apply(jsonOf(body)).toString());
        List<String> accepted = new java.util.ArrayList<>();
        page.onRequest(request -> {
            if (request.url().endsWith("/mails/" + key)) {
                accepted.add(java.net.URI.create(request.url()).getRawPath() + " " + request.headers().get("accept"));
            }
        });

        app.open("/mail-repositories/repository/" + WebAdmin.encode(repository));
        MailRepositoryDetailPage detail = new MailRepositoryDetailPage(app);
        assertThat(detail.title(repository)).isVisible();
        Locator row = app.main().getByRole(AriaRole.LISTITEM).filter(new Locator.FilterOptions().setHasText(key));
        Page popup = page.waitForPopup(() ->
            row.getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName("(JSON)").setExact(true)).click());

        Locator pre = popup.locator("pre");
        // JSON escapes the quotes only
        assertThat(pre).containsText("<img src=x onerror=");
        assertThat(pre).containsText(marker + "<b>bold</b>");
        String shown = pre.textContent();
        JsonNode real = webAdmin.get(mailPath).expect(200).json();
        assertThat(real.path("name").asText()).isEqualTo(key);
        assertThat(real.path("sender").asText()).isEqualTo(sender);
        assertThat(WebAdmin.JSON.readTree(shown)).isEqualTo(withHostileFields.apply(real));
        assertThat(shown).as("pretty printed").contains("\n  \"");
        assertThat(popup.locator("img, b")).hasCount(0);
        assertThat(page.evaluate("() => window.__xss")).isNull();
        assertThat(accepted).containsExactly(mailPath + " application/json");
        popup.close();

        // (MIME) gets the real message/rfc822 of WebAdmin, where the Subject is the one sent
        page.unrouteAll();
        Download mime = page.waitForDownload(() ->
            row.getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName("(MIME)").setExact(true)).click());
        assertThat(mime.suggestedFilename()).isEqualTo(key + ".eml");
        assertThat(Files.readString(mime.path())).contains("Subject: " + hostile).contains(marker);
        assertThat(page.evaluate("() => window.__xss")).isNull();
    }

    private static JsonNode jsonOf(String body) {
        try {
            return WebAdmin.JSON.readTree(body);
        } catch (Exception e) {
            throw new IllegalStateException(body, e);
        }
    }
}
