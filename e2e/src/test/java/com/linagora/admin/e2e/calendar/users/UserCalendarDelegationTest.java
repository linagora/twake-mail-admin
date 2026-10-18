package com.linagora.admin.e2e.calendar.users;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;

import com.fasterxml.jackson.databind.JsonNode;
import com.linagora.admin.e2e.CalendarAdminE2ETest;
import com.linagora.admin.e2e.backend.CalendarFixtures;
import com.linagora.admin.e2e.backend.Ids;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.docker.Locks;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.calendar.users.CollectionSection;
import com.linagora.admin.e2e.pages.calendar.users.JsRegex;
import com.linagora.admin.e2e.pages.calendar.users.InviteesDialog;
import com.linagora.admin.e2e.pages.calendar.users.UserDetailPage;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;
import com.microsoft.playwright.options.SelectOption;

// Server wide tasks (archival of every user...) add calendars to every user: counts would move.
@ResourceLock(value = Locks.CALENDAR_SERVER_TASKS, mode = ResourceAccessMode.READ)
class UserCalendarDelegationTest extends CalendarAdminE2ETest {

    @Test
    @DisplayName("UCAL-05 Delegate a calendar to another user")
    void delegateCalendarToAnotherUser(AdminApp app, Page page, CalendarFixtures fixtures) {
        DavSeeds seeds = new DavSeeds(fixtures);
        String alice = seeds.newUser("c3ucal05-alice");
        String bob = seeds.newUser("c3ucal05-bob");
        UserDetailPage detail = new UserDetailPage(app).open(alice);
        CollectionSection calendars = detail.calendars().expand();

        CollectionSection.button(calendars.row("#default"), "Delegation (invitees)").click();
        InviteesDialog dialog = InviteesDialog.delegation(app);
        assertThat(dialog.title()).hasText("Delegation (invitees) — #default");
        assertThat(dialog.hint("No invitee.")).isVisible();
        assertThat(dialog.applyButton()).isDisabled();
        dialog.stage(bob, "read-write");
        assertThat(dialog.applyButton()).isEnabled();
        dialog.apply("Invitees updated");

        assertThat(inviteAccess(seeds, alice, bob)).contains(3);

        detail.open(bob);
        calendars.expand();
        Locator delegated = calendars.rowInGroup("Delegated", "#default");
        assertThat(delegated).isVisible();
        Locator owner = delegated.getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName(alice).setExact(true));
        assertThat(delegated.getByText("owner:")).isVisible();
        for (String absent : new String[] {"Export the calendar (ICS)", "Import events (ICS)", "Delegation (invitees)",
            "Private calendar", "Public calendar (read)"}) {
            assertThat(CollectionSection.button(delegated, absent)).hasCount(0);
        }
        owner.click();
        assertThat(page).hasURL(Pattern.compile("/users/user/" + JsRegex.quote(WebAdmin.encode(alice)) + "$"));
        assertThat(detail.usernameLabel()).hasText("Username: " + alice);
    }

    @Test
    @DisplayName("UCAL-06 Change and remove a calendar invitee")
    void changeAndRemoveCalendarInvitee(AdminApp app, CalendarFixtures fixtures) {
        DavSeeds seeds = new DavSeeds(fixtures);
        String alice = seeds.newUser("c3ucal06-alice");
        String bob = seeds.newUser("c3ucal06-bob");
        seeds.delegate(alice, seeds.mainCalendarId(alice), bob, "dav:read-write");
        UserDetailPage detail = new UserDetailPage(app).open(alice);
        CollectionSection calendars = detail.calendars().expand();
        Locator delegation = CollectionSection.button(calendars.row("#default"), "Delegation (invitees)");
        InviteesDialog dialog = InviteesDialog.delegation(app);

        delegation.click();
        assertThat(dialog.rightOf(bob)).hasValue("read-write");
        dialog.type(bob, "Already invited");
        assertThat(dialog.addButton()).isDisabled();
        dialog.type(Ids.unique("c3ucal06-nobody") + "@" + CalendarFixtures.DOMAIN, "User not found");
        assertThat(dialog.addButton()).isDisabled();
        dialog.email().fill("");
        dialog.rightOf(bob).selectOption(new SelectOption().setValue("administration"));
        dialog.apply("Invitees updated");
        assertThat(inviteAccess(seeds, alice, bob)).contains(5);

        delegation.click();
        assertThat(dialog.rightOf(bob)).hasValue("administration");
        dialog.removeButton(bob).click();
        assertThat(dialog.entry(bob).getByText(bob)).hasCSS("text-decoration-line", "line-through");
        assertThat(dialog.rightOf(bob)).isDisabled();
        dialog.undoRemoveButton(bob).click();
        assertThat(dialog.entry(bob).getByText(bob)).not().hasCSS("text-decoration-line", "line-through");
        assertThat(dialog.rightOf(bob)).isEnabled();
        dialog.removeButton(bob).click();
        dialog.apply("Invitees updated");
        assertThat(inviteAccess(seeds, alice, bob)).isEmpty();

        detail.open(bob);
        calendars.expand();
        assertThat(calendars.rowInGroup("Owner", "#default")).isVisible();
        assertThat(calendars.groupHeading("Delegated")).hasCount(0);
    }

    @Test
    @DisplayName("UCAL-10 The owner cannot be invited to their own calendar")
    void ownerCannotBeInvitedToOwnCalendar(AdminApp app, Page page, CalendarFixtures fixtures) {
        DavSeeds seeds = new DavSeeds(fixtures);
        String alice = seeds.newUser("c3ucal10");
        AtomicInteger inviteeRequests = new AtomicInteger();
        page.onRequest(request -> {
            if (request.url().contains("/invitee")) {
                inviteeRequests.incrementAndGet();
            }
        });
        CollectionSection calendars = new UserDetailPage(app).open(alice).calendars().expand();
        CollectionSection.button(calendars.row("#default"), "Delegation (invitees)").click();
        InviteesDialog dialog = InviteesDialog.delegation(app);

        dialog.type(alice, "This is the owner of the calendar");
        assertThat(dialog.hint("User exists")).hasCount(0);
        assertThat(dialog.addButton()).isDisabled();
        dialog.email().press("Enter");
        dialog.type(" " + alice.toUpperCase(), "This is the owner of the calendar");
        assertThat(dialog.addButton()).isDisabled();
        dialog.email().press("Enter");
        assertThat(dialog.hint("No invitee.")).isVisible();
        assertThat(dialog.applyButton()).isDisabled();

        dialog.cancel();
        assertThat(inviteeRequests.get()).isZero();
        assertThat(inviteAccess(seeds, alice, alice)).isEmpty();
    }

    /** The access code of {@code invitee} on the main calendar of {@code owner}, if invited. */
    static Optional<Integer> inviteAccess(DavSeeds seeds, String owner, String invitee) {
        String mainId = seeds.mainCalendarId(owner);
        for (JsonNode calendar : seeds.calendars(owner)) {
            if (DavSeeds.id(calendar).equals(mainId)) {
                for (JsonNode invite : calendar.path("invite")) {
                    if (invite.path("href").asText().equalsIgnoreCase("mailto:" + invitee)) {
                        return Optional.of(invite.path("access").asInt());
                    }
                }
            }
        }
        return Optional.empty();
    }
}
