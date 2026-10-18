package com.linagora.admin.e2e.calendar.users;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;

import com.linagora.admin.e2e.CalendarAdminE2ETest;
import com.linagora.admin.e2e.backend.CalendarFixtures;
import com.linagora.admin.e2e.docker.Locks;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.calendar.users.CollectionSection;
import com.linagora.admin.e2e.pages.calendar.users.InviteesDialog;
import com.linagora.admin.e2e.pages.calendar.users.UserDetailPage;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;

// Server wide tasks (delete all users data of the domain...) would alter the books of every user.
@ResourceLock(value = Locks.CALENDAR_SERVER_TASKS, mode = ResourceAccessMode.READ)
class UserAddressBookSharingTest extends CalendarAdminE2ETest {
    private static final int ADMINISTRATION = 5;

    @Test
    @DisplayName("UAB-03 Share an address book")
    void shareAddressBook(AdminApp app, CalendarFixtures fixtures) {
        DavSeeds seeds = new DavSeeds(fixtures);
        String alice = seeds.newUser("c3uab03-alice");
        String bob = seeds.newUser("c3uab03-bob");
        UserDetailPage detail = new UserDetailPage(app).open(alice);
        CollectionSection books = detail.addressBooks().expand();
        Locator sharing = CollectionSection.button(books.row("My contacts"), "Sharing");
        InviteesDialog dialog = InviteesDialog.sharing(app);

        sharing.click();
        assertThat(dialog.title()).hasText("Sharing — My contacts");
        dialog.stage(bob, "read");
        dialog.apply("Sharing updated");
        assertThat(seeds.sharedAddressBooks(bob)).hasSize(1);

        sharing.click();
        assertThat(dialog.rightOf(bob)).hasValue("read");
        dialog.type(bob, "Already shared with this user");
        assertThat(dialog.addButton()).isDisabled();
        dialog.cancel();

        detail.open(bob);
        books.expand();
        Locator shared = books.rowOwnedBy("My contacts", alice);
        assertThat(shared).hasCount(1);
        assertThat(shared.getByText("owner:")).isVisible();
        assertThat(books.ownerLink(alice)).hasAttribute("href", UserDetailPage.path(alice));
        assertThat(CollectionSection.counter(shared, "Contacts")).hasText("0");
        assertThat(CollectionSection.button(shared, "Delete address book")).isVisible();
        for (String absent : new String[] {"Export the address book (vCard)", "Import contacts (vCard)", "Edit address book",
            "Sharing", "Private address book", "Public address book (read)"}) {
            assertThat(CollectionSection.button(shared, absent)).hasCount(0);
        }
        assertThat(shared.getByText("System", new Locator.GetByTextOptions().setExact(true))).hasCount(0);

        detail.open(alice);
        books.expand();
        sharing.click();
        dialog.removeButton(bob).click();
        dialog.apply("Sharing updated");

        detail.open(bob);
        books.expand();
        assertThat(books.row("My contacts")).isVisible();
        assertThat(books.rowOwnedBy("My contacts", alice)).hasCount(0);
        assertThat(seeds.sharedAddressBooks(bob)).isEmpty();
    }

    @Test
    @DisplayName("UAB-06 The owner cannot be a sharee of their address book")
    void ownerCannotBeShareeOfOwnAddressBook(AdminApp app, Page page, CalendarFixtures fixtures) {
        DavSeeds seeds = new DavSeeds(fixtures);
        String alice = seeds.newUser("c3uab06");
        AtomicInteger inviteeRequests = new AtomicInteger();
        page.onRequest(request -> {
            if (request.url().contains("/invitee")) {
                inviteeRequests.incrementAndGet();
            }
        });
        CollectionSection books = new UserDetailPage(app).open(alice).addressBooks().expand();
        CollectionSection.button(books.row("My contacts"), "Sharing").click();
        InviteesDialog dialog = InviteesDialog.sharing(app);

        dialog.type(alice, "This is the owner of the address book");
        assertThat(dialog.hint("User exists")).hasCount(0);
        assertThat(dialog.addButton()).isDisabled();
        dialog.email().press("Enter");
        assertThat(dialog.hint("No sharee.")).isVisible();

        dialog.cancel();
        assertThat(inviteeRequests.get()).isZero();
    }

    @Test
    @DisplayName("UAB-07 An Administration share keeps Sharing and visibility for the sharee")
    void administrationShareKeepsSharingAndVisibility(AdminApp app, CalendarFixtures fixtures) {
        DavSeeds seeds = new DavSeeds(fixtures);
        String charlotte = seeds.newUser("c3uab07-charlotte");
        String bob = seeds.newUser("c3uab07-bob");
        seeds.share(charlotte, "contacts", bob, ADMINISTRATION);

        CollectionSection books = new UserDetailPage(app).open(bob).addressBooks().expand();
        Locator shared = books.rowOwnedBy("My contacts", charlotte);
        assertThat(shared).hasCount(1);
        assertThat(shared.getByText("owner:")).isVisible();
        assertThat(CollectionSection.button(shared, "Sharing")).isVisible();
        assertThat(CollectionSection.button(shared, "Private address book")).isVisible();

        CollectionSection.button(shared, "Sharing").click();
        InviteesDialog dialog = InviteesDialog.sharing(app);
        assertThat(dialog.title()).hasText("Sharing — My contacts");
        assertThat(app.toast("Error")).hasCount(0);
        assertThat(app.page().getByText("403")).hasCount(0);
        dialog.cancel();

        // Cleanup, as the plan asks: the share is revoked from the owner
        seeds.share(charlotte, "contacts", bob, 4);
        assertThat(seeds.sharedAddressBooks(bob)).isEmpty();
    }
}
