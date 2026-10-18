package com.linagora.admin.e2e.mail.shell;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.regex.Pattern;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.linagora.admin.e2e.MailAdminE2ETest;
import com.linagora.admin.e2e.pages.AdminApp;
import com.linagora.admin.e2e.pages.mail.shell.Shell;
import com.linagora.admin.e2e.pages.mail.shell.WebAdminStub;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

/**
 * The channel list is server wide: "without sessions" is ensured by answering an empty list to this
 * browser, and "Disconnect all" is answered without reaching WebAdmin, so that it does not cut the
 * SMTP / IMAP sessions of the tests running at the same time.
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
}
