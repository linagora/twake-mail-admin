package com.linagora.admin.e2e.mail.shell;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.regex.Pattern;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.docker.BrowserLog;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.shell.Shell;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

class NavigationTest extends MailAdminE2ETest {

    @Test
    @DisplayName("NAV-01 Sidebar, landing page and no token prompt")
    void sidebarLandingPage(AdminApp app, Page page) {
        app.open("/");

        assertThat(page).hasURL(Pattern.compile("/health-check$"));
        assertThat(app.sidebar().getByRole(AriaRole.LINK)).hasText(Shell.MAIL_ENTRIES.toArray(String[]::new));
        assertThat(app.sidebar().getByText("Registered Users")).hasCount(0);
        assertThat(app.sidebar().getByText("Unsent Mails")).hasCount(0);
        assertThat(app.sidebar().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Logout"))).hasCount(0);

        for (int i = 0; i < Shell.MAIL_ENTRIES.size(); i++) {
            String entry = Shell.MAIL_ENTRIES.get(i);
            app.navigate(entry);

            assertThat(page).hasURL(Pattern.compile(Shell.MAIL_ROUTES.get(i) + "$"));
            Locator link = Shell.sidebarLink(app, entry);
            assertThat(link).hasAttribute("aria-current", "page");
            assertThat(app.sidebar().locator("[aria-current=page]")).hasCount(1);
            assertThat(Shell.fontWeight(link)).as("active entry %s is bold", entry).isGreaterThanOrEqualTo(700);
            assertThat(app.heading()).not().isEmpty();
            // The subtitle paragraph ends with the "(doc)" link
            assertThat(app.main().locator("p").filter(new Locator.FilterOptions().setHas(page.getByRole(AriaRole.LINK, new Page.GetByRoleOptions().setName("doc").setExact(true)))).first())
                .hasText(Pattern.compile("\\S.*\\(doc\\)$"));
        }

        assertThat(Shell.docLink(app)).isVisible();
        app.navigate("JMAP Settings Report");
        assertThat(Shell.docLink(app)).hasAttribute("href",
            Pattern.compile("tmail-backend.*webadmin\\.adoc#jmap-settings-reports$"));
        assertThat(page.getByText("Authentication Required")).hasCount(0);
        assertThat(page.getByText("Bearer")).hasCount(0);
    }

    @Test
    @DisplayName("NAV-03 Direct URL navigation and unknown routes")
    void directUrlNavigation(AdminApp app, MailFixtures fixtures, Page page, BrowserLog log) {
        String user = fixtures.newUser("nav");

        app.open("/users/user/" + WebAdmin.encode(user));
        assertThat(app.main().getByText("Username: " + user, new Locator.GetByTextOptions().setExact(true))).isVisible();
        assertThat(Shell.sidebarLink(app, "Users")).hasAttribute("aria-current", "page");

        app.open("/domains/domain/" + fixtures.domain());
        assertThat(app.main().getByText("Domain: " + fixtures.domain(), new Locator.GetByTextOptions().setExact(true))).isVisible();
        assertThat(Shell.sidebarLink(app, "Domains")).hasAttribute("aria-current", "page");

        app.open("/does-not-exist");
        assertThat(Shell.sidebarLink(app, "Health Check")).isVisible();
        assertThat(app.main()).isVisible();
        assertThat(app.main().getByRole(AriaRole.HEADING)).hasCount(0);
        assertThat(app.sidebar().locator("[aria-current=page]")).hasCount(0);
        assertThat(log.pageErrors()).isEmpty();
    }

    @Test
    @DisplayName("NAV-04 Mobile menu button below 768 px")
    void mobileMenuButton(AdminApp app, Page page) {
        page.setViewportSize(390, 800);
        page.navigate("/users");

        Locator menu = Shell.mobileMenuButton(page);
        assertThat(menu).isVisible();
        assertThat(app.sidebar()).isHidden();
        assertThat(page.locator("main header")).hasCount(1);
        assertThat(page.locator("main header").getByRole(AriaRole.BUTTON)).hasCount(1);
        assertThat(page.locator("main header").boundingBox().height).isBetween(47.0, 49.0);

        menu.click();
        Locator sheet = page.getByRole(AriaRole.DIALOG, new Page.GetByRoleOptions().setName("Navigation"));
        assertThat(sheet).isVisible();
        assertThat(sheet).hasAccessibleDescription("Application navigation menu");
        assertThat(sheet.getByRole(AriaRole.LINK)).hasText(Shell.MAIL_ENTRIES.toArray(String[]::new));

        sheet.getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName("Domains").setExact(true)).click();
        assertThat(page).hasURL(Pattern.compile("/domains$"));
        assertThat(sheet).isHidden();
        assertThat(app.heading()).hasText("Domains");

        menu.click();
        assertThat(sheet).isVisible();
        page.keyboard().press("Escape");
        assertThat(sheet).isHidden();

        page.setViewportSize(1280, 800);
        assertThat(menu).isHidden();
        assertThat(app.sidebar()).isVisible();
        assertThat(Shell.sidebarLink(app, "Domains")).hasAttribute("aria-current", "page");
    }
}
