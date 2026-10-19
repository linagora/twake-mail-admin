package com.linagora.admin.e2e.calendar.resources;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;

import com.linagora.admin.e2e.docker.CalendarStack;

/**
 * Whether the calendar of a resource or a team calendar is public: read through Sabre by a user
 * who holds no right of its own on it, impersonated by the Sabre administrator. WebAdmin has no
 * read route for the public right, and the administrator's copy it lists does not reliably show it.
 */
final class PublicReadProbe {
    private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    private final CalendarStack stack;
    private final String reader;

    /** {@code reader}: a registered user, unrelated to the calendars probed. */
    PublicReadProbe(CalendarStack stack, String reader) {
        this.stack = stack;
        this.reader = reader;
    }

    /** {@code /calendars/{id}/{id}}: the calendar of the resource or team calendar {@code id}. */
    boolean isPublic(String id) {
        String auth = Base64.getEncoder().encodeToString(("admin&" + reader + ":secret123").getBytes(StandardCharsets.UTF_8));
        HttpRequest request = HttpRequest.newBuilder(URI.create(stack.davUrl() + "/calendars/" + id + "/" + id + ".json"))
            .timeout(Duration.ofSeconds(30))
            .header("Authorization", "Basic " + auth)
            .header("Accept", "application/json")
            .GET()
            .build();
        int status = send(request).statusCode();
        return switch (status) {
            case 200 -> true;
            case 403 -> false;
            default -> throw new IllegalStateException("Sabre answered " + status + " for " + request.uri());
        };
    }

    private static HttpResponse<String> send(HttpRequest request) {
        try {
            return HTTP.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (IOException e) {
            throw new IllegalStateException(request.method() + " " + request.uri() + " failed", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(request.method() + " " + request.uri() + " interrupted", e);
        }
    }
}
