package com.linagora.admin.e2e.backend;

import java.security.SecureRandom;

/** Unique, readable names for the data a test creates: the stack is shared, names must not clash. */
public final class Ids {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final char[] ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789".toCharArray();

    private Ids() {
    }

    /** {@code prefix} followed by a random lower case suffix: {@code alice-k3x9q2}. */
    public static String unique(String prefix) {
        return prefix + "-" + suffix(6);
    }

    public static String suffix(int length) {
        StringBuilder builder = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            builder.append(ALPHABET[RANDOM.nextInt(ALPHABET.length)]);
        }
        return builder.toString();
    }

    /** 24 hexadecimal characters, the shape of a MongoDB ObjectId. */
    public static String objectId() {
        StringBuilder builder = new StringBuilder(24);
        for (int i = 0; i < 24; i++) {
            builder.append(Character.forDigit(RANDOM.nextInt(16), 16));
        }
        return builder.toString();
    }
}
