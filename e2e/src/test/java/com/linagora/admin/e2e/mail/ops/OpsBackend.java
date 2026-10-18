package com.linagora.admin.e2e.mail.ops;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.function.Predicate;

import org.awaitility.Awaitility;

import com.fasterxml.jackson.databind.JsonNode;
import com.linagora.admin.e2e.backend.Ids;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;

/**
 * WebAdmin side helpers of the server wide screens (mail repositories, dead letters, tasks):
 * they produce data that only the running test owns, and read it back.
 */
final class OpsBackend {
    static final String RRT_ERROR = "var/mail/rrt-error";
    /** The listener failing on a quota ratio of 0 / 0 (domain size quota 0, empty mailbox). */
    static final String QUOTA_GROUP = "org.apache.james.quota.search.opensearch.events.OpenSearchQuotaMailboxListener$OpenSearchQuotaMailboxListenerGroup";
    /** The listener failing on the content deletion of a cleared mailbox. */
    static final String VAULT_GROUP = "org.apache.james.vault.DeletedMessageVaultDeletionListener$DeletedMessageVaultListenerGroup";

    private static final Set<String> RUNNING = Set.of("waiting", "inProgress");

    private OpsBackend() {
    }

    // ---- Mail repositories --------------------------------------------------------------

    /** Creates a repository {@code var/mail/<prefix>-xxxxxx} (cassandra), returns its path. */
    static String createRepository(WebAdmin webAdmin, String prefix) {
        String path = "var/mail/" + Ids.unique(prefix);
        webAdmin.put("/mailRepositories/" + WebAdmin.encode(path) + "?protocol=cassandra").expect(204);
        return path;
    }

    static List<String> mailKeys(WebAdmin webAdmin, String repository) {
        return mailKeys(webAdmin, repository, "");
    }

    /** Mail keys of a repository, {@code query} being WebAdmin filters ({@code "sender=a@b.c"}). */
    static List<String> mailKeys(WebAdmin webAdmin, String repository, String query) {
        JsonNode keys = webAdmin.get("/mailRepositories/" + WebAdmin.encode(repository) + "/mails?limit=500"
            + (query.isEmpty() ? "" : "&" + query)).expect(200).json();
        List<String> result = new ArrayList<>();
        keys.forEach(key -> result.add(key.asText()));
        return result;
    }

    static long size(WebAdmin webAdmin, String repository) {
        return webAdmin.get("/mailRepositories/" + WebAdmin.encode(repository)).expect(200).json().path("size").asLong();
    }

    /**
     * A recipient whose mails end up in {@code var/mail/rrt-error}: SMTP accepts it (it has a
     * mapping) but its chain of 12 address mappings exceeds the recursion limit of the
     * recipient rewrite table. (A mail to an unknown user is refused at RCPT time, and the
     * address-error processor bounces without storing.)
     */
    static String rrtErrorRecipient(MailFixtures fixtures) {
        String base = Ids.unique("chain");
        String domain = fixtures.domain();
        for (int i = 1; i <= 12; i++) {
            fixtures.webAdmin().post("/mappings/address/" + WebAdmin.encode(base + i + "@" + domain)
                + "/targets/" + WebAdmin.encode(base + (i + 1) + "@" + domain), null).expect(204);
        }
        return base + "1@" + domain;
    }

    /**
     * Sends {@code count} mails from {@code sender} to an rrt-error recipient and moves them, once
     * stored in var/mail/rrt-error, into {@code repository}. Returns their keys.
     */
    static List<String> injectMails(MailFixtures fixtures, String sender, String recipient, String repository, int count) {
        WebAdmin webAdmin = fixtures.webAdmin();
        for (int i = 0; i < count; i++) {
            fixtures.sendMail(sender, recipient, "ops " + i, "Mail " + i + " of " + sender);
        }
        List<String> keys = awaitKeys(webAdmin, RRT_ERROR, "sender=" + sender, list -> list.size() >= count);
        for (String key : keys) {
            webAdmin.patch("/mailRepositories/" + WebAdmin.encode(RRT_ERROR) + "/mails/" + key,
                "{\"mailRepository\":\"" + repository + "\"}").expect(204);
        }
        return keys;
    }

    static List<String> awaitKeys(WebAdmin webAdmin, String repository, String query, Predicate<List<String>> condition) {
        List<List<String>> last = new ArrayList<>(List.of(List.of()));
        Awaitility.await().atMost(Duration.ofSeconds(60)).pollInterval(Duration.ofMillis(300))
            .until(() -> {
                last.set(0, mailKeys(webAdmin, repository, query));
                return condition.test(last.get(0));
            });
        return last.get(0);
    }

    // ---- Event dead letters -------------------------------------------------------------

    /** Insertion ids of the dead lettered events of {@code group} mentioning {@code marker}. */
    static List<String> deadLetters(WebAdmin webAdmin, String group, String marker) {
        return deadLetters(webAdmin, group, marker, new java.util.HashMap<>());
    }

    /** Same, {@code known} remembering whether an insertion id matched: an event never changes. */
    private static List<String> deadLetters(WebAdmin webAdmin, String group, String marker, java.util.Map<String, Boolean> known) {
        WebAdmin.Response response = webAdmin.get("/events/deadLetter/groups/" + WebAdmin.encode(group));
        List<String> result = new ArrayList<>();
        if (response.status() != 200) {
            return result;
        }
        for (JsonNode node : response.json()) {
            String id = node.asText();
            boolean matches = known.computeIfAbsent(id, key -> {
                WebAdmin.Response event = webAdmin.get("/events/deadLetter/groups/" + WebAdmin.encode(group) + "/" + key);
                return event.status() == 200 && event.body().contains(marker);
            });
            if (matches) {
                result.add(id);
            }
        }
        return result;
    }

    static int deadLetterCount(WebAdmin webAdmin, String group) {
        WebAdmin.Response response = webAdmin.get("/events/deadLetter/groups/" + WebAdmin.encode(group));
        return response.status() == 200 ? response.json().size() : 0;
    }

    static JsonNode deadLetter(WebAdmin webAdmin, String group, String insertionId) {
        return webAdmin.get("/events/deadLetter/groups/" + WebAdmin.encode(group) + "/" + insertionId).expect(200).json();
    }

    /** The event id of a dead letter: the {@code eventId} of its single top level event object. */
    static String eventId(WebAdmin webAdmin, String group, String insertionId) {
        JsonNode event = deadLetter(webAdmin, group, insertionId);
        return event.elements().next().path("eventId").asText();
    }

    static List<String> awaitDeadLetters(WebAdmin webAdmin, String group, String marker, int atLeast) {
        List<List<String>> last = new ArrayList<>(List.of(List.of()));
        java.util.Map<String, Boolean> known = new java.util.HashMap<>();
        // The listener retries 8 times with an exponential back off before dead lettering: from 25 s
        // on an idle stack to several minutes on a busy one
        Awaitility.await().atMost(Duration.ofSeconds(480)).pollInterval(Duration.ofSeconds(2))
            .until(() -> {
                last.set(0, deadLetters(webAdmin, group, marker, known));
                return last.get(0).size() >= atLeast;
            });
        return last.get(0);
    }

    // ---- Tasks ------------------------------------------------------------------------

    static String startTask(WebAdmin webAdmin, String method, String path) {
        WebAdmin.Response response = webAdmin.send(method, path, null).expect(201);
        return response.json().path("taskId").asText();
    }

    static JsonNode task(WebAdmin webAdmin, String taskId) {
        return webAdmin.get("/tasks/" + taskId).expect(200).json();
    }

    /** Cancels a task if it is still waiting or running, then waits for it to settle. */
    static JsonNode cancelIfRunning(WebAdmin webAdmin, String taskId) {
        if (RUNNING.contains(task(webAdmin, taskId).path("status").asText())) {
            webAdmin.delete("/tasks/" + taskId);
        }
        JsonNode[] last = new JsonNode[1];
        Awaitility.await().atMost(Duration.ofSeconds(60)).pollInterval(Duration.ofMillis(300))
            .until(() -> {
                last[0] = task(webAdmin, taskId);
                String status = last[0].path("status").asText();
                return !RUNNING.contains(status) && !status.equals("canceledRequested");
            });
        return last[0];
    }

    /** Extracts the task id of a {@code /task/<id>} link. */
    static String taskIdOf(String href) {
        return href.substring(href.lastIndexOf('/') + 1);
    }
}
