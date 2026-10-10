import { describe, expect, it } from "vitest";
import {
  invalidRateLimitKeys,
  isValidRateLimitInput,
  normalizeRateLimits,
  parseRateLimitInputs,
  toRateLimitInputs,
  toRateLimitsPayload,
} from "./rate-limits";

describe("isValidRateLimitInput", () => {
  it.each(["", "  ", "-1", "0", "5", " 300 "])("accepts %j", (input) => {
    expect(isValidRateLimitInput(input)).toBe(true);
  });

  it.each(["-5", "-7", "1.5", "-1.5", "1e3", "abc", "--1"])("rejects %j", (input) => {
    expect(isValidRateLimitInput(input)).toBe(false);
  });
});

describe("rate limit inputs", () => {
  const unsetInputs = toRateLimitInputs(normalizeRateLimits(null));

  it("lists the invalid limits", () => {
    const inputs = { ...unsetInputs, mailsSentPerHours: "-5", mailsReceivedPerMinute: "1.5", mailsSentPerDays: "-1" };

    expect(invalidRateLimitKeys(inputs)).toEqual(["mailsSentPerHours", "mailsReceivedPerMinute"]);
  });

  it("round trips limits", () => {
    const limits = normalizeRateLimits({ mailsSentPerMinute: 10, mailsSentPerDays: -1, recipientsSentPerHours: 0 });

    expect(parseRateLimitInputs(toRateLimitInputs(limits))).toEqual(limits);
  });

  it("parses empty inputs as null", () => {
    const limits = parseRateLimitInputs({ ...unsetInputs, mailsSentPerHours: " 42 ", mailsSentPerDays: "  " });

    expect(limits.mailsSentPerHours).toBe(42);
    expect(limits.mailsSentPerDays).toBeNull();
  });
});

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
