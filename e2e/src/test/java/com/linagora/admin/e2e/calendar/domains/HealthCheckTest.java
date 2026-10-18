package com.linagora.admin.e2e.calendar.domains;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.util.Set;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.linagora.admin.e2e.CalendarAdminE2ETest;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

class HealthCheckTest extends CalendarAdminE2ETest {
    private static final Set<String> STORAGE = Set.of("MongoDB", "Redis", "OpenSearch Backend", "RabbitMQ backend",
        "LDAP User Server");

    @Test
    @DisplayName("HC-01 Health check page")
    void healthCheckPage(AdminApp app, Page page, WebAdmin webAdmin) {
        app.open("/domains");
        app.navigate("Health Check");

        assertThat(app.heading()).hasText("Welcome to Twake Calendar administration!");
        assertThat(app.main().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName("doc").setExact(true)))
            .hasAttribute("href", "https://github.com/linagora/twake-calendar-side-service/blob/main/docs/apis/webadmin.md");
        Locator storage = section(app, "Storage dependencies");
        Locator other = section(app, "Other");
        assertThat(storage).isVisible();
        assertThat(other).isVisible();

        JsonNode checks = webAdmin.get("/healthcheck").expect(200).json().path("checks");
        int storageCount = 0;
        for (JsonNode check : checks) {
            String name = check.path("componentName").asText();
            boolean isStorage = STORAGE.contains(name);
            storageCount += isStorage ? 1 : 0;
            Locator card = (isStorage ? storage : other).getByText(name, new Locator.GetByTextOptions().setExact(true));
            assertThat(card).hasCount(1);
            if ("healthy".equals(check.path("status").asText())) {
                card.hover();
                assertThat(page.getByRole(AriaRole.TOOLTIP)).hasCount(0);
            }
        }
        assertThat(storage.getByText("MongoDB", new Locator.GetByTextOptions().setExact(true))).isVisible();
        assertThat(storage.getByText("RabbitMQ backend", new Locator.GetByTextOptions().setExact(true))).isVisible();
        assertThat(storage.getByText("OpenSearch Backend", new Locator.GetByTextOptions().setExact(true))).isVisible();
        assertThat(other.getByText("Guice application lifecycle", new Locator.GetByTextOptions().setExact(true))).isVisible();
        assertThat(other.getByText("UnsentMails", new Locator.GetByTextOptions().setExact(true))).isVisible();
        assertThat(other.getByText("RabbitMQDeadLetterQueues", new Locator.GetByTextOptions().setExact(true))).isVisible();
        assertThat(other.getByText("RabbitMQConsumers", new Locator.GetByTextOptions().setExact(true))).isVisible();
        org.assertj.core.api.Assertions.assertThat(storageCount).isEqualTo(3);
    }

    /** A section of cards, by its title: the {@code <section>} holding the heading. */
    private static Locator section(AdminApp app, String title) {
        return app.main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setName(title).setExact(true))
            .locator("xpath=..");
    }
}
