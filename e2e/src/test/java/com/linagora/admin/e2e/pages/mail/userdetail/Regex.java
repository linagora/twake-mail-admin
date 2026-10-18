package com.linagora.admin.e2e.pages.mail.userdetail;

/** Regex helpers for Playwright: patterns go to the browser as JavaScript regexes, which know no \Q...\E. */
public final class Regex {
    private Regex() {
    }

    /** {@code text} with every regex metacharacter escaped, valid in Java and JavaScript. */
    public static String escape(String text) {
        return text.replaceAll("[.*+?^${}()|\\[\\]\\\\/-]", "\\\\$0");
    }
}
