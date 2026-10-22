package com.linagora.admin.e2e.mail.shell;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.shell.HealthCheckPage;
import com.linagora.admin.e2e.pages.mail.shell.StatusColor;

class HealthCheckTest extends MailAdminE2ETest {
    private static final Set<String> STORAGE = Set.of("RabbitMQ backend", "Cassandra backend", "OpenSearch Backend", "Redis", "LDAP User Server");
    private static final Set<String> CORE = Set.of("EmptyErrorMailRepository", "EventDeadLettersHealthCheck", "MailReceptionCheck", "IMAPHealthCheck");
    /** Components whose status does not depend on what the other tests do. */
    private static final List<String> STABLE = List.of("Redis", "Cassandra backend", "RabbitMQ backend", "OpenSearch Backend");

    private static Map<String, String> statuses(WebAdmin webAdmin) {
        Map<String, String> statuses = new TreeMap<>();
        for (JsonNode check : webAdmin.get("/healthcheck").json().path("checks")) {
            statuses.put(check.path("componentName").asText(), check.path("status").asText());
        }
        return statuses;
    }

    @Test
    @DisplayName("HC-01 Health check sections")
    void healthCheckSections(AdminApp app, WebAdmin webAdmin) {
        app.open("/");
        app.navigate("Health Check");
        HealthCheckPage healthCheck = new HealthCheckPage(app);
        assertThat(healthCheck.title()).isVisible();
        assertThat(healthCheck.sectionHeadings().first()).isVisible();

        Map<String, String> statuses = statuses(webAdmin);
        List<String> storage = new ArrayList<>();
        List<String> core = new ArrayList<>();
        List<String> rabbitmq = new ArrayList<>();
        List<String> other = new ArrayList<>();
        statuses.keySet().forEach(name -> {
            if (STORAGE.contains(name)) {
                storage.add(name);
            } else if (CORE.contains(name)) {
                core.add(name);
            } else if (name.endsWith("DeadLetterQueueHealthCheck") || name.contains("Consumers")) {
                rabbitmq.add(name);
            } else {
                other.add(name);
            }
        });

        assertThat(healthCheck.sectionTitles()).containsExactly(
            HealthCheckPage.STORAGE, HealthCheckPage.CORE, HealthCheckPage.RABBITMQ, HealthCheckPage.OTHER);
        assertThat(storage).containsExactlyInAnyOrder("RabbitMQ backend", "Cassandra backend", "OpenSearch Backend", "Redis");
        assertThat(core).containsExactlyInAnyOrderElementsOf(CORE);
        assertThat(rabbitmq).contains("RabbitMQConsumers");
        assertThat(other).contains("Guice application lifecycle", "Tasks execution");

        assertThat(healthCheck.componentsOf(HealthCheckPage.STORAGE)).containsExactlyInAnyOrderElementsOf(storage);
        assertThat(healthCheck.componentsOf(HealthCheckPage.CORE)).containsExactlyInAnyOrderElementsOf(core);
        assertThat(healthCheck.componentsOf(HealthCheckPage.RABBITMQ)).containsExactlyInAnyOrderElementsOf(rabbitmq);
        assertThat(healthCheck.componentsOf(HealthCheckPage.OTHER)).containsExactlyInAnyOrderElementsOf(other);
        // WebAdmin answers in completion order: the cards are sorted by name so their places stay stable
        assertThat(healthCheck.componentsOf(HealthCheckPage.STORAGE))
            .containsExactly("Cassandra backend", "OpenSearch Backend", "RabbitMQ backend", "Redis");
        // Every component exactly once
        assertThat(healthCheck.allComponents()).containsExactlyInAnyOrderElementsOf(statuses.keySet());

        for (String component : STABLE) {
            assertThat(statuses.get(component)).isEqualTo("healthy");
            assertThat(StatusColor.of(healthCheck.borderColor(component))).as(component).isEqualTo(StatusColor.GREEN);
            assertThat(StatusColor.of(healthCheck.textColor(component))).as(component).isEqualTo(StatusColor.GREEN);
        }
    }

    @Test
    @DisplayName("HC-01 Health check cards state their status without colour")
    void healthCheckStatusIsNotColourOnly(AdminApp app, WebAdmin webAdmin) {
        HealthCheckPage healthCheck = HealthCheckPage.open(app);

        assertThat(healthCheck.status("Redis")).hasText("Healthy");
    }
}
