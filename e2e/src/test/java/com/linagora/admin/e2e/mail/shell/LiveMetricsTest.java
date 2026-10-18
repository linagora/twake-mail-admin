package com.linagora.admin.e2e.mail.shell;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.docker.BrowserLog;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.shell.Shell;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Response;
import com.microsoft.playwright.options.AriaRole;

class LiveMetricsTest extends MailAdminE2ETest {
    /** {@code GET /metrics} answers 404 on this WebAdmin: the page shows WebAdmin's message. */
    private static final String ERROR = "Error: Failed to fetch data: GET /metrics can not be found";

    @Test
    @DisplayName("LM-01 Live metrics page")
    void liveMetricsPage(AdminApp app, Page page, WebAdmin webAdmin, BrowserLog log) {
        assertThat(webAdmin.get("/metrics").status()).isEqualTo(404);

        app.open("/");
        app.navigate("Live Metrics");
        assertThat(app.heading()).hasText("Live Metrics");
        Locator refresh = app.button("Refresh metrics");
        Shell.assertNamedWithTooltip(refresh, "Refresh metrics");

        Locator error = app.main().getByText(ERROR, new Locator.GetByTextOptions().setExact(true));
        assertThat(error).isVisible();
        assertThat(app.main()).not().containsText("statusCode");

        // Refresh retries
        Response retried = page.waitForResponse(response -> response.url().endsWith("/metrics"), refresh::click);
        assertThat(retried.status()).isEqualTo(404);
        assertThat(error).isVisible();

        Locator filter = app.main().getByPlaceholder("Filter metrics...");
        filter.fill("jvm");
        assertThat(error).isVisible();
        assertThat(app.main().getByRole(AriaRole.BUTTON).filter(new Locator.FilterOptions().setHasText("samples"))).hasCount(0);

        page.setViewportSize(390, 800);
        assertThat(error).isVisible();
        assertThat(Shell.scrollWidth(page)).isLessThanOrEqualTo(390);
        assertThat(log.pageErrors()).isEmpty();
    }
}
