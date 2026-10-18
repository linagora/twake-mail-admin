package com.linagora.admin.e2e.docker;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * What the browser complained about during a test: console errors, uncaught exceptions and
 * failed HTTP responses. Inject it to assert that a page behaves cleanly.
 */
public class BrowserLog {
    public record FailedRequest(int status, String method, String url) {
    }

    private final List<String> consoleErrors = new CopyOnWriteArrayList<>();
    private final List<String> pageErrors = new CopyOnWriteArrayList<>();
    private final List<FailedRequest> failedRequests = new CopyOnWriteArrayList<>();

    void recordConsoleError(String text) {
        consoleErrors.add(text);
    }

    void recordPageError(String text) {
        pageErrors.add(text);
    }

    void recordFailedRequest(int status, String method, String url) {
        failedRequests.add(new FailedRequest(status, method, url));
    }

    public List<String> consoleErrors() {
        return List.copyOf(consoleErrors);
    }

    public List<String> pageErrors() {
        return List.copyOf(pageErrors);
    }

    public List<FailedRequest> failedRequests() {
        return List.copyOf(failedRequests);
    }
}
