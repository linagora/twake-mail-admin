package com.linagora.admin.e2e.pages.mail.shell;

import java.util.Map;
import java.util.function.Function;
import java.util.function.Predicate;

import com.linagora.admin.e2e.backend.WebAdmin;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Route;

/**
 * Rewrites, for the browser of one test only, the answer of a WebAdmin GET endpoint. For states a
 * shared backend cannot produce on demand (a degraded component, a dead-lettered event: the event
 * bus retries a failing listener for minutes before dead-lettering) without touching what other
 * tests see.
 */
public final class WebAdminStub {
    private WebAdminStub() {
    }

    private static Map<String, String> headers() {
        return Map.of("Content-Type", "application/json", "Access-Control-Allow-Origin", "*");
    }

    /** Answers GET requests whose path matches with {@code body}. */
    public static void answer(Page page, Predicate<String> path, String body) {
        page.route(url -> path.test(java.net.URI.create(url).getRawPath()), route -> {
            if (!route.request().method().equals("GET")) {
                route.fallback();
                return;
            }
            route.fulfill(new Route.FulfillOptions().setStatus(200).setHeaders(headers()).setBody(body));
        });
    }

    /** Lets GET requests whose path matches reach WebAdmin, then rewrites the body of the answer. */
    public static void rewrite(Page page, WebAdmin webAdmin, Predicate<String> path, Function<String, String> rewriter) {
        page.route(url -> path.test(java.net.URI.create(url).getRawPath()), route -> {
            if (!route.request().method().equals("GET")) {
                route.fallback();
                return;
            }
            // Fetched from the test JVM: the browser alone knows how to resolve WebAdmin's host
            java.net.URI uri = java.net.URI.create(route.request().url());
            WebAdmin.Response response = webAdmin.get(uri.getRawPath() + (uri.getRawQuery() == null ? "" : "?" + uri.getRawQuery()));
            route.fulfill(new Route.FulfillOptions().setStatus(response.status()).setHeaders(headers())
                .setBody(rewriter.apply(response.body())));
        });
    }

    /** Answers requests of {@code method} whose path matches with {@code status} and {@code body}, without reaching WebAdmin. */
    public static void answer(Page page, String method, Predicate<String> path, int status, String body) {
        page.route(url -> path.test(java.net.URI.create(url).getRawPath()), route -> {
            if (!route.request().method().equals(method)) {
                route.fallback();
                return;
            }
            route.fulfill(new Route.FulfillOptions().setStatus(status).setHeaders(headers()).setBody(body));
        });
    }
}
