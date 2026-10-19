package com.linagora.admin.e2e.docker;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * A docker compose project, driven through the {@code docker compose} CLI.
 *
 * <p>Started once per JVM and shared by every test: booting a backend costs a minute or two,
 * paying that per test class would blow the budget of the suite.
 *
 * <p>No service is published on a fixed host port ({@code "127.0.0.1::80"} in the compose files):
 * docker picks free ones, {@link #port} reads them back. Two runs never clash.
 *
 * <p>{@code E2E_REUSE_STACK=true} keeps the stack between runs under a fixed project name
 * ({@code twake-admin-e2e-mail}, {@code twake-admin-e2e-calendar}): the next run attaches to it in
 * a second instead of booting it again. Tests isolate their data from each other anyway, so a
 * stack that already ran tests is as good as a fresh one. Drop it with
 * {@code docker compose -p twake-admin-e2e-mail down -v}.
 */
public abstract class ComposeStack {
    private static final Logger LOGGER = LoggerFactory.getLogger(ComposeStack.class);
    private static final Duration STARTUP_TIMEOUT = Duration.ofMinutes(10);

    private final String composeFile;
    private final String project;
    private final boolean reuse;
    private final Map<String, Integer> ports = new ConcurrentHashMap<>();

    protected ComposeStack(String name, String composeFile) {
        this.composeFile = composeFile;
        this.reuse = "true".equals(System.getenv("E2E_REUSE_STACK"));
        this.project = reuse
            ? "twake-admin-e2e-" + name
            : "twake-admin-e2e-" + name + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    public String project() {
        return project;
    }

    protected void start() {
        LOGGER.info("Starting the {} stack, this takes a minute or two...", project);
        Instant start = Instant.now();
        if (reuse) {
            upOnceAcrossProcesses();
        } else {
            compose("up", "-d", "--quiet-pull");
        }
        if (!reuse) {
            Runtime.getRuntime().addShutdownHook(new Thread(this::stop));
        }
        awaitReady(start.plus(STARTUP_TIMEOUT));
        LOGGER.info("{} stack up in {}s", project, Duration.between(start, Instant.now()).toSeconds());
    }

    /**
     * A reused stack may be shared by several maven runs at once: {@code up} is serialized
     * between them by a file lock, and skipped when every service already runs, so that one run
     * never recreates containers under the tests of another.
     */
    private void upOnceAcrossProcesses() {
        Path lockFile = Paths.get(System.getProperty("java.io.tmpdir"), project + ".lock");
        try (FileChannel channel = FileChannel.open(lockFile, StandardOpenOption.CREATE, StandardOpenOption.WRITE);
             FileLock lock = channel.lock()) {
            List<String> services = lines(compose("config", "--services"));
            List<String> running = lines(compose("ps", "--status", "running", "--services"));
            if (!running.containsAll(services)) {
                compose("up", "-d", "--quiet-pull");
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static List<String> lines(String output) {
        return output.lines().map(String::trim).filter(line -> !line.isEmpty()).toList();
    }

    /** Blocks until the backend answers, polling with {@link #isReady()}. */
    private void awaitReady(Instant deadline) {
        while (Instant.now().isBefore(deadline)) {
            try {
                if (isReady()) {
                    return;
                }
            } catch (RuntimeException e) {
                // not up yet
            }
            sleep(Duration.ofSeconds(2));
        }
        throw new IllegalStateException(project + " did not start within " + STARTUP_TIMEOUT
            + ", see: docker compose -p " + project + " logs");
    }

    protected abstract boolean isReady();

    private void stop() {
        try {
            compose("down", "--volumes", "--remove-orphans", "--timeout", "2");
        } catch (RuntimeException e) {
            LOGGER.warn("Could not stop {}", project, e);
        }
    }

    /** The host port docker published {@code containerPort} of {@code service} on. */
    public int port(String service, int containerPort) {
        return ports.computeIfAbsent(service + ":" + containerPort, key -> {
            String output = compose("port", service, String.valueOf(containerPort)).trim();
            // 127.0.0.1:32768
            return Integer.parseInt(output.substring(output.lastIndexOf(':') + 1));
        });
    }

    public String url(String service, int containerPort) {
        return "http://127.0.0.1:" + port(service, containerPort);
    }

    /** Runs a command in a running container of the stack, returns its standard output. */
    public String exec(String service, String... command) {
        List<String> args = new ArrayList<>(List.of("exec", "-T", service));
        args.addAll(List.of(command));
        return compose(args.toArray(String[]::new));
    }

    /**
     * Starts a long running command in a running container of the stack, its standard input and
     * output attached to the returned process (standard error is discarded). The caller destroys it.
     */
    public Process spawn(String service, String... command) {
        List<String> args = new ArrayList<>(List.of("docker", "compose", "-p", project,
            "-f", composeFilePath().toString(), "exec", "-T", service));
        args.addAll(List.of(command));
        try {
            return new ProcessBuilder(args)
                .redirectError(ProcessBuilder.Redirect.DISCARD)
                .start();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** Chromium {@code --host-resolver-rules} entry pointing {@code hostname} at a published port. */
    protected String rule(String hostname, String service, int containerPort) {
        return "MAP " + hostname + " 127.0.0.1:" + port(service, containerPort);
    }

    /**
     * Chromium {@code --host-resolver-rules} value mapping every URL the admin app is
     * configured with (its own origin, WebAdmin) onto the ports docker published.
     */
    public abstract String hostResolverRules();

    /** The origin the admin app is served on, as the browser sees it. */
    public abstract String adminUrl();

    /** WebAdmin of the backend, as reachable from the tests. */
    public abstract String webAdminUrl();

    protected String compose(String... args) {
        List<String> command = new ArrayList<>(List.of("docker", "compose", "-p", project,
            "-f", composeFilePath().toString()));
        command.addAll(List.of(args));
        try {
            Process process = new ProcessBuilder(command)
                .redirectErrorStream(true)
                .start();
            String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            if (!process.waitFor(STARTUP_TIMEOUT.toSeconds(), TimeUnit.SECONDS) || process.exitValue() != 0) {
                throw new IllegalStateException(String.join(" ", command) + " failed:\n" + output);
            }
            return output;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }

    private Path composeFilePath() {
        String resources = System.getProperty("e2e.resources.dir");
        if (resources != null) {
            return Paths.get(resources, composeFile);
        }
        try {
            return Paths.get(ComposeStack.class.getResource("/" + composeFile).toURI());
        } catch (URISyntaxException e) {
            throw new IllegalStateException(e);
        }
    }

    private static final HttpClient HTTP = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(2))
        .build();

    protected static int httpStatus(String url) {
        try {
            return HTTP.send(HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(5)).GET().build(),
                HttpResponse.BodyHandlers.discarding()).statusCode();
        } catch (IOException e) {
            return -1;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return -1;
        }
    }

    private static void sleep(Duration duration) {
        try {
            Thread.sleep(duration.toMillis());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }
}
