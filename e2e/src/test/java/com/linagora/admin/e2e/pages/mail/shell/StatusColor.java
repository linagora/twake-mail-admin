package com.linagora.admin.e2e.pages.mail.shell;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The colour family of a computed CSS colour, by hue: the health check cards are green, orange or
 * red. Accepts the {@code oklch(...)} values of tailwind 4 as well as {@code rgb(...)}.
 */
public enum StatusColor {
    GREEN, ORANGE, RED, OTHER;

    private static final Pattern OKLCH = Pattern.compile("oklch\\(([\\d.]+)%?\\s+([\\d.]+)\\s+([\\d.]+)");
    private static final Pattern RGB = Pattern.compile("rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)");

    public static StatusColor of(String css) {
        Matcher oklch = OKLCH.matcher(css);
        if (oklch.find()) {
            double chroma = Double.parseDouble(oklch.group(2));
            double hue = Double.parseDouble(oklch.group(3));
            if (chroma < 0.03) {
                return OTHER;
            }
            if (hue >= 100 && hue <= 180) {
                return GREEN;
            }
            if (hue > 38 && hue < 90) {
                return ORANGE;
            }
            if (hue <= 38 || hue >= 340) {
                return RED;
            }
            return OTHER;
        }
        Matcher rgb = RGB.matcher(css);
        if (rgb.find()) {
            double r = Integer.parseInt(rgb.group(1)) / 255.0;
            double g = Integer.parseInt(rgb.group(2)) / 255.0;
            double b = Integer.parseInt(rgb.group(3)) / 255.0;
            double max = Math.max(r, Math.max(g, b));
            double min = Math.min(r, Math.min(g, b));
            if (max - min < 0.1) {
                return OTHER;
            }
            double hue;
            if (max == r) {
                hue = 60 * (((g - b) / (max - min)) % 6);
            } else if (max == g) {
                hue = 60 * ((b - r) / (max - min) + 2);
            } else {
                hue = 60 * ((r - g) / (max - min) + 4);
            }
            hue = (hue + 360) % 360;
            if (hue >= 80 && hue <= 170) {
                return GREEN;
            }
            if (hue > 15 && hue < 50) {
                return ORANGE;
            }
            if (hue <= 15 || hue >= 340) {
                return RED;
            }
        }
        return OTHER;
    }
}
