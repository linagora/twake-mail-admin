package com.linagora.admin.e2e.mail.shell;

import java.time.Duration;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.awaitility.Awaitility;

import com.fasterxml.jackson.databind.JsonNode;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.docker.MailStack;

/** Users holding mails, for the shell cases (resource locator, language formats...). */
final class MailSeeds {
    private static final Pattern EMAIL_ID = Pattern.compile("EMAILID \\(([^)]+)\\)");

    record UserWithMail(String user, String inboxId) {
    }

    private MailSeeds() {
    }

    /** A new user of the test domain with one delivered mail in INBOX. */
    static UserWithMail userWithMail(MailFixtures fixtures, String prefix) {
        String user = fixtures.newUser(prefix);
        fixtures.sendMail(user, user, "shell " + prefix, "A mail for the shell tests");
        Awaitility.await().atMost(Duration.ofSeconds(30)).pollInterval(Duration.ofMillis(300))
            .ignoreExceptions()
            .until(() -> fixtures.messageCount(user, "INBOX") == 1);
        return new UserWithMail(user, inboxId(fixtures.webAdmin(), user));
    }

    static String inboxId(WebAdmin webAdmin, String user) {
        for (JsonNode mailbox : webAdmin.get("/users/" + user + "/mailboxes").expect(200).json()) {
            if (mailbox.path("mailboxName").asText().equals("INBOX")) {
                return mailbox.path("mailboxId").asText();
            }
        }
        throw new IllegalStateException("No INBOX for " + user);
    }

    /**
     * The JMAP id of the first message of the INBOX of {@code user}: WebAdmin does not list message
     * ids, IMAP does (RFC 8474 EMAILID). IMAP is not published on the host: curl runs it in the container.
     */
    static String firstMessageId(MailStack stack, String user) {
        String output = stack.exec(MailStack.BACKEND, "curl", "-s", "-v", "-k", "--ssl-reqd",
            "imap://localhost:143/INBOX", "-u", user + ":" + MailFixtures.PASSWORD, "-X", "FETCH 1 (EMAILID)");
        Matcher matcher = EMAIL_ID.matcher(output);
        if (!matcher.find()) {
            throw new IllegalStateException("No EMAILID in the IMAP answer: " + output);
        }
        return matcher.group(1);
    }
}
