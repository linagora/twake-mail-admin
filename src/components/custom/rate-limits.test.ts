import { describe, expect, it } from "vitest";
import { normalizeRateLimits, toRateLimitsPayload } from "./rate-limits";

describe("normalizeRateLimits", () => {
  it("fills limits missing from the response with null", () => {
    const limits = normalizeRateLimits({ mailsSentPerMinute: 10 });

    expect(limits.mailsSentPerMinute).toBe(10);
    expect(limits.recipientsSentPerDays).toBeNull();
    expect(Object.keys(limits)).toHaveLength(9);
  });
});

describe("toRateLimitsPayload", () => {
  const unset = normalizeRateLimits(null);

  it("always sends mail limits, even unset", () => {
    const payload = toRateLimitsPayload({ ...unset, mailsSentPerMinute: 5 }, unset);

    expect(payload).toEqual({
      mailsSentPerMinute: 5,
      mailsSentPerHours: null,
      mailsSentPerDays: null,
      mailsReceivedPerMinute: null,
      mailsReceivedPerHours: null,
      mailsReceivedPerDays: null,
    });
  });

  it("sends recipient limits that are set", () => {
    const payload = toRateLimitsPayload({ ...unset, recipientsSentPerHours: 300, recipientsSentPerDays: -1 }, unset);

    expect(payload.recipientsSentPerHours).toBe(300);
    expect(payload.recipientsSentPerDays).toBe(-1);
    expect(payload).not.toHaveProperty("recipientsSentPerMinute");
  });

  it("sends null to unset a previously set recipient limit", () => {
    const payload = toRateLimitsPayload(unset, { ...unset, recipientsSentPerMinute: 30 });

    expect(payload).toHaveProperty("recipientsSentPerMinute", null);
    expect(payload).not.toHaveProperty("recipientsSentPerHours");
  });
});
