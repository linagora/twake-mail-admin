package com.linagora.admin.e2e.calendar.resources;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.Predicate;
import java.util.stream.StreamSupport;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.linagora.admin.e2e.backend.CalendarFixtures;
import com.linagora.admin.e2e.backend.Ids;
import com.linagora.admin.e2e.backend.WebAdmin;

/**
 * Resources and team calendars of {@code open-paas.org} through the side service WebAdmin. The
 * domain is shared by every test: everything is looked up by the unique name the test gave it,
 * and what a test creates is deleted afterwards ({@link #cleanUp()}).
 */
class DomainCalendarsBackend {
    static final String DOMAIN = CalendarFixtures.DOMAIN;
    private static final String RESOURCES = "/domains/" + DOMAIN + "/resources";
    private static final String TEAM_CALENDARS = "/domains/" + DOMAIN + "/team-calendars";

    private final WebAdmin webAdmin;
    private final List<String> resources = new ArrayList<>();
    private final List<String> teamCalendars = new ArrayList<>();

    DomainCalendarsBackend(WebAdmin webAdmin) {
        this.webAdmin = webAdmin;
    }

    // --- resources

    /** Creates a resource; {@code name} may be null (WebAdmin accepts it, the console does not). Returns its id. */
    String createResource(String name, String description, String icon, String creator, String... administrators) {
        ObjectNode body = WebAdmin.JSON.createObjectNode();
        if (name != null) {
            body.put("name", name);
        }
        body.put("description", description);
        body.put("icon", icon);
        body.put("creator", creator);
        ArrayNode admins = body.putArray("administrators");
        for (String administrator : administrators) {
            admins.addObject().put("email", administrator);
        }
        webAdmin.post(RESOURCES, body.toString()).expect(201);
        // The creation answers no body: find it back by its unique description.
        String id = activeResource(r -> description.equals(r.path("description").asText()))
            .orElseThrow(() -> new IllegalStateException("Resource " + description + " not listed"))
            .path("id").asText();
        resources.add(id);
        return id;
    }

    List<JsonNode> resources() {
        return StreamSupport.stream(get(RESOURCES).spliterator(), false).toList();
    }

    private JsonNode get(String path) {
        return webAdmin.get(path).expect(200).json();
    }

    Optional<JsonNode> activeResource(Predicate<JsonNode> predicate) {
        return resources().stream()
            .filter(r -> !r.path("deleted").asBoolean(false))
            .filter(predicate)
            .findFirst();
    }

    Optional<JsonNode> activeResourceNamed(String name) {
        return activeResource(r -> name.equals(r.path("name").asText()));
    }

    /** Whether WebAdmin lists the resource as alive (deleted resources stay listed with deleted: true). */
    boolean isActive(String id) {
        return activeResource(r -> id.equals(r.path("id").asText())).isPresent();
    }

    JsonNode resource(String id) {
        return get(RESOURCES + "/" + id);
    }

    /** Remembers a resource the UI created, for {@link #cleanUp()}. */
    void track(String resourceId) {
        resources.add(resourceId);
    }

    static List<String> administrators(JsonNode resource) {
        return StreamSupport.stream(resource.path("administrators").spliterator(), false)
            .map(a -> a.path("email").asText())
            .toList();
    }

    // --- team calendars

    String createTeamCalendar(String name, String displayName) {
        ObjectNode body = WebAdmin.JSON.createObjectNode().put("name", name).put("displayName", displayName);
        String id = webAdmin.post(TEAM_CALENDARS, body.toString()).expect(201).json().path("id").asText();
        teamCalendars.add(id);
        return id;
    }

    List<JsonNode> teamCalendars() {
        return StreamSupport.stream(get(TEAM_CALENDARS).spliterator(), false).toList();
    }

    Optional<JsonNode> teamCalendarNamed(String name) {
        return teamCalendars().stream().filter(t -> name.equals(t.path("name").asText())).findFirst();
    }

    Optional<JsonNode> teamCalendar(String id) {
        return teamCalendars().stream().filter(t -> id.equals(t.path("id").asText())).findFirst();
    }

    void trackTeamCalendar(String id) {
        teamCalendars.add(id);
    }

    /** {@code [{username, role, davRight}]}. */
    JsonNode members(String teamCalendarId) {
        return get(TEAM_CALENDARS + "/" + teamCalendarId + "/members");
    }

    // --- content

    long eventCount(String collection, String id) {
        return get("/domains/" + DOMAIN + "/" + collection + "/" + id + "/eventCount")
            .path("count").asLong();
    }

    /** A one event calendar, with a unique UID. */
    static String ics(String uid) {
        return "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//QA//EN\r\nBEGIN:VEVENT\r\nUID:" + uid
            + "\r\nDTSTAMP:20261016T080000Z\r\nDTSTART:20261020T090000Z\r\nDTEND:20261020T100000Z\r\n"
            + "SUMMARY:QA event\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
    }

    static String uid() {
        return Ids.unique("qa-event") + "@e2e.test";
    }

    /** Deletes what the test created (best effort: the UI may already have deleted it). */
    void cleanUp() {
        resources.forEach(id -> webAdmin.delete(RESOURCES + "/" + id));
        teamCalendars.forEach(id -> webAdmin.delete(TEAM_CALENDARS + "/" + id));
    }
}
