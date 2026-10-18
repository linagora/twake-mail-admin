package com.linagora.admin.e2e.calendar.domains;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.ResourceLock;

import com.fasterxml.jackson.databind.JsonNode;
import com.linagora.admin.e2e.CalendarAdminE2ETest;
import com.linagora.admin.e2e.backend.CalendarFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.calendar.domains.CalendarDomainPage;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Request;
import com.microsoft.playwright.options.AriaRole;

/**
 * Tasks of the domain detail page. The side service of the stack (2.4.7.1) lacks the routes of
 * "Sync domain members" and "Republish common contacts" (404 "can not be found"): an environment
 * limitation, the tests check the request sent and the refusal shown. "Delete all users data" only
 * ever runs on a domain the test created.
 */
@ResourceLock(DomainLocks.OPEN_PAAS)
class DomainTasksTest extends CalendarAdminE2ETest {

    @Test
    @DisplayName("DTASK-01 Sync domain members")
    void syncDomainMembers(AdminApp app, Page page) {
        CalendarDomainPage detail = new CalendarDomainPage(app).open(CalendarFixtures.DOMAIN).expand(CalendarDomainPage.TASKS);
        assertThat(app.main().getByText("Synchronize the domain member list from the address book.")).isVisible();

        detail.taskButton("Sync domain members").click();
        assertThat(app.dialog().getByRole(AriaRole.HEADING)).hasText("Sync Domain Members");
        assertThat(app.dialog()).containsText("Synchronize domain members for \"open-paas.org\" from the address book?");
        Request request = page.waitForRequest(r -> r.url().contains("/addressbook/domain-members/"), app::confirm);

        assertThat(request.method()).isEqualTo("POST");
        assertThat(request.url()).endsWith("/addressbook/domain-members/open-paas.org?task=sync");
        Locator error = app.toast("Error syncing domain members");
        assertThat(error).isVisible();
        assertThat(error).containsText("can not be found");
        assertThat(detail.taskButton("Sync domain members")).isEnabled();
    }

    @Test
    @DisplayName("DTASK-02 Republish domain common contacts")
    void republishDomainCommonContacts(AdminApp app, Page page) {
        CalendarDomainPage detail = new CalendarDomainPage(app).open(CalendarFixtures.DOMAIN).expand(CalendarDomainPage.TASKS);

        detail.taskButton("Republish common contacts").click();
        Locator dialog = app.dialog();
        assertThat(dialog.getByRole(AriaRole.HEADING)).hasText("Republish Common Contacts");
        assertThat(dialog).containsText("Republish the common contacts of \"open-paas.org\" and of its users?");
        Locator perSecond = dialog.getByLabel("contactsPerSecond:");
        assertThat(perSecond).hasValue("100");
        Locator scope = dialog.getByRole(AriaRole.COMBOBOX, new Locator.GetByRoleOptions().setName("scope:"));
        assertThat(scope).isVisible();

        perSecond.fill("10");
        scope.click();
        page.getByRole(AriaRole.OPTION, new Page.GetByRoleOptions().setName("domain").setExact(true)).click();
        assertThat(dialog).containsText("curl -XPOST /domains/open-paas.org/contacts?action=republish&contactsPerSecond=10&scope=domain");

        Request request = page.waitForRequest(r -> r.url().contains("/contacts?action=republish"), app::clickConfirm);
        assertThat(request.url()).endsWith("/domains/open-paas.org/contacts?action=republish&contactsPerSecond=10&scope=domain");
        // Environment limitation: 404, shown inside the dialog that keeps the edited values
        assertThat(app.dialogError()).containsText("can not be found");
        assertThat(dialog).isVisible();
        assertThat(perSecond).hasValue("10");
        assertThat(scope).hasText("domain");
        app.cancel();
    }

    @Test
    @DisplayName("DTASK-03 Delete all users data of a domain")
    void deleteAllUsersDataOfDomain(AdminApp app, Page page, CalendarFixtures fixtures, WebAdmin webAdmin) {
        // Never on open-paas.org: it would wipe the data of every user of the other tests
        String domain = fixtures.newDomain("qa-wipe");
        CalendarDomainPage detail = new CalendarDomainPage(app).open(domain).expand(CalendarDomainPage.TASKS);
        assertThat(app.main().getByText("Deletes the data of every user belonging to this domain. "
            + "A task will be created to track progress.")).isVisible();

        detail.taskButton("Delete all users data").click();
        assertThat(app.dialog().getByRole(AriaRole.HEADING)).hasText("Delete All Users Data");
        assertThat(app.dialog()).containsText("This will delete the data of ALL users belonging to \"" + domain + "\".");
        app.confirm();

        Locator toast = app.toast("Task started");
        assertThat(toast).isVisible();
        Locator link = toast.getByRole(AriaRole.LINK);
        assertThat(toast).containsText("Task:");
        String href = link.getAttribute("href");
        Matcher matcher = Pattern.compile("^/task/([0-9a-f-]{36})$").matcher(href);
        assertThat(matcher.matches()).as(href).isTrue();
        String taskId = matcher.group(1);
        assertThat(link).hasText(taskId);

        JsonNode task = webAdmin.awaitTask(taskId);
        assertThat(task.path("status").asText()).isEqualTo("completed");
        assertThat(task.path("type").asText()).isEqualTo("DeleteUsersDataOfDomainTask");
    }
}
