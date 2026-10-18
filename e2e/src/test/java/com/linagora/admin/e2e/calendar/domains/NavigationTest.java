package com.linagora.admin.e2e.calendar.domains;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.regex.Pattern;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.linagora.admin.e2e.CalendarAdminE2ETest;
import com.linagora.admin.e2e.backend.CalendarFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.calendar.domains.CalendarDomainPage;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;
import com.microsoft.playwright.options.LoadState;

class NavigationTest extends CalendarAdminE2ETest {
    private static final String DOC = "https://github.com/linagora/twake-calendar-side-service/blob/main/docs/apis/webadmin.md";

    @Test
    @DisplayName("NAV-01 Sidebar lists only the calendar sections")
    void sidebarListsOnlyCalendarSections(AdminApp app, Page page) {
        app.open("/");

        assertThat(page).hasURL(Pattern.compile("/health-check$"));
        assertThat(app.sidebar().getByRole(AriaRole.LINK)).hasText(new String[] {
            "Health Check", "Domains", "Users", "Registered Users", "Unsent Mails", "Tasks", "Common Tasks"});
        assertThat(app.sidebar().getByRole(AriaRole.IMG, new Locator.GetByRoleOptions().setName("Twake Calendar"))).isVisible();
        assertThat(app.sidebar().getByText("Calendar", new Locator.GetByTextOptions().setExact(true))).isVisible();
        assertThat(app.sidebar().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName("Health Check")))
            .hasAttribute("aria-current", "page");
        assertThat(app.sidebar().locator("[aria-current=page]")).hasCount(1);
        assertThat(app.sidebar().getByTitle("Language")).isVisible();
        assertThat(app.sidebar().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Logout"))).hasCount(0);
        for (String mailEntry : List.of("Mail Repositories", "Event Dead Letter", "Global Quota", "Mappings",
            "Mailing Lists", "Network Channels", "Cassandra", "Resource Locator", "JMAP Settings Report", "Live Metrics")) {
            assertThat(app.sidebar().getByText(mailEntry)).hasCount(0);
        }
        assertThat(page.getByText("Authentication Required")).hasCount(0);

        app.navigate("Domains");
        assertThat(page).hasURL(Pattern.compile("/domains$"));
        assertThat(app.sidebar().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName("Domains")))
            .hasAttribute("aria-current", "page");
    }

    @Test
    @DisplayName("NAV-02 Mail-only routes render nothing")
    void mailOnlyRoutesRenderNothing(AdminApp app, Page page) {
        List<String> requests = new CopyOnWriteArrayList<>();
        page.onRequest(request -> {
            if (List.of("xhr", "fetch").contains(request.resourceType())) {
                requests.add(request.url());
            }
        });

        for (String route : List.of("/mail-repositories", "/global-quota", "/mappings", "/event-dead-letter",
            "/users/user/alice%40open-paas.org/message-search")) {
            app.open(route);
            page.waitForLoadState(LoadState.NETWORKIDLE);

            assertThat(app.main().getByRole(AriaRole.HEADING)).hasCount(0);
            assertThat(app.main().innerText().trim()).as(route).isEmpty();
            assertThat(app.sidebar().getByRole(AriaRole.LINK)).hasCount(7);
        }
        assertThat(requests).noneMatch(url -> url.contains("/mailRepositories") || url.contains("/quota")
            || url.contains("/mappings") || url.contains("/events/deadLetter"));
    }

    @Test
    @DisplayName("NAV-03 Language selector")
    void languageSelector(AdminApp app, Page page) {
        app.open("/health-check");
        Locator language = app.sidebar().getByTitle("Language");

        language.click();
        assertThat(page.getByRole(AriaRole.OPTION)).hasText(new String[] {
            "English", "Français", "Русский", "Tiếng Việt", "Монгол", "Español", "Deutsch", "Italiano"});
        page.getByRole(AriaRole.OPTION, new Page.GetByRoleOptions().setName("Français")).click();

        assertThat(app.sidebar().getByRole(AriaRole.LINK)).hasText(new String[] {
            "Contrôle de santé", "Domaines", "Utilisateurs", "Utilisateurs enregistrés", "Mails non envoyés",
            "Tâches", "Tâches communes"});
        assertThat(app.heading()).containsText("Bienvenue dans l'administration de Twake Calendar !");

        page.reload();
        assertThat(app.sidebar().getByRole(AriaRole.LINK).first()).hasText("Contrôle de santé");
        assertThat(app.heading()).containsText("Bienvenue dans l'administration de Twake Calendar !");

        app.sidebar().getByTitle("Langue").click();
        page.getByRole(AriaRole.OPTION, new Page.GetByRoleOptions().setName("English")).click();
        assertThat(app.sidebar().getByRole(AriaRole.LINK).first()).hasText("Health Check");
        assertThat(app.heading()).containsText("Welcome to Twake Calendar administration!");
    }

    @Test
    @DisplayName("NAV-04 Phone layout")
    void phoneLayout(Page page, CalendarFixtures fixtures) {
        String user = fixtures.newRegisteredUser("phone");
        // The task list is shared: the tasks of the other tests fill it
        page.setViewportSize(390, 844);
        AdminApp app = new AdminApp(page);
        Locator menu = page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Toggle Sidebar"));

        page.navigate("/tasks");
        assertThat(menu).isVisible();
        assertThat(app.sidebar()).isHidden();
        assertThat(app.main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setName("Tasks"))).isVisible();
        assertNoHorizontalScroll(page);

        page.navigate("/users/user/" + WebAdmin.encode(user));
        sectionToggle(app, "Calendars").click();
        sectionToggle(app, "Address Books").click();
        assertThat(app.main().getByText("My contacts")).isVisible();
        assertNoHorizontalScroll(page);

        sectionToggle(app, "Booking Links").click();
        app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Create booking link")).click();
        Locator dialog = app.dialog();
        dialog.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Add rule")).click();
        assertThat(dialog.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Remove rule"))).isVisible();
        assertThat((Boolean) dialog.evaluate("d => d.scrollWidth <= d.clientWidth")).isTrue();
        for (String button : List.of("Cancel", "Create")) {
            Locator locator = dialog.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(button).setExact(true));
            locator.scrollIntoViewIfNeeded();
            assertThat((Boolean) locator.evaluate("b => { const r = b.getBoundingClientRect(); "
                + "return r.left >= 0 && r.right <= window.innerWidth; }")).as(button).isTrue();
        }
        dialog.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Cancel").setExact(true)).click();
        assertThat(dialog).isHidden();

        menu.click();
        Locator sheet = page.getByRole(AriaRole.DIALOG, new Page.GetByRoleOptions().setName("Navigation"));
        assertThat(sheet).isVisible();
        sheet.getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName("Domains").setExact(true)).click();
        assertThat(page).hasURL(Pattern.compile("/domains$"));
        assertThat(sheet).isHidden();
        assertThat(page.getByPlaceholder("Search domains...")).isVisible();
        assertNoHorizontalScroll(page);

        page.setViewportSize(1280, 800);
        assertThat(app.sidebar()).isVisible();
        assertThat(menu).isHidden();
    }

    @Test
    @DisplayName("NAV-05 Doc links point to the side-service WebAdmin documentation")
    void docLinksPointToSideServiceDoc(AdminApp app, Page page) {
        assertDocLink(app, "/health-check", DOC);
        assertDocLink(app, "/domains", DOC);
        assertDocLink(app, "/users", DOC + "#user-calendar-management-routes");
        assertDocLink(app, "/registered-users", DOC + "#calendar-users-routes");
        assertDocLink(app, "/common-tasks", DOC);

        Locator taskDocs = app.main().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName("(doc)").setExact(true));
        assertThat(taskDocs).hasCount(8);
        List<String> hrefs = taskDocs.all().stream().map(link -> link.getAttribute("href")).toList();
        assertThat(hrefs).containsExactly(
            DOC + "#import-ldap-users",
            DOC + "#domain-member-synchronisation",
            DOC + "#calendar-event-reindexing",
            DOC + "#calendar-event-archival",
            DOC + "#alarm-rescheduling",
            DOC + "#add-missing-fields-to-registered-users",
            DOC + "#common-contacts-routes",
            DOC + "#delete-domain-members-contacts");
        List<String> allHrefs = app.main().getByRole(AriaRole.LINK).all().stream()
            .map(link -> link.getAttribute("href")).toList();
        assertThat(allHrefs).allSatisfy(href -> {
            assertThat(href).isNotBlank();
            assertThat(href).doesNotContain("james");
        });
    }

    private static void assertDocLink(AdminApp app, String route, String expectedHref) {
        app.open(route);
        Locator doc = app.main().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName("doc").setExact(true));
        assertThat(doc).hasCount(1);
        assertThat(doc).hasAttribute("href", expectedHref);
    }

    private static Locator sectionToggle(AdminApp app, String title) {
        return CalendarDomainPage.sectionToggle(app.main(), title);
    }

    private static void assertNoHorizontalScroll(Page page) {
        page.waitForLoadState(LoadState.NETWORKIDLE);
        assertThat((Boolean) page.evaluate(
            "() => document.documentElement.scrollWidth <= document.documentElement.clientWidth")).isTrue();
    }
}
