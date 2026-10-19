package com.linagora.admin.e2e.mail.shell;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.regex.Pattern;

import org.awaitility.Awaitility;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.backend.ImapSession;
import com.linagora.admin.e2e.backend.MailFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.docker.MailStack;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.shell.Shell;
import com.linagora.admin.e2e.pages.mail.shell.WebAdminStub;
import com.linagora.admin.e2e.pages.mail.userdetail.MailUserDetailPage;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

/**
 * The channel list is server wide: "without sessions" is ensured by answering an empty list to this
 * browser, and "Disconnect all" is answered without reaching WebAdmin, so that it does not cut the
 * SMTP / IMAP sessions of the tests running at the same time.
 *
 * <p>NC-02 runs on a real IMAP session of its own user, and only ever disconnects that user's
 * channels: no lock is needed.
 */
class NetworkChannelsTest extends MailAdminE2ETest {
    private static final String CHANNELS = "/servers/channels";

    @Test
    @DisplayName("NC-01 Network channels page")
    void networkChannelsPage(AdminApp app, Page page) {
        List<String> listRequests = new CopyOnWriteArrayList<>();
        List<String> deletes = new CopyOnWriteArrayList<>();
        page.onRequest(request -> {
            if (request.url().contains(CHANNELS)) {
                (request.method().equals("DELETE") ? deletes : listRequests).add(request.url());
            }
        });
        WebAdminStub.answer(page, path -> path.equals(CHANNELS), "[]");
        WebAdminStub.answer(page, "DELETE", path -> path.equals(CHANNELS), 204, "");
        // No Internet in the reference environment: the map library cannot load
        page.route("https://unpkg.com/**", route -> route.abort());

        app.open("/");
        app.navigate("Network Channels");
        assertThat(app.heading()).hasText("Network Channels");
        Locator noChannels = app.main().getByText("No active channels.", new Locator.GetByTextOptions().setExact(true));
        assertThat(noChannels).isVisible();

        Locator sort = app.main().getByLabel("Sort by:");
        assertThat(sort.locator("option")).hasText(new String[] {"Username", "Protocol", "User Agent", "Request Count",
            "Written Bytes", "Read Bytes", "Live Read", "Live Write"});
        sort.selectOption("Request Count");
        assertThat(sort).hasValue("requestCount");
        app.button("Asc ↑").click();
        assertThat(app.button("Desc ↓")).isVisible();
        app.main().getByRole(AriaRole.SEARCHBOX).fill("alice");
        assertThat(noChannels).isVisible();
        // The sort is handed over to WebAdmin
        org.awaitility.Awaitility.await().atMost(java.time.Duration.ofSeconds(10))
            .until(() -> listRequests.stream().anyMatch(url -> url.contains("sortDirection=desc") && url.contains("sortBy=")));
        app.button("Desc ↓").click();
        assertThat(app.button("Asc ↑")).isVisible();

        app.button("User agent").click();
        assertThat(page).hasURL(Pattern.compile("/network-channels/user-agent$"));
        assertThat(noChannels).isVisible();
        app.button("Back").click();
        assertThat(page).hasURL(Pattern.compile("/network-channels$"));

        app.button("Map").click();
        assertThat(page).hasURL(Pattern.compile("/network-channels/map$"));
        assertThat(app.main().getByText(Pattern.compile("^(No public IPs to geolocate\\.|Failed to load the map library\\.|Geolocation failed\\.)$")))
            .isVisible();
        app.button("Back").click();
        assertThat(page).hasURL(Pattern.compile("/network-channels$"));

        app.button("Disconnect all").click();
        assertThat(app.dialog()).containsText("Disconnect all user channels on the server? This will close every active connection.");
        app.confirm();
        app.expectToast("All users disconnected successfully");
        assertThat(deletes).hasSize(1);
        assertThat(Shell.unnamedButtons(app.main())).isEmpty();
    }

    @Test
    @DisplayName("NC-02 A live IMAP session: listed, searched, detailed, and closed by the user's Disconnect all")
    void liveSession(AdminApp app, Page page, MailFixtures fixtures, MailStack stack, WebAdmin webAdmin) {
        String user = fixtures.newUser("chan");
        String userChannels = CHANNELS + "/" + WebAdmin.encode(user);
        try (ImapSession imap = ImapSession.login(stack, user, MailFixtures.PASSWORD, "e2e-client")) {
            Awaitility.await().atMost(Duration.ofSeconds(10))
                .until(() -> webAdmin.get(userChannels).expect(200).json().size() == 1);
            JsonNode channel = webAdmin.get(userChannels).expect(200).json().get(0);
            String remoteAddress = channel.get("remoteAddress").asText();

            // The server wide list: a row for the session, with its protocol, address and user agent
            app.open("/network-channels");
            Locator userButton = app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(user).setExact(true));
            Locator usernameButtons = app.main().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(Pattern.compile("@")));
            Locator row = userButton.locator("..");
            assertThat(userButton).isVisible();
            assertThat(row).containsText("IMAP");
            assertThat(row).containsText(remoteAddress);
            assertThat(row).containsText("e2e-client");

            // The search, on username and user agent: other tests may have sessions open
            Locator search = app.main().getByRole(AriaRole.SEARCHBOX);
            search.fill(user.substring(0, user.indexOf('@')));
            assertThat(usernameButtons).hasCount(1);
            assertThat(userButton).isVisible();
            search.fill("E2E-CLIENT");
            assertThat(userButton).isVisible();
            search.fill("no-such-session");
            assertThat(userButton).isHidden();
            search.fill(user);
            assertThat(usernameButtons).hasCount(1);

            // The detail of the session; Escape gives the focus back to the row
            userButton.click();
            assertThat(app.dialog().getByRole(AriaRole.HEADING)).hasText("Channel — " + remoteAddress);
            assertThat(app.dialog()).containsText(user);
            assertThat(app.dialog()).containsText("e2e-client");
            page.keyboard().press("Escape");
            assertThat(app.dialog()).isHidden();
            assertThat(userButton).isFocused();

            // The user page lists this user's session only, and Disconnect all closes it
            MailUserDetailPage detail = new MailUserDetailPage(app).open(user);
            detail.toggle("Network Channels");
            assertThat(userButton).isVisible();
            assertThat(usernameButtons).hasCount(1);
            assertThat(row).containsText("e2e-client");
            detail.button("Disconnect all").click();
            assertThat(app.dialog()).containsText("Disconnect channels for " + user);
            app.confirm();
            app.expectToast(user + " disconnected");
            assertThat(app.main().getByText("No active channels.", new Locator.GetByTextOptions().setExact(true))).isVisible();
            assertThat(userButton).isHidden();

            // The other side: the server did close the session
            assertThat(imap.closedByServer(Duration.ofSeconds(10))).isTrue();
            assertThat(webAdmin.get(userChannels).expect(200).json()).isEmpty();
        }
    }
}
