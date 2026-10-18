package com.linagora.admin.e2e.pages.calendar.users;

/**
 * Playwright evaluates the {@code Pattern}s of locators and assertions as JavaScript regular
 * expressions, which know no {@code \Q...\E}: {@code Pattern.quote} cannot be used there.
 */
public final class JsRegex {
    private JsRegex() {
    }

    /** {@code text} with every regular expression meta character escaped. */
    public static String quote(String text) {
        return text.replaceAll("[\\\\^$.|?*+()\\[\\]{}/-]", "\\\\$0");
    }
}
