package com.linagora.admin.e2e.pages.calendar.ops;

/** Quotes text for a regex evaluated by Playwright in the browser: JS knows no {@code \Q...\E}. */
public final class Regex {
    private Regex() {
    }

    public static String quote(String text) {
        return text.replaceAll("[.*+?^${}()|\\[\\]\\\\-]", "\\\\$0");
    }
}
