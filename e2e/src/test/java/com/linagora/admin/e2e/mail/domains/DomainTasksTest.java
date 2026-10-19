package com.linagora.admin.e2e.mail.domains;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.domains.DomainDetailPage;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Request;
import com.microsoft.playwright.options.AriaRole;

class DomainTasksTest extends MailAdminE2ETest {
    private static final Pattern TASK_LINK = Pattern.compile("^Task ([0-9a-f-]{36})$");

    @Test
    @DisplayName("DOM-14 Domain tasks: rows, apply signature templates, provision templates")
    void applySignaturesAndProvisionTemplates(AdminApp app, MailFixtures fixtures) {
        String domain = fixtures.domain();
        WebAdmin webAdmin = fixtures.webAdmin();
        String alice = fixtures.newUser("alice");
        fixtures.newUser("bob");
        webAdmin.put("/users/" + alice + "/mailboxes/Templates").expect(204);

        DomainDetailPage detail = DomainDetailPage.open(app, domain).openSection("Tasks");
        for (String row : new String[] {"Provision templates", "Apply signature templates", "Delete all users data"}) {
            assertThat(detail.text(row)).isVisible();
        }
        assertThat(detail.button("Run")).hasCount(3);

        // Apply signature templates: this backend has no such route (see DOM-11), the refusal is shown as text
        runButton(detail, "Apply signature templates").click();
        assertThat(app.dialog()).containsText("Apply the domain signature templates to all users of \"" + domain + "\"");
        app.confirm();
        assertThat(app.toast("Error applying signature templates").or(app.toast("Applied: "))).isVisible();

        // Provision templates: the source user is required, checked inside the dialog
        runButton(detail, "Provision templates").click();
        Locator dialog = app.dialog();
        Locator source = dialog.getByLabel("Source user", new Locator.GetByLabelOptions().setExact(true));
        Locator folder = dialog.getByLabel("Folder name", new Locator.GetByLabelOptions().setExact(true));
        Locator usersPerSecond = dialog.getByLabel("Users per second", new Locator.GetByLabelOptions().setExact(true));
        assertThat(source).isVisible();
        assertThat(folder).isVisible();
        assertThat(usersPerSecond).hasValue("1");
        assertThat(dialog).containsText("Command: curl -XPOST /domains/" + domain
            + "/templates?action=provision&from={sourceUser}&usersPerSecond=1");
        app.clickConfirm();
        assertThat(app.dialogError()).hasText("Source user is required");
        assertThat(dialog).isVisible();

        source.fill(alice);
        assertThat(dialog.getByText("User exists")).isVisible();
        folder.fill("Templates");
        usersPerSecond.fill("5");
        assertThat(dialog).containsText("Command: curl -XPOST /domains/" + domain
            + "/templates?action=provision&from=" + alice + "&folderName=Templates&usersPerSecond=5");
        app.confirm();
        String taskId = taskIdOfToast(app, "Task created");
        JsonNode task = webAdmin.awaitTask(taskId);
        assertThat(task.path("status").asText()).isEqualTo("completed");
    }

    @Test
    @DisplayName("DOM-14 Domain tasks: delete all users data of a throw-away domain")
    void deleteAllUsersData(AdminApp app, MailFixtures fixtures, Page page) {
        String domain = fixtures.domain();
        WebAdmin webAdmin = fixtures.webAdmin();
        String user = fixtures.newUser("u1");
        webAdmin.put("/users/" + user + "/mailboxes/INBOX").expect(204);
        // A user of another domain, who must keep its data
        String bystander = fixtures.newUser("keep", fixtures.newDomain("keep"));
        webAdmin.put("/users/" + bystander + "/mailboxes/INBOX").expect(204);
        webAdmin.put("/users/" + bystander + "/mailboxes/Work").expect(204);

        DomainDetailPage detail = DomainDetailPage.open(app, domain).openSection("Tasks");
        runButton(detail, "Delete all users data").click();
        assertThat(app.dialog()).containsText("Delete All Users Data");
        assertThat(app.dialog()).containsText("This will delete the data of ALL users belonging to \"" + domain
            + "\". This action cannot be undone. Are you sure?");
        assertThat(app.dialog()).containsText("Command: curl -XPOST /domains/" + domain + "?action=deleteData");
        Request sent = page.waitForRequest(
            request -> request.method().equals("POST") && request.url().contains("action=deleteData"), app::confirm);
        assertThat(sent.url()).endsWith("/domains/" + domain + "?action=deleteData");

        String taskId = taskIdOfToast(app, "Task created");
        JsonNode task = webAdmin.awaitTask(taskId);
        assertThat(task.path("status").asText()).isEqualTo("completed");
        assertThat(task.path("type").asText()).isEqualTo("DeleteUsersDataOfDomainTask");
        assertThat(webAdmin.get("/users/" + user + "/mailboxes").expect(200).json().size()).isZero();
        assertThat(webAdmin.get("/users/" + bystander + "/mailboxes").expect(200).json().size()).isEqualTo(2);
    }

    /** The Run button of a task row. */
    private static Locator runButton(DomainDetailPage detail, String row) {
        return detail.text(row).locator("xpath=ancestor::div[.//button][1]")
            .getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Run").setExact(true));
    }

    private static String taskIdOfToast(AdminApp app, String title) {
        Locator link = app.toast(title).getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName(TASK_LINK));
        assertThat(link).isVisible();
        Matcher matcher = TASK_LINK.matcher(link.textContent().trim());
        assertThat(matcher.matches()).isTrue();
        assertThat(link).hasAttribute("href", "/task/" + matcher.group(1));
        return matcher.group(1);
    }
}
