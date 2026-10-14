import { describe, expect, it } from "vitest";
import { statusStyle } from "./status-style";
import { HealthStatuses } from "./types";

describe("statusStyle", () => {
  it.each(Object.values(HealthStatuses))(
    "pairs a light tint with a dark text for %s cards",
    (status) => {
      const classes = statusStyle(status).split(" ");

      expect(classes.find((c) => c.startsWith("bg-"))).toMatch(/-100$/);
      expect(classes.find((c) => c.startsWith("text-"))).toMatch(/-900$/);
    }
  );

  it("keeps a distinct colour per status", () => {
    const styles = Object.values(HealthStatuses).map(statusStyle);

    expect(new Set(styles).size).toBe(styles.length);
  });
});
