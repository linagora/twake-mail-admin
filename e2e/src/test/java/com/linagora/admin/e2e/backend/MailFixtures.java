package com.linagora.admin.e2e.backend;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

import org.awaitility.Awaitility;

import com.linagora.admin.e2e.docker.MailStack;

/**
 * Seeds the data of one test on the Mail stack.
 *
 * <p><b>Isolation.</b> The stack is shared by every test, possibly four at a time, so the
 * <em>domain</em> is the unit of isolation: {@link #domain()} is a brand new domain of the running
 * test, created on first use, and the users of the test live in it. Nothing a test creates
 * collides with another test, and no test has to clean up after itself.
 *
 * <p>State global to the server (global quota, the task list, dead letters, mail repositories,
 * health) cannot be isolated that way: classes driving it take a {@code @ResourceLock}, see
 * {@code Locks}, and assert on what they themselves created rather than on absolute counts.
 */
public class MailFixtures {
    public static final String PASSWORD = "secret";

    private final MailStack stack;
    private final WebAdmin webAdmin;
    private String domain;

    public MailFixtures(MailStack stack, WebAdmin webAdmin) {
        this.stack = stack;
        this.webAdmin = webAdmin;
    }

    public WebAdmin webAdmin() {
        return webAdmin;
    }

    /** The domain of the running test, created on first use. */
    public synchronized String domain() {
        if (domain == null) {
            domain = newDomain();
        }
        return domain;
    }

    /** One more domain, besides {@link #domain()}: {@code d-k3x9q2.e2e.test}. */
    public String newDomain() {
        return newDomain("d");
    }

    public String newDomain(String prefix) {
        String name = Ids.unique(prefix) + ".e2e.test";
        webAdmin.put("/domains/" + name).expect(204);
        return name;
    }

    /** A new user of {@link #domain()}, password {@link #PASSWORD}: {@code alice-k3x9q2@d-....e2e.test}. */
    public String newUser(String localPartPrefix) {
        return newUser(localPartPrefix, domain());
    }

    public String newUser() {
        return newUser("user");
    }

    public String newUser(String localPartPrefix, String domain) {
        String address = Ids.unique(localPartPrefix) + "@" + domain;
        webAdmin.put("/users/" + address, "{\"password\":\"" + PASSWORD + "\"}").expect(204);
        return address;
    }

    /** Delivers a plain text mail through the SMTP server of tmail-backend. */
    public void sendMail(String from, String to, String subject, String body) {
        String message = "From: " + from + "\r\n"
            + "To: " + to + "\r\n"
            + "Subject: " + subject + "\r\n"
            + "Date: " + DateTimeFormatter.RFC_1123_DATE_TIME.format(ZonedDateTime.now()) + "\r\n"
            + "Message-ID: <" + UUID.randomUUID() + "@e2e.test>\r\n"
            + "Content-Type: text/plain; charset=utf-8\r\n"
            + "\r\n"
            + body + "\r\n";
        sendRaw(from, to, message);
    }

    /** Hands a raw RFC 5322 message over to the SMTP server of tmail-backend. */
    public void sendRaw(String from, String to, String message) {
        try (Socket socket = new Socket("127.0.0.1", stack.smtpPort())) {
            socket.setSoTimeout(30_000);
            BufferedReader in = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
            OutputStream out = socket.getOutputStream();
            expect(in, "220");
            command(out, in, "EHLO e2e.test", "250");
            command(out, in, "MAIL FROM:<" + from + ">", "250");
            command(out, in, "RCPT TO:<" + to + ">", "250");
            command(out, in, "DATA", "354");
            String dotStuffed = message.replace("\r\n.", "\r\n..");
            out.write((dotStuffed + (dotStuffed.endsWith("\r\n") ? "" : "\r\n") + ".\r\n").getBytes(StandardCharsets.UTF_8));
            out.flush();
            expect(in, "250");
            command(out, in, "QUIT", "221");
        } catch (IOException e) {
            throw new IllegalStateException("SMTP delivery to " + to + " failed", e);
        }
    }

    private static void command(OutputStream out, BufferedReader in, String line, String expected) throws IOException {
        out.write((line + "\r\n").getBytes(StandardCharsets.UTF_8));
        out.flush();
        expect(in, expected);
    }

    /** Reads a (possibly multi line) SMTP reply and checks its code. */
    private static void expect(BufferedReader in, String code) throws IOException {
        String line;
        do {
            line = in.readLine();
            if (line == null) {
                throw new IOException("SMTP connection closed, expected " + code);
            }
        } while (line.length() > 3 && line.charAt(3) == '-');
        if (!line.startsWith(code)) {
            throw new IOException("SMTP answered '" + line + "', expected " + code);
        }
    }

    /** Number of messages in a mailbox of a user, read through WebAdmin. */
    public long messageCount(String user, String mailbox) {
        return webAdmin.get("/users/" + user + "/mailboxes/" + WebAdmin.encode(mailbox) + "/messageCount")
            .expect(200).json().asLong();
    }

    /**
     * Waits until a mailbox of a user holds {@code count} messages. Delivery is asynchronous and
     * creates the mailbox it delivers to: until then WebAdmin answers 404, waited out like a lower count.
     */
    public void awaitMessageCount(String user, String mailbox, long count) {
        Awaitility.await().atMost(Duration.ofSeconds(30)).pollInterval(Duration.ofMillis(200))
            .ignoreExceptions()
            .until(() -> messageCount(user, mailbox) == count);
    }
}
