package com.linagora.admin.e2e.pages.mail.ops;

/** Regular expressions handed over to the browser: JavaScript knows no {@code \Q...\E}. */
public final class Regex {
    private Regex() {
    }

    public static String quote(String literal) {
        return literal.replaceAll("[.*+?^${}()|\\[\\]\\\\/]", "\\\\$0");
    }
}
