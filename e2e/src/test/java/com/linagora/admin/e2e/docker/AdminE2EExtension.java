package com.linagora.admin.e2e.docker;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Collections;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.junit.jupiter.api.extension.AfterEachCallback;
import org.junit.jupiter.api.extension.AfterTestExecutionCallback;
import org.junit.jupiter.api.extension.BeforeEachCallback;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.junit.jupiter.api.extension.ParameterContext;
import org.junit.jupiter.api.extension.ParameterResolver;

import com.linagora.admin.e2e.backend.CalendarFixtures;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.Tracing;

/**
 * Wires a Playwright {@link Page} onto the stack of the test class ({@link UsesStack}), one fresh
 * browser context per test.
 *
 * <p>Injectable parameters: {@link Page}, {@link BrowserContext}, {@link AdminApp} (the page,
 * already on the admin app), {@link WebAdmin}, {@link MailFixtures} / {@link CalendarFixtures},
 * {@link MailStack} / {@link CalendarStack} and {@link BrowserLog}.
 *
 * <p><b>Parallelism.</b> Test classes run several at a time, see {@code junit-platform.properties}.
 * Playwright is not thread safe and its objects belong to the thread that created them, so every
 * worker thread gets its own engine, and its own browser per stack (the host resolver rules of
 * a browser are fixed at launch). What is shared is what can be: the docker stacks and the
 * WebAdmin clients. The state of a running test lives in a {@link ThreadLocal}.
 *
 * <p>Knobs, through environment variables:
 * <ul>
 *   <li>{@code E2E_HEADLESS=false} to watch the browser drive the app</li>
 *   <li>{@code E2E_SLOWMO=<ms>} to slow every action down</li>
 *   <li>{@code E2E_TRACE=always} to always record a trace, not only on failure</li>
 *   <li>{@code E2E_REUSE_STACK=true} to keep the docker stacks between runs, see {@link ComposeStack}</li>
 * </ul>
 * Failures leave a screenshot and a Playwright trace under {@code target/e2e-artifacts/}.
 */
public class AdminE2EExtension implements BeforeEachCallback, AfterTestExecutionCallback,
    AfterEachCallback, ParameterResolver {

    private static final Path ARTIFACTS = Paths.get(System.getProperty("e2e.build.dir", "target"), "e2e-artifacts");
    /**
     * Generous on purpose: several classes share one backend, a response that takes an instant
     * on an idle stack can take seconds under load. A tight value does not catch bugs, it
     * manufactures flakes.
     */
    private static final double DEFAULT_TIMEOUT_MS = 20_000;

    private static final ThreadLocal<Playwright> ENGINE = new ThreadLocal<>();
    private static final ThreadLocal<Map<Application, Browser>> BROWSERS = ThreadLocal.withInitial(() -> new EnumMap<>(Application.class));
    private static final List<Playwright> ENGINES = Collections.synchronizedList(new ArrayList<>());
    private static final Map<Application, WebAdmin> WEBADMINS = new ConcurrentHashMap<>();

    static {
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            synchronized (ENGINES) {
                ENGINES.forEach(Playwright::close);
            }
        }));
    }

    private static final ThreadLocal<TestState> STATE = new ThreadLocal<>();

    private static final class TestState {
        private Application application;
        private BrowserContext context;
        private Page page;
        private BrowserLog browserLog;
        private MailFixtures mailFixtures;
        private CalendarFixtures calendarFixtures;
    }

    private static Browser browser(Application application) {
        return BROWSERS.get().computeIfAbsent(application, app -> {
            Playwright playwright = ENGINE.get();
            if (playwright == null) {
                // Only chromium is used, pre-build.sh installs it: no download of every browser
                // on the first run
                playwright = Playwright.create(new Playwright.CreateOptions()
                    .setEnv(Map.of("PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD", "1")));
                ENGINE.set(playwright);
                ENGINES.add(playwright);
            }
            return playwright.chromium().launch(new BrowserType.LaunchOptions()
                .setHeadless(!"false".equals(System.getenv("E2E_HEADLESS")))
                .setSlowMo(slowMo())
                .setArgs(List.of(
                    "--host-resolver-rules=" + app.stack().hostResolverRules(),
                    "--disable-dev-shm-usage",
                    "--no-sandbox")));
        });
    }

    private static double slowMo() {
        String slowMo = System.getenv("E2E_SLOWMO");
        return slowMo == null ? 0 : Double.parseDouble(slowMo);
    }

    static WebAdmin webAdmin(Application application) {
        return WEBADMINS.computeIfAbsent(application, app -> new WebAdmin(app.stack().webAdminUrl()));
    }

    private static Application application(ExtensionContext extensionContext) {
        UsesStack usesStack = extensionContext.getRequiredTestClass().getAnnotation(UsesStack.class);
        if (usesStack == null) {
            throw new IllegalStateException(extensionContext.getRequiredTestClass()
                + " must extend MailAdminE2ETest or CalendarAdminE2ETest");
        }
        return usesStack.value();
    }

    @Override
    public void beforeEach(ExtensionContext extensionContext) {
        TestState state = new TestState();
        state.application = application(extensionContext);
        Browser browser = browser(state.application);
        state.context = browser.newContext(new Browser.NewContextOptions()
            .setBaseURL(state.application.stack().adminUrl())
            .setViewportSize(1280, 800)
            .setLocale("en-US")
            .setTimezoneId("Europe/Paris")
            .setAcceptDownloads(true));
        state.context.setDefaultTimeout(DEFAULT_TIMEOUT_MS);
        state.context.grantPermissions(List.of("clipboard-read", "clipboard-write"));
        state.browserLog = new BrowserLog();
        state.context.tracing().start(new Tracing.StartOptions()
            .setScreenshots(true)
            .setSnapshots(true)
            .setSources(false));

        state.page = state.context.newPage();
        state.page.onConsoleMessage(message -> {
            if ("error".equals(message.type())) {
                state.browserLog.recordConsoleError(message.text());
            }
        });
        state.page.onResponse(response -> {
            if (response.status() >= 400) {
                state.browserLog.recordFailedRequest(response.status(), response.request().method(), response.url());
            }
        });
        state.page.onPageError(error -> {
            state.browserLog.recordPageError(error);
            System.out.println("[browser page error] " + testId(extensionContext) + " " + error);
        });
        STATE.set(state);
    }

    @Override
    public void afterTestExecution(ExtensionContext extensionContext) {
        TestState state = STATE.get();
        boolean failed = extensionContext.getExecutionException().isPresent();
        Path directory = ARTIFACTS.resolve(testId(extensionContext));
        try {
            if (failed) {
                state.page.screenshot(new Page.ScreenshotOptions()
                    .setPath(directory.resolve("failure.png"))
                    .setFullPage(true));
                System.out.println("[e2e] failure artifacts in " + directory.toAbsolutePath());
            }
            if (failed || "always".equals(System.getenv("E2E_TRACE"))) {
                state.context.tracing().stop(new Tracing.StopOptions().setPath(directory.resolve("trace.zip")));
            } else {
                state.context.tracing().stop();
            }
        } catch (RuntimeException e) {
            System.out.println("[e2e] could not save the artifacts of " + testId(extensionContext) + ": " + e);
        }
    }

    @Override
    public void afterEach(ExtensionContext extensionContext) {
        TestState state = STATE.get();
        if (state != null) {
            try {
                state.context.close();
            } finally {
                STATE.remove();
            }
        }
    }

    private static String testId(ExtensionContext extensionContext) {
        return extensionContext.getRequiredTestClass().getSimpleName()
            + "/" + extensionContext.getRequiredTestMethod().getName()
            + extensionContext.getDisplayName().replaceAll("[^A-Za-z0-9]+", "_");
    }

    private static final List<Class<?>> SUPPORTED = List.of(Page.class, BrowserContext.class, AdminApp.class,
        WebAdmin.class, MailFixtures.class, CalendarFixtures.class, MailStack.class, CalendarStack.class,
        BrowserLog.class);

    @Override
    public boolean supportsParameter(ParameterContext parameterContext, ExtensionContext extensionContext) {
        return SUPPORTED.contains(parameterContext.getParameter().getType());
    }

    @Override
    public Object resolveParameter(ParameterContext parameterContext, ExtensionContext extensionContext) {
        Class<?> type = parameterContext.getParameter().getType();
        TestState state = STATE.get();
        if (type == Page.class) {
            return state.page;
        }
        if (type == BrowserContext.class) {
            return state.context;
        }
        if (type == AdminApp.class) {
            return new AdminApp(state.page);
        }
        if (type == WebAdmin.class) {
            return webAdmin(state.application);
        }
        if (type == BrowserLog.class) {
            return state.browserLog;
        }
        if (type == MailStack.class) {
            return MailStack.singleton();
        }
        if (type == CalendarStack.class) {
            return CalendarStack.singleton();
        }
        if (type == MailFixtures.class) {
            if (state.mailFixtures == null) {
                state.mailFixtures = new MailFixtures(MailStack.singleton(), webAdmin(Application.MAIL));
            }
            return state.mailFixtures;
        }
        if (state.calendarFixtures == null) {
            state.calendarFixtures = new CalendarFixtures(CalendarStack.singleton(), webAdmin(Application.CALENDAR));
        }
        return state.calendarFixtures;
    }
}
