package com.linagora.admin.e2e.mail.ops;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.regex.Pattern;

import org.awaitility.Awaitility;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.parallel.ResourceLock;

import com.fasterxml.jackson.databind.JsonNode;
import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.docker.Locks;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.ops.EventDeadLetterPage;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Request;
import com.microsoft.playwright.options.AriaRole;

/**
 * Dead letters are server wide. The class produces its own, once, when its first test starts:
 * the users of a domain receive mails, the domain gets a size quota of 0, and their INBOX is
 * cleared. The quota usage updates carry a 0 limit, and the quota search listener fails on the
 * resulting NaN ratio. The events of the class are recognised by the domain they mention.
 *
 * <p>Such an event carries its 0 limit: redelivered, it fails again and comes back into the dead
 * letters (under a new insertion id) after the retries of the listener, a while later. EDL-01 and
 * EDL-02 share the events of the class (EDL-02 clears the group last), EDL-03, which redelivers,
 * produces its own afterwards. (Clearing a mailbox, whose vault events sometimes fail, is not
 * deterministic enough; a mail to a user over quota is refused without any quota event.)
 */
@ResourceLock(Locks.MAIL_DEAD_LETTERS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class EventDeadLetterTest extends MailAdminE2ETest {
    private static final String GROUP = OpsBackend.QUOTA_GROUP;

    private static String classMarker;
    /** Events seeded by EDL-02 for EDL-03, still retried by the listener when EDL-02 clears the group. */
    private static String nextMarker;

    /** The marker of the events shared by EDL-01 and EDL-02: {@code "@<domain>"}. */
    private static synchronized String seed(MailFixtures fixtures) {
        if (classMarker == null) {
            // The events of the previous runs of this class come back each time someone redelivers
            // the group: drop them, so that they do not pile up
            for (String id : OpsBackend.deadLetters(fixtures.webAdmin(), GROUP, "@edl-")) {
                fixtures.webAdmin().delete("/events/deadLetter/groups/" + WebAdmin.encode(GROUP) + "/" + id);
            }
            classMarker = newSeed(fixtures);
        }
        return classMarker;
    }

    /** Dead letters some events mentioning a new domain, returns {@code "@<domain>"}. */
    private static String newSeed(MailFixtures fixtures) {
        WebAdmin webAdmin = fixtures.webAdmin();
        String domain = fixtures.newDomain("edl");
        List<String> users = List.of(fixtures.newUser("quota", domain), fixtures.newUser("quota", domain));
        for (String user : users) {
            fixtures.sendMail(user, user, "seed 1", "Dead letter seed");
            fixtures.sendMail(user, user, "seed 2", "Dead letter seed");
        }
        for (String user : users) {
            Awaitility.await().atMost(Duration.ofSeconds(30)).until(() -> fixtures.messageCount(user, "INBOX") == 2);
        }
        webAdmin.put("/quota/domains/" + domain + "/size", "0").expect(204);
        try {
            for (String user : users) {
                String taskId = webAdmin.delete("/users/" + user + "/mailboxes/INBOX/messages").expect(201).json().path("taskId").asText();
                webAdmin.awaitTask(taskId);
            }
        } finally {
            // The events keep the limit they were emitted with: the domain needs no 0 quota any more
            webAdmin.delete("/quota/domains/" + domain + "/size");
        }
        return "@" + domain;
    }

    @Test
    @Order(1)
    @DisplayName("EDL-01 Event dead letter groups and search by event ID")
    void groupsAndSearchByEventId(AdminApp app, Page page, MailFixtures fixtures, WebAdmin webAdmin) {
        String marker = seed(fixtures);
        app.open("/");
        app.navigate("Event Dead Letter");
        EventDeadLetterPage deadLetters = new EventDeadLetterPage(app);

        assertThat(app.main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setName("Search by event ID"))).isVisible();
        assertThat(app.main().getByText("Narrows the search to a single listener group, which is significantly faster when the group is known.")).isVisible();
        assertThat(deadLetters.searchButton()).isDisabled();

        deadLetters.eventIdField().fill(UUID.randomUUID().toString());
        assertThat(deadLetters.searchButton()).isEnabled();
        deadLetters.searchButton().click();
        assertThat(app.main().getByRole(AriaRole.STATUS)).hasText("No dead-lettered event found with this ID.");
        deadLetters.groupField().fill(GROUP);
        deadLetters.searchButton().click();
        assertThat(app.main().getByRole(AriaRole.STATUS)).hasText("No dead-lettered event found with this ID.");

        deadLetters.groupField().fill("");
        deadLetters.eventIdField().fill("abc");
        deadLetters.searchButton().click();
        assertThat(app.toast("Error searching for event")).containsText("Can not deserialize the supplied eventId: abc");

        // A real event, found across the groups then within its group
        String insertionId = OpsBackend.awaitDeadLetters(webAdmin, GROUP, marker, 1).get(0);
        String eventId = OpsBackend.eventId(webAdmin, GROUP, insertionId);
        deadLetters.eventIdField().fill(eventId);
        deadLetters.searchButton().click();
        Locator result = app.main().locator("section");
        assertThat(result.locator("pre")).containsText("\"eventId\": \"" + eventId + "\"");
        assertThat(result.locator("pre")).containsText(marker);
        // Group and insertion id come from the X-Group / X-Insertion-Id headers, which WebAdmin does not
        // expose to a cross origin page (no Access-Control-Expose-Headers): "N/A" here, see the report
        assertThat(result).containsText("Insertion ID:");
        deadLetters.groupField().fill(GROUP);
        deadLetters.searchButton().click();
        assertThat(result.locator("pre")).containsText("\"eventId\": \"" + eventId + "\"");

        // The groups, with their counts and actions
        page.reload();
        assertThat(deadLetters.groupLink(GROUP)).hasText(Pattern.compile("\\(\\d+\\)$"));
        assertThat(deadLetters.groupAction(GROUP, EventDeadLetterPage.REDELIVER)).isVisible();
        assertThat(deadLetters.groupAction(GROUP, EventDeadLetterPage.CLEAR)).isVisible();
    }

    @Test
    @Order(2)
    @DisplayName("EDL-02 Group detail, redeliver and delete")
    void groupDetailRedeliverAndDelete(AdminApp app, Page page, MailFixtures fixtures, WebAdmin webAdmin) {
        String marker = seed(fixtures);
        // The listener retries for a while (minutes on a busy stack) before dead lettering: the events
        // of EDL-03 are emitted now, so that they are still in flight when this test clears the group
        nextMarker = newSeed(fixtures);
        String group = GROUP;
        List<String> mine = OpsBackend.awaitDeadLetters(webAdmin, group, marker, 1);
        String deleted = mine.get(0);

        EventDeadLetterPage deadLetters = EventDeadLetterPage.open(app);
        assertThat(deadLetters.groupLink(group)).hasAttribute("href", "/event-dead-letter/group/" + group + "?page=1");
        assertThat(deadLetters.groupAction(group, EventDeadLetterPage.REDELIVER)).hasAttribute("title", "Redeliver group events");
        assertThat(deadLetters.groupAction(group, EventDeadLetterPage.CLEAR)).hasAttribute("title", "Clear group");
        deadLetters.groupLink(group).click();

        assertThat(deadLetters.groupTitle()).isVisible();
        assertThat(app.main()).containsText("Group: " + group);
        // The total is the real number of events of the group (which may still move)
        Awaitility.await().atMost(Duration.ofSeconds(20)).untilAsserted(() -> {
            page.reload();
            assertThat(deadLetters.paginationLabel()).isVisible();
            int total = OpsBackend.deadLetterCount(webAdmin, group);
            assertThat(deadLetters.paginationLabel().textContent())
                .isEqualTo("Page 1 — 200 events per page / Total: " + total);
        });
        assertThat(app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Next"))).isDisabled();
        assertThat(app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Last"))).isDisabled();
        assertThat(app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Back").setExact(true))).hasAttribute("title", "Back");
        assertThat(deadLetters.deleteEvent(deleted)).hasAttribute("title", "Delete event");

        deadLetters.deleteEvent(deleted).click();
        assertThat(app.dialog().getByRole(AriaRole.HEADING)).hasText("Delete Event");
        assertThat(app.dialog()).containsText("Delete event " + deleted + " in group " + group + "?");
        assertThat(app.dialog().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Confirm").setExact(true))).isInViewport();
        assertThat(app.dialog().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Cancel").setExact(true))).isInViewport();
        app.confirm();
        app.expectToast("Event deleted successfully");
        assertThat(deadLetters.event(deleted)).hasCount(0);
        assertThat(webAdmin.get("/events/deadLetter/groups/" + WebAdmin.encode(group) + "/" + deleted).status()).isEqualTo(404);

        app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Back").setExact(true)).click();
        deadLetters.groupAction(group, EventDeadLetterPage.REDELIVER).click();
        app.confirm();
        Locator toast = app.toast("Task created");
        String taskId = OpsBackend.taskIdOf(toast.getByRole(AriaRole.LINK).getAttribute("href"));
        assertThat(webAdmin.awaitTask(taskId).path("status").asText()).isEqualTo("completed");

        if (!OpsBackend.deadLetters(webAdmin, group, nextMarker).isEmpty()) {
            nextMarker = null; // already dead lettered: the clear below wipes them
        }
        deadLetters.groupAction(group, EventDeadLetterPage.CLEAR).click();
        assertThat(app.dialog().getByRole(AriaRole.HEADING)).hasText("Clear Event Group");
        assertThat(app.dialog()).containsText("Do you want to clear the event group: " + group + ".");
        app.confirm();
        app.expectToast("The events were deleted.");
        assertThat(deadLetters.groupLink(group, 0)).isVisible();
        assertThat(OpsBackend.deadLetters(webAdmin, group, marker)).isEmpty();
    }

    @Test
    @Order(3)
    @DisplayName("EDL-03 Redeliver group dialog: parameters, validation and preview")
    void redeliverDialog(AdminApp app, Page page, MailFixtures fixtures, WebAdmin webAdmin) {
        String marker = nextMarker != null ? nextMarker : newSeed(fixtures);
        String group = GROUP;
        OpsBackend.awaitDeadLetters(webAdmin, group, marker, 2);
        List<String> posts = new CopyOnWriteArrayList<>();
        page.onRequest(request -> {
            if (request.method().equals("POST") && request.url().contains("/events/deadLetter/groups/")) {
                posts.add(request.url());
            }
        });

        EventDeadLetterPage deadLetters = EventDeadLetterPage.open(app);
        deadLetters.groupAction(group, EventDeadLetterPage.REDELIVER).click();
        assertThat(app.dialog().getByRole(AriaRole.HEADING)).hasText("Redeliver group events");
        assertThat(app.dialog()).containsText("Do you want to re-deliver events for the group: " + group + ".");
        assertThat(deadLetters.param("limit")).hasValue("");
        assertThat(deadLetters.param("maxRetries")).hasValue("");
        String command = "Command: curl -XPOST /events/deadLetter/groups/" + WebAdmin.encode(group) + "?action=reDeliver";
        assertThat(deadLetters.commandPreview()).hasText(command);

        for (String value : List.of("abc", "-3", "0")) {
            deadLetters.param("limit").fill(value);
            app.clickConfirm();
            assertThat(app.dialogError()).hasText("limit must be a positive integer, or left empty.");
            assertThat(app.dialog()).isVisible();
        }
        deadLetters.param("limit").fill("");
        deadLetters.param("maxRetries").fill("1.5");
        app.clickConfirm();
        assertThat(app.dialogError()).hasText("maxRetries must be a positive integer, or left empty.");
        assertThat(deadLetters.param("maxRetries")).hasValue("1.5");
        assertThat(posts).isEmpty();

        deadLetters.param("maxRetries").fill("");
        deadLetters.param("limit").fill("1");
        assertThat(deadLetters.commandPreview()).hasText(command + "&limit=1");
        Request redeliver = page.waitForRequest(
            request -> request.method().equals("POST") && request.url().contains("/events/deadLetter/groups/"),
            app::confirm);
        assertThat(redeliver.url()).contains("limit=1").doesNotContain("maxRetries").doesNotContain("NaN");
        Locator toast = app.toast("Task created");
        String taskId = OpsBackend.taskIdOf(toast.getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName(Pattern.compile("^Task "))).getAttribute("href"));
        JsonNode task = webAdmin.awaitTask(taskId);
        assertThat(task.path("status").asText()).as(task.toString()).isEqualTo("completed");
        assertThat(task.path("additionalInformation").path("successfulRedeliveriesCount").asInt()).as(task.toString()).isEqualTo(1);


        // The rest, with both fields empty
        deadLetters.groupLink(group).click();
        assertThat(deadLetters.groupTitle()).isVisible();
        app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Back").setExact(true)).click();
        deadLetters.groupAction(group, EventDeadLetterPage.REDELIVER).click();
        Request rest = page.waitForRequest(
            request -> request.method().equals("POST") && request.url().contains("/events/deadLetter/groups/"),
            app::confirm);
        assertThat(rest.url()).endsWith("?action=reDeliver");
        String restTask = OpsBackend.taskIdOf(app.toast("Task created").getByRole(AriaRole.LINK).getAttribute("href"));
        JsonNode restInfo = webAdmin.awaitTask(restTask);
        assertThat(restInfo.path("status").asText()).as(restInfo.toString()).isEqualTo("completed");
        assertThat(restInfo.path("additionalInformation").path("successfulRedeliveriesCount").asInt()).as(restInfo.toString())
            .isGreaterThanOrEqualTo(1);
    }
}
