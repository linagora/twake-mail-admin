package com.linagora.admin.e2e.mail.ops;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;
import java.util.function.UnaryOperator;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.IntStream;

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
import com.linagora.admin.e2e.pages.mail.ops.Regex;
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

    // ---- Paging: more mails than one page (200) -----------------------------------------

    private static final int PAGE_SIZE = 200;
    private static final int TOTAL = 450;
    /** Index, in the listing, of the first real mail of a padded repository: row 251, on page 2. */
    private static final int REAL_MAILS_AT = 250;
    /** A row of the simple view: {@code "<n> /"}, the key, then the (JSON) (MIME) links. */
    private static final Pattern ROW = Pattern.compile("^(\\d+) /\\s*(.+?)\\s*(?:\\(JSON\\).*)?$", Pattern.DOTALL);

    /**
     * Pads, for this test's browser only, the listing of {@code repository} up to {@code TOTAL}
     * mails: made-up keys, with the real mails of the repository (read from WebAdmin on every
     * request, so that an action on them shows) inserted from row {@code REAL_MAILS_AT + 1}. The
     * listing honours {@code limit} / {@code offset} as WebAdmin does, and the repository reports
     * that size. Injecting 450 real mails through SMTP would cost minutes; the browser cannot tell
     * the difference, and the actions on the real mails still reach WebAdmin.
     */
    private static Supplier<List<String>> padRepository(Page page, WebAdmin webAdmin, String repository) {
        String encoded = WebAdmin.encode(repository);
        int realCount = OpsBackend.mailKeys(webAdmin, repository).size();
        List<String> pads = IntStream.rangeClosed(1, TOTAL - realCount)
            .mapToObj(i -> String.format("qa-pad-%03d", i)).toList();
        Supplier<List<String>> listing = () -> {
            List<String> all = new ArrayList<>(pads);
            all.addAll(Math.min(REAL_MAILS_AT, pads.size()), OpsBackend.mailKeys(webAdmin, repository));
            return all;
        };
        WebAdminStub.answer(page, path -> path.equals("/mailRepositories/" + encoded),
            "{\"repository\":\"" + repository + "\",\"path\":\"" + encoded + "\",\"size\":" + TOTAL + "}");
        WebAdminStub.answerEach(page, path -> path.equals("/mailRepositories/" + encoded + "/mails"), uri -> {
            Map<String, String> query = new HashMap<>();
            for (String param : Optional.ofNullable(uri.getRawQuery()).orElse("").split("&")) {
                String[] pair = param.split("=", 2);
                query.put(pair[0], pair.length > 1 ? pair[1] : "");
            }
            List<String> all = listing.get();
            int offset = Math.min(all.size(), Integer.parseInt(query.getOrDefault("offset", "0")));
            int limit = Integer.parseInt(query.getOrDefault("limit", String.valueOf(all.size())));
            return WebAdmin.JSON.valueToTree(all.subList(offset, Math.min(all.size(), offset + limit))).toString();
        });
        // The extended view fetches the details of every displayed mail
        WebAdminStub.answerEach(page, path -> path.startsWith("/mailRepositories/" + encoded + "/mails/qa-pad-"), uri -> {
            String key = uri.getRawPath().substring(uri.getRawPath().lastIndexOf('/') + 1);
            return "{\"name\":\"" + key + "\",\"sender\":\"pad@example.com\",\"recipients\":[\"pad@example.com\"],"
                + "\"state\":\"error\",\"error\":\"\",\"remoteHost\":\"\",\"remoteAddr\":\"\",\"lastUpdated\":null}";
        });
        return listing;
    }

    /** Reads the rows of the displayed page: checks they are numbered from {@code first} on, returns their keys. */
    private static List<String> readPage(MailRepositoryDetailPage detail, int first) {
        List<String> keys = new ArrayList<>();
        List<String> texts = detail.rows().allInnerTexts();
        for (int i = 0; i < texts.size(); i++) {
            Matcher matcher = ROW.matcher(texts.get(i).trim());
            assertThat(matcher.matches()).as("row %s: %s", i, texts.get(i)).isTrue();
            assertThat(Integer.parseInt(matcher.group(1))).as("number of row %s", i).isEqualTo(first + i);
            keys.add(matcher.group(2));
        }
        return keys;
    }

    @Test
    @DisplayName("MR-04 Page through a repository of more than one page")
    void pageThroughARepository(AdminApp app, Page page, WebAdmin webAdmin) {
        String repository = OpsBackend.createRepository(webAdmin, "qa-paging");
        List<String> expected = padRepository(page, webAdmin, repository).get();

        MailRepositoriesPage repositories = MailRepositoriesPage.open(app);
        repositories.link(repository, TOTAL).click();
        MailRepositoryDetailPage detail = new MailRepositoryDetailPage(app);
        assertThat(page).hasURL(Pattern.compile("\\?page=1&size=" + TOTAL + "$"));
        List<String> seen = new ArrayList<>();

        assertThat(detail.pageLabel("Page 1 / 3")).isVisible();
        assertThat(detail.mailKey(expected.get(0))).isVisible();
        assertThat(detail.rows()).hasCount(PAGE_SIZE);
        assertThat(detail.pager("First")).isDisabled();
        assertThat(detail.pager("Previous")).isDisabled();
        assertThat(detail.pager("Next")).isEnabled();
        assertThat(detail.pager("Last")).isEnabled();
        seen.addAll(readPage(detail, 1));

        Request next = page.waitForRequest(request -> request.url().contains("/mails?"), () -> detail.pager("Next").click());
        assertThat(next.url()).contains("limit=" + PAGE_SIZE).contains("offset=" + PAGE_SIZE);
        assertThat(page).hasURL(Pattern.compile("[?&]page=2(&|$)"));
        assertThat(page).hasURL(Pattern.compile("[?&]size=" + TOTAL + "(&|$)"));
        assertThat(detail.pageLabel("Page 2 / 3")).isVisible();
        assertThat(detail.mailKey(expected.get(PAGE_SIZE))).isVisible();
        assertThat(detail.rows()).hasCount(PAGE_SIZE);
        assertThat(detail.pager("Previous")).isEnabled();
        assertThat(detail.pager("Next")).isEnabled();
        seen.addAll(readPage(detail, PAGE_SIZE + 1));

        Request last = page.waitForRequest(request -> request.url().contains("/mails?"), () -> detail.pager("Last").click());
        assertThat(last.url()).contains("limit=" + PAGE_SIZE).contains("offset=" + 2 * PAGE_SIZE);
        assertThat(detail.pageLabel("Page 3 / 3")).isVisible();
        assertThat(detail.mailKey(expected.get(2 * PAGE_SIZE))).isVisible();
        assertThat(detail.rows()).hasCount(TOTAL - 2 * PAGE_SIZE);
        assertThat(detail.pager("Next")).isDisabled();
        assertThat(detail.pager("Last")).isDisabled();
        seen.addAll(readPage(detail, 2 * PAGE_SIZE + 1));

        // Every mail of the repository seen once, in the listing order
        assertThat(seen).containsExactlyElementsOf(expected);

        page.reload();
        assertThat(detail.pageLabel("Page 3 / 3")).isVisible();
        assertThat(detail.mailKey(expected.get(2 * PAGE_SIZE))).isVisible();
        detail.pager("Previous").click();
        assertThat(detail.pageLabel("Page 2 / 3")).isVisible();
        assertThat(detail.mailKey(expected.get(PAGE_SIZE))).isVisible();
        detail.pager("First").click();
        assertThat(detail.pageLabel("Page 1 / 3")).isVisible();
        assertThat(detail.rows().first()).hasText(Pattern.compile("^1 /\\s*" + Regex.quote(expected.get(0))));
    }

    @Test
    @DisplayName("MR-04 Delete a mail of page 2 of a repository")
    void deleteOnSecondPage(AdminApp app, Page page, MailFixtures fixtures, WebAdmin webAdmin) {
        String repository = OpsBackend.createRepository(webAdmin, "qa-paging-act");
        OpsBackend.injectMails(fixtures, fixtures.newUser("sender"), OpsBackend.rrtErrorRecipient(fixtures), repository, 2);
        try {
            List<String> expected = padRepository(page, webAdmin, repository).get();
            String kept = expected.get(REAL_MAILS_AT);
            String deleted = expected.get(REAL_MAILS_AT + 1);

            MailRepositoriesPage repositories = MailRepositoriesPage.open(app);
            repositories.link(repository, TOTAL).click();
            MailRepositoryDetailPage detail = new MailRepositoryDetailPage(app);
            assertThat(detail.pageLabel("Page 1 / 3")).isVisible();
            detail.pager("Next").click();
            assertThat(detail.pageLabel("Page 2 / 3")).isVisible();
            assertThat(detail.row(deleted)).hasText(Pattern.compile("^" + (REAL_MAILS_AT + 2) + " /"));

            detail.simpleRowAction(deleted, MailRepositoryDetailPage.DELETE).click();
            assertThat(app.dialog().getByRole(AriaRole.HEADING)).hasText("Remove Email");
            Request delete = page.waitForRequest(request -> request.method().equals("DELETE"), app::confirm);
            assertThat(delete.url()).endsWith("/mailRepositories/" + WebAdmin.encode(repository) + "/mails/" + deleted);
            app.expectToast("Email removed successfully");

            // Still on page 2, refreshed without the deleted mail
            assertThat(page).hasURL(Pattern.compile("[?&]page=2(&|$)"));
            assertThat(detail.pageLabel("Page 2 / 3")).isVisible();
            assertThat(detail.mailKey(deleted)).hasCount(0);
            assertThat(detail.row(kept)).hasText(Pattern.compile("^" + (REAL_MAILS_AT + 1) + " /"));
            assertThat(detail.rows().first()).hasText(Pattern.compile("^" + (PAGE_SIZE + 1) + " /\\s*" + Regex.quote(expected.get(PAGE_SIZE))));
            assertThat(OpsBackend.mailKeys(webAdmin, repository)).containsExactly(kept);
            assertThat(webAdmin.get("/mailRepositories/" + WebAdmin.encode(repository) + "/mails/" + deleted).status()).isEqualTo(404);
        } finally {
            for (String key : OpsBackend.mailKeys(webAdmin, repository)) {
                webAdmin.delete("/mailRepositories/" + WebAdmin.encode(repository) + "/mails/" + key);
            }
        }
    }

    /** The Extended view pages by 50 mails (its own {@code VITE_PAGE_LIMIT || 50}), the simple view by 200. */
    private static final int EXTENDED_PAGE_SIZE = 50;

    @Test
    @DisplayName("MR-04 Extended view: page through a repository of more than one page")
    void pageThroughExtendedView(AdminApp app, Page page, WebAdmin webAdmin) {
        String repository = OpsBackend.createRepository(webAdmin, "qa-paging-ext");
        List<String> expected = padRepository(page, webAdmin, repository).get();
        int pages = TOTAL / EXTENDED_PAGE_SIZE;

        MailRepositoriesPage repositories = MailRepositoriesPage.open(app);
        repositories.link(repository, TOTAL).click();
        MailRepositoryDetailPage detail = new MailRepositoryDetailPage(app);
        assertThat(detail.pageLabel("Page 1 / 3")).isVisible();
        assertThat(detail.extendedViewLink()).hasAttribute("href", Pattern.compile("/extended\\?(.*&)?page=1(&|$)"));
        assertThat(detail.extendedViewLink()).hasAttribute("href", Pattern.compile("/extended\\?(.*&)?size=" + TOTAL + "(&|$)"));

        detail.extendedViewLink().click();
        assertThat(detail.extendedTitle()).isVisible();
        assertThat(detail.pageLabel("Page 1 / " + pages + " — Total: " + TOTAL)).isVisible();
        assertThat(detail.extendedDeleteButtons()).hasCount(EXTENDED_PAGE_SIZE);
        assertThat(detail.mailButton(expected.get(0))).isVisible();
        assertThat(detail.pager("First")).isDisabled();
        assertThat(detail.pager("Previous")).isDisabled();

        Request next = page.waitForRequest(request -> request.url().contains("/mails?"), () -> detail.pager("Next").click());
        assertThat(next.url()).contains("limit=" + EXTENDED_PAGE_SIZE).contains("offset=" + EXTENDED_PAGE_SIZE);
        assertThat(page).hasURL(Pattern.compile("[?&]page=2(&|$)"));
        assertThat(detail.pageLabel("Page 2 / " + pages + " — Total: " + TOTAL)).isVisible();
        assertThat(detail.mailButton(expected.get(EXTENDED_PAGE_SIZE))).isVisible();
        assertThat(detail.mailButton(expected.get(2 * EXTENDED_PAGE_SIZE - 1))).isVisible();
        assertThat(detail.mailButton(expected.get(EXTENDED_PAGE_SIZE - 1))).hasCount(0);
        assertThat(detail.extendedDeleteButtons()).hasCount(EXTENDED_PAGE_SIZE);
        assertThat(app.main().getByText((EXTENDED_PAGE_SIZE + 1) + ".", new Locator.GetByTextOptions().setExact(true))).isVisible();

        Request last = page.waitForRequest(request -> request.url().contains("/mails?"), () -> detail.pager("Last").click());
        assertThat(last.url()).contains("limit=" + EXTENDED_PAGE_SIZE).contains("offset=" + (pages - 1) * EXTENDED_PAGE_SIZE);
        assertThat(detail.pageLabel("Page " + pages + " / " + pages + " — Total: " + TOTAL)).isVisible();
        assertThat(detail.extendedDeleteButtons()).hasCount(TOTAL - (pages - 1) * EXTENDED_PAGE_SIZE);
        assertThat(detail.mailButton(expected.get(TOTAL - 1))).isVisible();
        assertThat(detail.pager("Next")).isDisabled();
        assertThat(detail.pager("Last")).isDisabled();

        page.reload();
        assertThat(detail.pageLabel("Page " + pages + " / " + pages + " — Total: " + TOTAL)).isVisible();
        detail.pager("First").click();
        assertThat(detail.pageLabel("Page 1 / " + pages + " — Total: " + TOTAL)).isVisible();
        assertThat(detail.mailButton(expected.get(0))).isVisible();
        assertThat(page).hasURL(Pattern.compile("[?&]size=" + TOTAL + "(&|$)"));
    }

    // The two views page by different sizes (200 and 50 mails): the link must keep the mails in sight
    @Test
    @DisplayName("MR-04 Extended view opened from page 2 shows the mails of page 2")
    void extendedViewFromSecondPage(AdminApp app, Page page, WebAdmin webAdmin) {
        String repository = OpsBackend.createRepository(webAdmin, "qa-paging-ext2");
        List<String> expected = padRepository(page, webAdmin, repository).get();

        MailRepositoriesPage repositories = MailRepositoriesPage.open(app);
        repositories.link(repository, TOTAL).click();
        MailRepositoryDetailPage detail = new MailRepositoryDetailPage(app);
        detail.pager("Next").click();
        assertThat(detail.pageLabel("Page 2 / 3")).isVisible();
        assertThat(detail.mailKey(expected.get(PAGE_SIZE))).isVisible();

        detail.extendedViewLink().click();
        assertThat(detail.extendedTitle()).isVisible();
        assertThat(detail.mailButton(expected.get(PAGE_SIZE))).isVisible();
        assertThat(app.main().getByText((PAGE_SIZE + 1) + ".", new Locator.GetByTextOptions().setExact(true))).isVisible();
        assertThat(detail.mailButton(expected.get(EXTENDED_PAGE_SIZE))).hasCount(0);
    }
}
