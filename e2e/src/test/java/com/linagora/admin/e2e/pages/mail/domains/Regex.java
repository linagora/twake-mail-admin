package com.linagora.admin.e2e.pages.mail.domains;

/**
 * Playwright evaluates a {@code Pattern} as a JavaScript regular expression: {@code Pattern.quote}
 * ({@code \Q...\E}) means nothing there. Escapes the special characters one by one instead.
 */
public final class Regex {
    private Regex() {
    }

    public static String quote(String literal) {
        return literal.replaceAll("[\\\\^$.|?*+()\\[\\]{}/-]", "\\\\$0");
    }
}
