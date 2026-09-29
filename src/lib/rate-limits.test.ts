import { describe, expect, it } from "vitest";
import { toRateLimitsForm, toRateLimitsPayload } from "./rate-limits";

const legacyResponse = {
  mailsSentPerMinute: 10,
  mailsSentPerHours: 100,
  mailsSentPerDays: 1000,
  mailsReceivedPerMinute: null,
  mailsReceivedPerHours: null,
  mailsReceivedPerDays: null,
};

const recipientsAwareResponse = {
  ...legacyResponse,
  recipientsSentPerMinute: 30,
  recipientsSentPerHours: null,
  recipientsSentPerDays: 3000,
};

describe("toRateLimitsForm", () => {
  it("defaults missing recipient limits to null", () => {
    expect(toRateLimitsForm(legacyResponse)).toEqual({
      ...legacyResponse,
      recipientsSentPerMinute: null,
      recipientsSentPerHours: null,
      recipientsSentPerDays: null,
    });
  });

  it("keeps returned recipient limits", () => {
    expect(toRateLimitsForm(recipientsAwareResponse)).toEqual(recipientsAwareResponse);
  });
});

describe("toRateLimitsPayload", () => {
  it("omits unset recipient limits the backend did not return", () => {
    const payload = toRateLimitsPayload(toRateLimitsForm(legacyResponse), new Set(Object.keys(legacyResponse)));
    expect(payload).toEqual(legacyResponse);
  });

  it("sends recipient limits set by the administrator", () => {
    const form = { ...toRateLimitsForm(legacyResponse), recipientsSentPerHours: 300 };
    const payload = toRateLimitsPayload(form, new Set(Object.keys(legacyResponse)));
    expect(payload).toEqual({ ...legacyResponse, recipientsSentPerHours: 300 });
  });

  it("sends returned recipient limits, including cleared ones as null", () => {
    const form = { ...toRateLimitsForm(recipientsAwareResponse), recipientsSentPerMinute: null };
    const payload = toRateLimitsPayload(form, new Set(Object.keys(recipientsAwareResponse)));
    expect(payload).toEqual({ ...recipientsAwareResponse, recipientsSentPerMinute: null });
  });
});
