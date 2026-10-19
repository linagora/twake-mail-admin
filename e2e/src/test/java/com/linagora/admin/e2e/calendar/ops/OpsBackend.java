package com.linagora.admin.e2e.calendar.ops;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.stream.StreamSupport;

import org.awaitility.Awaitility;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.linagora.admin.e2e.backend.Ids;
import com.linagora.admin.e2e.backend.WebAdmin;
import com.linagora.admin.e2e.docker.CalendarStack;

/**
 * Seeding and checks of the "ops" area (booking links, tasks, unsent mails) on the Calendar stack,
 * through the WebAdmin of the side service, Sabre (CalDAV) and the REST API of the mock SMTP server.
 */
final class OpsBackend {
    private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    private final WebAdmin webAdmin;
    private final CalendarStack stack;

    OpsBackend(WebAdmin webAdmin, CalendarStack stack) {
        this.webAdmin = webAdmin;
        this.stack = stack;
    }

    WebAdmin webAdmin() {
        return webAdmin;
    }

    // ---------------------------------------------------------------- calendars

    JsonNode calendars(String user) {
        return webAdmin.get("/users/" + user + "/calendars").expect(200).json().path("_embedded").path("dav:calendar");
    }

    /** {@code /calendars/<userId>/<userId>}: the main calendar, as the booking links API wants it. */
    String defaultCalendarUrl(String user) {
        for (JsonNode calendar : calendars(user)) {
            String href = calendarUrl(calendar);
            String[] parts = href.split("/");
            if (parts.length == 4 && parts[2].equals(parts[3])) {
                return href;
            }
        }
        throw new IllegalStateException("No main calendar for " + user + ": " + calendars(user));
    }

    static String calendarUrl(JsonNode calendar) {
        return calendar.path("_links").path("self").path("href").asText().replaceAll("\\.json$", "");
    }

    static String lastSegment(String url) {
        return url.substring(url.lastIndexOf('/') + 1);
    }

    String createCalendar(String user, String name) {
        return webAdmin.post("/users/" + user + "/calendars", "{\"dav:name\":\"" + name + "\"}").expect(201).json().path("id").asText();
    }

    /** Shares a calendar of {@code owner} with {@code sharee}: right is dav:read, dav:read-write or dav:administration. */
    void share(String owner, String calendarId, String sharee, String right) {
        webAdmin.post("/users/" + owner + "/calendars/" + calendarId + "/invitee",
            "{\"share\":{\"set\":[{\"dav:href\":\"mailto:" + sharee + "\",\"" + right + "\":true}]}}").expect(204);
    }

    /** A resource of open-paas.org administered by {@code admin}; returns its id. */
    String createResource(String name, String admin) {
        webAdmin.post("/domains/open-paas.org/resources", "{\"name\":\"" + name + "\",\"description\":\"e2e\",\"icon\":\"laptop\",\"creator\":\""
            + admin + "\",\"administrators\":[{\"email\":\"" + admin + "\"}]}").expect(201);
        for (JsonNode resource : webAdmin.get("/domains/open-paas.org/resources").expect(200).json()) {
            if (resource.path("name").asText().equals(name)) {
                return resource.path("id").asText();
            }
        }
        throw new IllegalStateException("Resource " + name + " not listed");
    }

    void deleteResource(String id) {
        webAdmin.delete("/domains/open-paas.org/resources/" + id);
    }

    /** Imports raw VEVENT blocks into a calendar of the user, returns the task id. */
    String importEvents(String user, String calendarId, String... vevents) {
        StringBuilder ics = new StringBuilder("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//QA//EN\r\n");
        for (String vevent : vevents) {
            ics.append(vevent);
        }
        ics.append("END:VCALENDAR\r\n");
        HttpRequest request = HttpRequest.newBuilder(URI.create(webAdmin.baseUrl() + "/users/" + user + "/calendars/" + calendarId + "?action=import"))
            .timeout(Duration.ofSeconds(30))
            .header("Content-Type", "text/calendar")
            .POST(HttpRequest.BodyPublishers.ofString(ics.toString()))
            .build();
        HttpResponse<String> response = send(request);
        if (response.statusCode() != 201) {
            throw new IllegalStateException("Import answered " + response.statusCode() + ": " + response.body());
        }
        return parse(response.body()).path("taskId").asText();
    }

    static String event(String summary) {
        return "BEGIN:VEVENT\r\nUID:" + Ids.unique("evt") + "\r\nDTSTAMP:20261016T080000Z\r\nDTSTART:20261120T090000Z\r\n"
            + "DTEND:20261120T100000Z\r\nSUMMARY:" + summary + "\r\nEND:VEVENT\r\n";
    }

    /** {@code count} events, for an import that makes a slow reindexing last. */
    static String[] events(int count) {
        String[] events = new String[count];
        for (int i = 0; i < count; i++) {
            events[i] = event("load " + i);
        }
        return events;
    }

    /** An event Sabre refuses (no DTSTART): its import task ends up failed. */
    static String brokenEvent() {
        return "BEGIN:VEVENT\r\nUID:" + Ids.unique("broken") + "\r\nDTSTAMP:20261016T080000Z\r\nSUMMARY:no start\r\nEND:VEVENT\r\n";
    }

    // ---------------------------------------------------------------- booking links

    String createBookingLink(String user, String json) {
        return webAdmin.post("/users/" + user + "/booking-links", json).expect(201).json().path("bookingLinkPublicId").asText();
    }

    /** A link on the main calendar: 45 minutes, active, auto-accept, one MON 09:00-12:00 Europe/Paris rule. */
    String createIntroCall(String user, String name) {
        return createBookingLink(user, "{\"calendarUrl\":\"" + defaultCalendarUrl(user) + "\",\"durationMinutes\":45,\"active\":true,"
            + "\"autoAccept\":true,\"name\":\"" + name + "\",\"description\":\"A first contact\",\"color\":\"#00aa88\","
            + "\"availabilityRules\":[{\"type\":\"weekly\",\"dayOfWeek\":\"MON\",\"start\":\"09:00\",\"end\":\"12:00\",\"timeZone\":\"Europe/Paris\"}]}");
    }

    JsonNode bookingLinks(String user) {
        return webAdmin.get("/users/" + user + "/booking-links").expect(200).json();
    }

    JsonNode bookingLink(String user, String publicId) {
        for (JsonNode link : bookingLinks(user)) {
            if (link.path("publicId").asText().equals(publicId)) {
                return link;
            }
        }
        return null;
    }

    // ---------------------------------------------------------------- registered users

    JsonNode registeredUser(String email) {
        for (JsonNode user : webAdmin.get("/registeredUsers").expect(200).json()) {
            if (user.path("email").asText().equalsIgnoreCase(email)) {
                return user;
            }
        }
        return null;
    }

    // ---------------------------------------------------------------- tasks

    /** The tasks of WebAdmin whose JSON mentions {@code needle} (a username of the test). */
    List<JsonNode> tasksMentioning(String needle) {
        JsonNode tasks = webAdmin.get("/tasks").expect(200).json();
        return StreamSupport.stream(tasks.spliterator(), false)
            .filter(task -> task.toString().contains(needle))
            .toList();
    }

    // ---------------------------------------------------------------- unsent mails

    /**
     * Makes the mock SMTP server refuse every recipient containing {@code marker}, keeping the
     * behaviours already configured: an invitation sent to such a recipient is retained by the
     * side service as an unsent mail.
     */
    void rejectRecipients(String marker) {
        ArrayNode behaviors = (ArrayNode) smtpBehaviors();
        ObjectNode behavior = behaviors.addObject();
        behavior.put("command", "RCPT TO");
        behavior.putObject("condition").put("operator", "contains").put("matchingValue", marker);
        behavior.putObject("response").put("code", 501).put("message", "Bad recipient " + marker);
        putSmtpBehaviors(behaviors);
    }

    /** Removes the refusals of {@code marker} only. */
    void acceptRecipients(String marker) {
        ArrayNode kept = WebAdmin.JSON.createArrayNode();
        for (JsonNode behavior : smtpBehaviors()) {
            if (!behavior.path("condition").path("matchingValue").asText().equals(marker)) {
                kept.add(behavior);
            }
        }
        putSmtpBehaviors(kept);
    }

    private JsonNode smtpBehaviors() {
        HttpResponse<String> response = send(HttpRequest.newBuilder(URI.create(stack.mockSmtpUrl() + "/smtpBehaviors")).GET().build());
        JsonNode json = parse(response.body());
        return json.isArray() ? json : WebAdmin.JSON.createArrayNode();
    }

    private void putSmtpBehaviors(JsonNode behaviors) {
        HttpResponse<String> response = send(HttpRequest.newBuilder(URI.create(stack.mockSmtpUrl() + "/smtpBehaviors"))
            .header("Content-Type", "application/json")
            .PUT(HttpRequest.BodyPublishers.ofString(behaviors.toString()))
            .build());
        if (response.statusCode() / 100 != 2) {
            throw new IllegalStateException("mock-smtp answered " + response.statusCode() + ": " + response.body());
        }
    }

    /**
     * Puts, through Sabre, an event organized by {@code organizer} that invites {@code attendees}:
     * the side service sends them an invitation by mail (iMIP).
     */
    void invite(String organizer, String... attendees) {
        String calendarUrl = defaultCalendarUrl(organizer);
        String uid = Ids.unique("invite");
        StringBuilder ics = new StringBuilder("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//QA//EN\r\nBEGIN:VEVENT\r\nUID:" + uid
            + "\r\nDTSTAMP:20261016T080000Z\r\nDTSTART:20261120T090000Z\r\nDTEND:20261120T100000Z\r\nSUMMARY:Unsent " + uid
            + "\r\nORGANIZER:mailto:" + organizer + "\r\nATTENDEE;PARTSTAT=ACCEPTED:mailto:" + organizer + "\r\n");
        for (String attendee : attendees) {
            ics.append("ATTENDEE;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:").append(attendee).append("\r\n");
        }
        ics.append("END:VEVENT\r\nEND:VCALENDAR\r\n");
        String auth = Base64.getEncoder().encodeToString(("admin&" + organizer + ":secret123").getBytes(StandardCharsets.UTF_8));
        HttpResponse<String> response = send(HttpRequest.newBuilder(URI.create(stack.davUrl() + calendarUrl + "/" + uid + ".ics"))
            .timeout(Duration.ofSeconds(30))
            .header("Authorization", "Basic " + auth)
            .header("Content-Type", "text/calendar; charset=utf-8")
            .PUT(HttpRequest.BodyPublishers.ofString(ics.toString()))
            .build());
        if (response.statusCode() != 201 && response.statusCode() != 204) {
            throw new IllegalStateException("Sabre answered " + response.statusCode() + ": " + response.body());
        }
    }

    /** Ids of the unsent mails sent by {@code sender}. */
    List<String> unsentMailIds(String sender) {
        List<String> ids = new ArrayList<>();
        for (JsonNode mail : webAdmin.get("/unsentMails?sender=" + WebAdmin.encode(sender)).expect(200).json()) {
            ids.add(mail.path("id").asText());
        }
        return ids;
    }

    /** Waits for {@code count} unsent mails of {@code sender}, returns their ids. */
    List<String> awaitUnsentMails(String sender, int count) {
        List<String>[] ids = new List[1];
        Awaitility.await().atMost(Duration.ofSeconds(30)).pollInterval(Duration.ofMillis(300))
            .until(() -> (ids[0] = unsentMailIds(sender)).size() >= count);
        return ids[0];
    }

    JsonNode unsentMail(String id) {
        return webAdmin.get("/unsentMails/" + id).expect(200).json();
    }

    /** Deletes the unsent mails of {@code sender}: the leftovers of the test. */
    void deleteUnsentMails(String sender) {
        for (String id : unsentMailIds(sender)) {
            webAdmin.delete("/unsentMails/" + id);
        }
    }

    private static JsonNode parse(String body) {
        try {
            return WebAdmin.JSON.readTree(body);
        } catch (IOException e) {
            throw new IllegalStateException("Not JSON: " + body, e);
        }
    }

    private static HttpResponse<String> send(HttpRequest request) {
        try {
            return HTTP.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (IOException e) {
            throw new IllegalStateException(request.method() + " " + request.uri() + " failed", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }
}
