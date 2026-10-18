package com.linagora.admin.e2e.backend;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

import org.awaitility.Awaitility;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * A thin client of a WebAdmin API (tmail-backend or the twake-calendar side service): seeds
 * fixtures before a test and checks outcomes after it. The screen can lie, WebAdmin cannot.
 *
 * <p>Thread safe, shared by the tests of one stack.
 */
public class WebAdmin {
    public static final ObjectMapper JSON = new ObjectMapper();

    public record Response(int status, String body) {
        public JsonNode json() {
            try {
                return JSON.readTree(body);
            } catch (JsonProcessingException e) {
                throw new IllegalStateException("Not JSON: " + body, e);
            }
        }

        public Response expect(int expected) {
            if (status != expected) {
                throw new IllegalStateException("WebAdmin answered " + status + " (expected " + expected + "): " + body);
            }
            return this;
        }
    }

    private static final HttpClient HTTP = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(5))
        .build();

    private final String baseUrl;

    public WebAdmin(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String baseUrl() {
        return baseUrl;
    }

    public static String encode(String segment) {
        return URLEncoder.encode(segment, StandardCharsets.UTF_8).replace("+", "%20");
    }

    public Response get(String path) {
        return send("GET", path, null);
    }

    public Response put(String path) {
        return send("PUT", path, null);
    }

    public Response put(String path, String body) {
        return send("PUT", path, body);
    }

    public Response post(String path, String body) {
        return send("POST", path, body);
    }

    public Response patch(String path, String body) {
        return send("PATCH", path, body);
    }

    public Response delete(String path) {
        return send("DELETE", path, null);
    }

    public Response send(String method, String path, String body) {
        HttpRequest.BodyPublisher publisher = body == null
            ? HttpRequest.BodyPublishers.noBody()
            : HttpRequest.BodyPublishers.ofString(body);
        HttpRequest request = HttpRequest.newBuilder(URI.create(baseUrl + path))
            .timeout(Duration.ofSeconds(60))
            .header("Content-Type", "application/json")
            .method(method, publisher)
            .build();
        try {
            HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
            return new Response(response.statusCode(), response.body());
        } catch (IOException e) {
            throw new IllegalStateException(method + " " + path + " failed", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }

    /** Waits for a task to leave the waiting / inProgress states, returns its final JSON. */
    public JsonNode awaitTask(String taskId) {
        JsonNode[] last = new JsonNode[1];
        // The side service runs one task at a time: under the load of the suite a task may queue
        Awaitility.await().atMost(Duration.ofSeconds(120)).pollInterval(Duration.ofMillis(300))
            .until(() -> {
                last[0] = get("/tasks/" + taskId).json();
                String status = last[0].path("status").asText();
                return !status.equals("waiting") && !status.equals("inProgress");
            });
        return last[0];
    }

    /** Starts a task ({@code taskId} in the response) and waits for it to complete. */
    public JsonNode runTask(String method, String path, String body) {
        Response response = send(method, path, body);
        if (response.status() != 201) {
            throw new IllegalStateException(method + " " + path + " answered " + response.status() + ": " + response.body());
        }
        return awaitTask(response.json().path("taskId").asText());
    }
}
