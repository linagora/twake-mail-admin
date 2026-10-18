import { describe, expect, it } from "vitest";
import { areValidRules, isValidTimeZone, listTimeZones, ruleErrors } from "./booking-link-rules";

const RULE = { type: "weekly", dayOfWeek: "MON", start: "09:00", end: "17:00", timeZone: "Europe/Paris" };

describe("booking link availability rules", () => {
  it("accepts a rule ending after it starts in a known time zone", () => {
    expect(ruleErrors(RULE)).toEqual({ range: false, timeZone: false });
    expect(areValidRules([RULE, { ...RULE, timeZone: "UTC" }])).toBe(true);
  });

  it.each([
    ["12:00", "09:00"],
    ["09:00", "09:00"],
    ["", "17:00"],
  ])("flags a rule from %j to %j", (start, end) => {
    expect(ruleErrors({ ...RULE, start, end }).range).toBe(true);
  });

  it.each(["Mars/Olympus", "", "   "])("flags the time zone %j", (timeZone) => {
    expect(isValidTimeZone(timeZone)).toBe(false);
    expect(areValidRules([RULE, { ...RULE, timeZone }])).toBe(false);
  });

  it("suggests UTC among the known time zones", () => {
    const zones = listTimeZones();
    if (zones.length > 0) expect(zones).toContain("UTC");
  });
});
