package com.linagora.admin.e2e.pages.mail.shell;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

/**
 * Shell level checks shared by the navigation / accessibility cases: entries of the sidebar,
 * collapsible sections, page width, unnamed buttons, raw i18n keys.
 */
public final class Shell {
    /** The sidebar entries of the Mail application, in order. */
    public static final List<String> MAIL_ENTRIES = List.of(
        "Health Check", "Mail Repositories", "Event Dead Letter", "Domains", "Global Quota", "Users",
        "Mappings", "Mailing Lists", "Network Channels", "Cassandra", "Tasks", "Common Tasks",
        "Resource Locator", "JMAP Settings Report", "Live Metrics");

    /** The route of each entry of {@link #MAIL_ENTRIES}, same order. */
    public static final List<String> MAIL_ROUTES = List.of(
        "/health-check", "/mail-repositories", "/event-dead-letter", "/domains", "/global-quota", "/users",
        "/mappings", "/mailing-lists", "/network-channels", "/cassandra", "/tasks", "/common-tasks",
        "/resource-locator", "/jmap-settings-report", "/live-metrics");

    /** {@code - button} with no name in an ARIA snapshot, possibly followed by attributes ({@code [disabled]}). */
    private static final Pattern UNNAMED_BUTTON = Pattern.compile("(?m)^\\s*- button(?: \\[[^\\]]*\\])*:?\\s*$");
    /** A raw i18n key such as {@code users.searchPlaceholder} left in the page. */
    private static final Pattern RAW_KEY = Pattern.compile(
        "\\b(?:common|users|domains|sidebar|mappings|tasks|healthCheck|globalQuota|mailingLists|networkChannels|"
            + "liveMetrics|resourceLocator|jmapReport|cassandra|mailRepositories|eventDeadletter|commonTasks)"
            + "\\.[a-zA-Z]+(?:\\.[a-zA-Z]+)*\\b");

    private Shell() {
    }

    public static Locator sidebarLink(AdminApp app, String entry) {
        return app.sidebar().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName(entry).setExact(true));
    }

    /** The "(doc)" link of the page header. */
    public static Locator docLink(AdminApp app) {
        return app.main().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName("doc").setExact(true)).first();
    }

    /** The menu button of the thin bar shown below 768 px. */
    public static Locator mobileMenuButton(Page page) {
        return page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Toggle Sidebar").setExact(true));
    }

    /**
     * Opens every collapsed section of a detail page: the section toggles are the buttons whose
     * first child is a "chevron right" icon. Repeats as long as opening a section reveals new ones.
     * Returns how many toggles were clicked.
     */
    public static int openAllSections(Page page) {
        int clicked = 0;
        for (int pass = 0; pass < 5; pass++) {
            Number count = (Number) page.evaluate("() => {"
                + "  const toggles = [...document.querySelectorAll('main button')]"
                + "    .filter(b => b.firstElementChild && b.firstElementChild.matches('svg.lucide-chevron-right')"
                + "      && b.textContent.trim().length > 0 && !b.disabled);"
                + "  toggles.forEach(b => b.click());"
                + "  return toggles.length;"
                + "}");
            if (count.intValue() == 0) {
                break;
            }
            clicked += count.intValue();
        }
        return clicked;
    }

    /** {@code document.documentElement.scrollWidth}: wider than the viewport means a horizontal scroll. */
    public static int scrollWidth(Page page) {
        return ((Number) page.evaluate("() => document.documentElement.scrollWidth")).intValue();
    }

    /** The lines of the ARIA snapshot of {@code scope} announcing a button without a name. */
    public static List<String> unnamedButtons(Locator scope) {
        String snapshot = scope.ariaSnapshot();
        Matcher matcher = UNNAMED_BUTTON.matcher(snapshot);
        List<String> found = new java.util.ArrayList<>();
        while (matcher.find()) {
            found.add(matcher.group().trim());
        }
        return found;
    }

    /** The raw i18n keys found in a text. */
    public static List<String> rawI18nKeys(String text) {
        Matcher matcher = RAW_KEY.matcher(text);
        List<String> found = new java.util.ArrayList<>();
        while (matcher.find()) {
            found.add(matcher.group());
        }
        return found;
    }

    /** Escapes a text for a regex that Playwright hands over to JavaScript (no \\Q...\\E there). */
    public static String quote(String text) {
        return text.replaceAll("[\\\\^$.|?*+()\\[\\]{}/-]", "\\\\$0");
    }

    /** A pattern matching exactly {@code text}, safe for Playwright. */
    public static Pattern exactly(String text) {
        return Pattern.compile("^" + quote(text) + "$");
    }

    /**
     * Asserts that a dialog keeps its content inside: no horizontal overflow, the dialog fits the
     * viewport, and each named button lies fully within the dialog box.
     */
    public static void assertDialogFits(Page page, Locator dialog, String... buttons) {
        awaitAnimations(dialog);
        com.microsoft.playwright.options.BoundingBox box = dialog.boundingBox();
        int viewport = page.viewportSize().width;
        org.assertj.core.api.Assertions.assertThat(box.x).as("dialog left edge").isGreaterThanOrEqualTo(0);
        org.assertj.core.api.Assertions.assertThat(box.x + box.width).as("dialog right edge").isLessThanOrEqualTo(viewport + 0.5);
        Number overflow = (Number) dialog.evaluate("d => d.scrollWidth - d.clientWidth");
        org.assertj.core.api.Assertions.assertThat(overflow.intValue()).as("dialog horizontal overflow").isLessThanOrEqualTo(0);
        for (String name : buttons) {
            Locator button = dialog.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(name).setExact(true));
            com.microsoft.playwright.options.BoundingBox b = button.boundingBox();
            org.assertj.core.api.Assertions.assertThat(b.x).as(name + " left").isGreaterThanOrEqualTo(box.x - 0.5);
            org.assertj.core.api.Assertions.assertThat(b.x + b.width).as(name + " right").isLessThanOrEqualTo(box.x + box.width + 0.5);
            org.assertj.core.api.Assertions.assertThat(b.y + b.height).as(name + " bottom").isLessThanOrEqualTo(box.y + box.height + 0.5);
        }
        org.assertj.core.api.Assertions.assertThat(scrollWidth(page)).as("page width").isLessThanOrEqualTo(viewport);
    }

    /** Waits for the CSS animations of an element (a dialog zooming in) to finish: its box is final then. */
    public static void awaitAnimations(Locator locator) {
        locator.evaluate("e => Promise.all(e.getAnimations({ subtree: true }).map(a => a.finished.catch(() => null)))");
    }

    /** Asserts an icon-only button shows a tooltip ({@code title}) equal to its accessible name. */
    public static void assertNamedWithTooltip(Locator button, String name) {
        com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat(button).hasAccessibleName(name);
        com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat(button).hasAttribute("title", name);
    }

    /** CSS font weight of an element, {@code 700} for bold. */
    public static int fontWeight(Locator locator) {
        return Integer.parseInt(String.valueOf(locator.evaluate("e => getComputedStyle(e).fontWeight")));
    }
}
