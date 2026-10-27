package com.linagora.admin.e2e.calendar.users;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;

import com.fasterxml.jackson.databind.JsonNode;
import com.linagora.admin.e2e.CalendarAdminE2ETest;
import com.linagora.admin.e2e.backend.CalendarFixtures;
import com.linagora.admin.e2e.backend.Ids;
import com.linagora.admin.e2e.docker.Locks;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.calendar.users.CollectionForm;
import com.linagora.admin.e2e.pages.calendar.users.CollectionSection;
import com.linagora.admin.e2e.pages.calendar.users.UserDetailPage;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.assertions.LocatorAssertions;
import com.microsoft.playwright.options.AriaRole;

// Server wide tasks (delete all users data of the domain...) would alter the books of every user.
@ResourceLock(value = Locks.CALENDAR_SERVER_TASKS, mode = ResourceAccessMode.READ)
class UserAddressBooksTest extends CalendarAdminE2ETest {
    static final String SYSTEM_HINT = "Created by the server for every user: it can be neither renamed nor deleted.";

    @Test
    @DisplayName("UAB-01 Create, edit and delete an address book")
    void createEditAndDeleteAddressBook(AdminApp app, CalendarFixtures fixtures) {
        DavSeeds seeds = new DavSeeds(fixtures);
        String user = seeds.newUser("c3uab01");
        CollectionSection books = new UserDetailPage(app).open(user).addressBooks().expand();
        books.expectCount(2);
        CollectionForm form = new CollectionForm(app);

        books.createButton().click();
        assertThat(form.title()).hasText("Create address book");
        assertThat(form.dialog().getByRole(AriaRole.TEXTBOX, new Locator.GetByRoleOptions().setName("Name *").setExact(true))).isVisible();
        assertThat(form.description()).isVisible();
        assertThat(form.createButton()).isDisabled();
        form.name().fill("QA AB");
        form.description().fill("QA");
        form.createButton().click();

        app.expectToast("Address book created");
        assertThat(form.dialog()).isHidden();
        books.expectCount(3);
        Locator row = books.row("QA AB");
        assertThat(row.getByText("QA", new Locator.GetByTextOptions().setExact(true))).isVisible();
        assertThat(CollectionSection.button(row, "Edit address book")).isVisible();
        assertThat(CollectionSection.button(row, "Delete address book")).isVisible();
        assertThat(row.getByText("System", new Locator.GetByTextOptions().setExact(true))).hasCount(0);
        JsonNode created = seeds.addressBookNamed(user, "QA AB").orElseThrow();
        assertThat(created.path("carddav:description").asText()).isEqualTo("QA");

        CollectionSection.button(row, "Edit address book").click();
        assertThat(form.title()).hasText("Edit address book — QA AB");
        assertThat(form.name()).hasValue("QA AB");
        form.name().fill("QA AB 2");
        form.saveButton().click();

        app.expectToast("Address book updated");
        assertThat(form.dialog()).isHidden();
        assertThat(books.row("QA AB 2")).isVisible();
        assertThat(books.rows("QA AB")).hasCount(0);
        books.expectCount(3);
        assertThat(seeds.addressBookNamed(user, "QA AB 2")).isPresent();
        assertThat(seeds.addressBookNamed(user, "QA AB")).isEmpty();

        CollectionSection.button(books.row("QA AB 2"), "Delete address book").click();
        assertThat(app.dialog().getByText("Do you really want to delete the address book \"QA AB 2\"?")).isVisible();
        CollectionSection.confirmWith(app, "Delete");

        app.expectToast("Address book deleted");
        assertThat(books.rows("QA AB 2")).hasCount(0);
        books.expectCount(2);
        assertThat(seeds.addressBookNamed(user, "QA AB 2")).isEmpty();
        assertThat(seeds.addressBooks(user)).hasSize(2);
    }

    @Test
    @DisplayName("UAB-02 Import, count and export contacts")
    void importCountAndExportContacts(AdminApp app, CalendarFixtures fixtures) {
        DavSeeds seeds = new DavSeeds(fixtures);
        String user = seeds.newUser("c3uab02");
        CollectionSection books = new UserDetailPage(app).open(user).addressBooks().expand();
        Locator row = books.row("My contacts");
        Locator counter = CollectionSection.counter(row, "Contacts");
        assertThat(counter).hasText("0");

        String uid = Ids.unique("c3uab02-contact");
        String taskId = books.importFile(row, "contacts.vcf", "text/vcard",
            DavSeeds.vcard(uid, "QA Contact", "qa.contact@example.com"));
        assertThat(fixtures.webAdmin().awaitTask(taskId).path("status").asText()).isEqualTo("completed");
        assertThat(counter).hasText("1", new LocatorAssertions.HasTextOptions().setTimeout(30_000));

        CollectionSection.Exported exported = books.export(CollectionSection.button(row, "Export the address book (vCard)"));
        assertThat(exported.fileName()).isEqualTo("My_contacts.vcf");
        assertThat(exported.content()).contains("UID:" + uid).contains("FN:QA Contact");
    }

    @Test
    @DisplayName("UAB-04 Address book public visibility")
    void addressBookPublicVisibility(AdminApp app, CalendarFixtures fixtures) {
        DavSeeds seeds = new DavSeeds(fixtures);
        String user = seeds.newUser("c3uab04");
        CollectionSection books = new UserDetailPage(app).open(user).addressBooks().expand();
        Locator row = books.row("Collected contacts");
        Locator dialog = app.dialog();

        CollectionSection.button(row, "Private address book").click();
        assertThat(dialog.getByRole(AriaRole.HEADING)).hasText("Public visibility — Collected contacts");
        assertThat(radio(dialog, "Private")).isChecked();
        radio(dialog, "Public").check();
        CollectionSection.button(dialog, "Save").click();
        app.expectToast("Visibility updated");
        assertThat(dialog).isHidden();
        assertThat(CollectionSection.button(row, "Public address book (read)")).isVisible();
        assertThat(UserCalendarsTest.isPublic(collected(seeds, user))).isTrue();

        CollectionSection.button(row, "Public address book (read)").click();
        assertThat(radio(dialog, "Public")).isChecked();
        radio(dialog, "Private").check();
        CollectionSection.button(dialog, "Save").click();
        app.expectToast("Visibility updated");
        assertThat(dialog).isHidden();
        assertThat(CollectionSection.button(row, "Private address book")).isVisible();
        assertThat(UserCalendarsTest.isPublic(collected(seeds, user))).isFalse();
    }

    @Test
    @DisplayName("UAB-05 System address books are labelled and protected")
    void systemAddressBooksAreLabelledAndProtected(AdminApp app, CalendarFixtures fixtures) {
        DavSeeds seeds = new DavSeeds(fixtures);
        String user = seeds.newUser("c3uab05");
        CollectionSection books = new UserDetailPage(app).open(user).addressBooks().expand();

        for (String system : new String[] {"Collected contacts", "My contacts"}) {
            Locator row = books.row(system);
            Locator badge = row.getByText("System", new Locator.GetByTextOptions().setExact(true));
            assertThat(badge).hasAccessibleDescription(SYSTEM_HINT);
            badge.hover();
            assertThat(app.page().getByRole(AriaRole.TOOLTIP)).hasText(SYSTEM_HINT);
            // A Radix tooltip stays open when the pointer jumps straight to the next badge
            app.page().keyboard().press("Escape");
            assertThat(app.page().getByRole(AriaRole.TOOLTIP)).hasCount(0);
            for (String present : new String[] {"Export the address book (vCard)", "Import contacts (vCard)", "Sharing",
                "Private address book"}) {
                assertThat(CollectionSection.button(row, present)).isVisible();
            }
            assertThat(CollectionSection.button(row, "Edit address book")).hasCount(0);
            assertThat(CollectionSection.button(row, "Delete address book")).hasCount(0);
        }

        books.createButton().click();
        CollectionForm form = new CollectionForm(app);
        form.name().fill("contacts");
        form.createButton().click();
        app.expectToast("Address book created");
        books.expectCount(3);
        Locator custom = books.row("contacts");
        assertThat(custom.getByText("System", new Locator.GetByTextOptions().setExact(true))).hasCount(0);
        assertThat(CollectionSection.button(custom, "Edit address book")).isVisible();
        CollectionSection.button(custom, "Delete address book").click();
        CollectionSection.confirmWith(app, "Delete");

        app.expectToast("Address book deleted");
        books.expectCount(2);
        assertThat(books.rows("contacts")).hasCount(0);
        assertThat(books.rows("My contacts")).hasCount(1);
        assertThat(books.rows("Collected contacts")).hasCount(1);
        assertThat(seeds.addressBooks(user)).hasSize(2);
    }

    private static JsonNode collected(DavSeeds seeds, String user) {
        return seeds.addressBooks(user).stream().filter(a -> DavSeeds.id(a).equals("collected")).findFirst().orElseThrow();
    }

    private static Locator radio(Locator dialog, String label) {
        return dialog.getByRole(AriaRole.RADIO, new Locator.GetByRoleOptions().setName(java.util.regex.Pattern.compile("^" + label)));
    }
}
