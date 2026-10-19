package com.linagora.admin.e2e.backend;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import com.linagora.admin.e2e.docker.MailStack;

/**
 * A live, authenticated IMAP session of a user on tmail-backend: a real network channel, listed by
 * {@code GET /servers/channels} until the server closes it.
 *
 * <p>The IMAP ports are not published on the host. The client is {@code openssl s_client} run
 * inside the tmail-backend container, over IMAPS (993: plain login is disallowed on 143 without
 * STARTTLS); this class drives its standard input and output. The channel's remote address is
 * then the loopback of the container.
 */
public class ImapSession implements AutoCloseable {
    private static final String EOF = "\u0000EOF";
    private static final Duration ANSWER_TIMEOUT = Duration.ofSeconds(30);

    private final Process process;
    private final OutputStream out;
    private final BlockingQueue<String> lines = new LinkedBlockingQueue<>();

    private ImapSession(Process process) {
        this.process = process;
        this.out = process.getOutputStream();
        Thread reader = new Thread(() -> {
            try (BufferedReader in = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = in.readLine()) != null) {
                    lines.add(line);
                }
            } catch (IOException e) {
                // the stream is gone: same as the end of it
            } finally {
                lines.add(EOF);
            }
        }, "imap-session-reader");
        reader.setDaemon(true);
        reader.start();
    }

    /** Opens a session, logs {@code user} in and announces {@code clientName} with the IMAP {@code ID} command. */
    public static ImapSession login(MailStack stack, String user, String password, String clientName) {
        ImapSession session = new ImapSession(stack.spawn(MailStack.BACKEND,
            "openssl", "s_client", "-quiet", "-connect", "localhost:993"));
        try {
            session.expect("* OK");
            session.command("a1 LOGIN " + user + " " + password, "a1 OK");
            session.command("a2 ID (\"name\" \"" + clientName + "\")", "a2 OK");
            return session;
        } catch (RuntimeException e) {
            session.close();
            throw e;
        }
    }

    private void command(String line, String expectedTaggedAnswer) {
        try {
            out.write((line + "\r\n").getBytes(StandardCharsets.UTF_8));
            out.flush();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        expect(expectedTaggedAnswer);
    }

    /** Skips lines until one starts with {@code prefix}. */
    private void expect(String prefix) {
        String tag = prefix.substring(0, prefix.indexOf(' ') + 1);
        while (true) {
            String line = next(ANSWER_TIMEOUT);
            if (line == null || line.equals(EOF)) {
                throw new IllegalStateException("IMAP session closed, expected '" + prefix + "'");
            }
            if (line.startsWith(prefix)) {
                return;
            }
            if (!tag.equals("* ") && line.startsWith(tag)) {
                throw new IllegalStateException("IMAP answered '" + line + "', expected '" + prefix + "'");
            }
        }
    }

    private String next(Duration timeout) {
        try {
            return lines.poll(timeout.toMillis(), TimeUnit.MILLISECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }

    /**
     * Whether the server closed the connection within {@code timeout} (an optional {@code * BYE}
     * then the end of the stream), seen from the client side.
     */
    public boolean closedByServer(Duration timeout) {
        long deadline = System.nanoTime() + timeout.toNanos();
        while (true) {
            long left = deadline - System.nanoTime();
            if (left <= 0) {
                return false;
            }
            String line = next(Duration.ofNanos(left));
            if (line == null) {
                return false;
            }
            if (line.equals(EOF)) {
                return true;
            }
        }
    }

    @Override
    public void close() {
        // Killing the docker CLI may leave openssl running in the container: log out first
        try {
            out.write("a9 LOGOUT\r\n".getBytes(StandardCharsets.UTF_8));
            out.flush();
            process.waitFor(5, TimeUnit.SECONDS);
        } catch (IOException e) {
            // already closed
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        process.destroy();
    }
}
