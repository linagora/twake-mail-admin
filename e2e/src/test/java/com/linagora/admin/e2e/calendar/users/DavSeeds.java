package com.linagora.admin.e2e.calendar.users;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import com.fasterxml.jackson.databind.JsonNode;
import com.linagora.admin.e2e.backend.CalendarFixtures;
import com.linagora.admin.e2e.backend.WebAdmin;

/**
 * Seeds and reads the calendars and address books of the users a test created, through the
 * side-service WebAdmin.
 */
final class DavSeeds {
    private final CalendarFixtures fixtures;
    private final WebAdmin webAdmin;

    DavSeeds(CalendarFixtures fixtures) {
        this.fixtures = fixtures;
        this.webAdmin = fixtures.webAdmin();
    }

    /**
     * A new registered user whose calendars and address books were listed once, one call after
     * the other: the DAV server provisions the default ones on first access, and two concurrent
     * first accesses (the console reads them from several sections) may provision them twice.
     * A user that was never listed may also end up without its own #default once a calendar is
     * delegated to it.
     */
    String newUser(String prefix) {
        String user = fixtures.newRegisteredUser(prefix);
        calendars(user);
        addressBooks(user);
        return user;
    }

    static String encode(String segment) {
        return WebAdmin.encode(segment);
    }

    // Calendars

    List<JsonNode> calendars(String user) {
        JsonNode body = webAdmin.get("/users/" + encode(user) + "/calendars").expect(200).json();
        List<JsonNode> result = new ArrayList<>();
        body.path("_embedded").path("dav:calendar").forEach(result::add);
        return result;
    }

    Optional<JsonNode> calendarNamed(String user, String name) {
        return calendars(user).stream().filter(c -> name.equals(c.path("dav:name").asText())).findFirst();
    }

    static String id(JsonNode collection) {
        String href = collection.path("_links").path("self").path("href").asText();
        String last = href.substring(href.lastIndexOf('/') + 1);
        return last.endsWith(".json") ? last.substring(0, last.length() - ".json".length()) : last;
    }

    /** The id of the user's main calendar, #default. */
    String mainCalendarId(String user) {
        return calendars(user).stream()
            .filter(c -> c.path("calendarserver:delegatedsource").isMissingNode() && c.path("calendarserver:source").isMissingNode())
            .filter(c -> {
                String[] parts = c.path("_links").path("self").path("href").asText().split("/");
                return parts.length == 4 && (parts[3].equals(parts[2] + ".json") || parts[3].equals("events.json"));
            })
            .map(DavSeeds::id)
            .findFirst()
            .orElseThrow(() -> new IllegalStateException(user + " has no main calendar"));
    }

    String createCalendar(String user, String name) {
        return webAdmin.post("/users/" + encode(user) + "/calendars",
            "{\"dav:name\":" + WebAdmin.JSON.valueToTree(name) + "}").expect(201).json().path("id").asText();
    }

    String createCalendar(String user, String name, String color, String description) {
        return webAdmin.post("/users/" + encode(user) + "/calendars",
            "{\"dav:name\":" + WebAdmin.JSON.valueToTree(name) + ",\"apple:color\":" + WebAdmin.JSON.valueToTree(color)
                + ",\"caldav:description\":" + WebAdmin.JSON.valueToTree(description) + "}").expect(201).json().path("id").asText();
    }

    /** Delegates a calendar: {@code right} is "dav:read", "dav:read-write" or "dav:administration". */
    void delegate(String owner, String calendarId, String invitee, String right) {
        webAdmin.post("/users/" + encode(owner) + "/calendars/" + encode(calendarId) + "/invitee",
            "{\"share\":{\"set\":[{\"dav:href\":\"mailto:" + invitee + "\",\"" + right + "\":true}]}}").expect(204);
    }

    // Address books

    List<JsonNode> addressBooks(String user) {
        JsonNode body = webAdmin.get("/users/" + encode(user) + "/addressbooks").expect(200).json();
        List<JsonNode> result = new ArrayList<>();
        body.path("_embedded").path("dav:addressbook").forEach(result::add);
        return result;
    }

    Optional<JsonNode> addressBookNamed(String user, String name) {
        return addressBooks(user).stream().filter(a -> name.equals(a.path("dav:name").asText())).findFirst();
    }

    String createAddressBook(String user, String name) {
        return webAdmin.post("/users/" + encode(user) + "/addressbooks",
            "{\"dav:name\":" + WebAdmin.JSON.valueToTree(name) + "}").expect(201).json().path("id").asText();
    }

    /** Shares an address book: {@code access} 2 read, 3 read/write, 5 administration, 4 revokes. */
    void share(String owner, String addressBookId, String sharee, int access) {
        webAdmin.post("/users/" + encode(owner) + "/addressbooks/" + encode(addressBookId) + "/invitee",
            "{\"dav:sharee\":[{\"dav:href\":\"mailto:" + sharee + "\",\"dav:share-access\":" + access + "}]}").expect(204);
    }

    /** The mirrors of shared address books the user received ("openpaas:source"). */
    List<JsonNode> sharedAddressBooks(String user) {
        return addressBooks(user).stream().filter(a -> a.hasNonNull("openpaas:source")).toList();
    }

    // Content

    /** Imports ICS data into a calendar of the user and waits for the import task to complete. */
    void importEvents(String user, String calendarId, String ics) {
        importInto("/users/" + encode(user) + "/calendars/" + encode(calendarId), ics);
    }

    /** Imports vCard data into an address book of the user and waits for the import task to complete. */
    void importContacts(String user, String addressBookId, String vcards) {
        importInto("/users/" + encode(user) + "/addressbooks/" + encode(addressBookId), vcards);
    }

    private void importInto(String collectionPath, String content) {
        JsonNode task = webAdmin.runTask("POST", collectionPath + "?action=import", content);
        if (!task.path("status").asText().equals("completed")) {
            throw new IllegalStateException("Import into " + collectionPath + " ended " + task);
        }
    }

    int eventCount(String user, String calendarId) {
        return webAdmin.get("/users/" + encode(user) + "/calendars/" + encode(calendarId) + "/eventCount")
            .expect(200).json().path("count").asInt();
    }

    int contactCount(String user, String addressBookId) {
        return webAdmin.get("/users/" + encode(user) + "/addressbooks/" + encode(addressBookId) + "/contactCount")
            .expect(200).json().path("count").asInt();
    }

    static String ics(String uid, String summary) {
        return "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//QA//EN\r\nBEGIN:VEVENT\r\nUID:" + uid
            + "\r\nDTSTAMP:20261016T080000Z\r\nDTSTART:20261020T090000Z\r\nDTEND:20261020T100000Z\r\nSUMMARY:"
            + summary + "\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
    }

    static String vcard(String uid, String fullName, String email) {
        return "BEGIN:VCARD\r\nVERSION:3.0\r\nUID:" + uid + "\r\nFN:" + fullName + "\r\nEMAIL:" + email + "\r\nEND:VCARD\r\n";
    }
}
