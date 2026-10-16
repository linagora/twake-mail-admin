import { describe, expect, it } from "vitest";
import { isValidDurationMinutes, parseDurationMinutes } from "./booking-link-duration";

describe("parseDurationMinutes", () => {
  it("accepts a positive whole number of minutes", () => {
    expect(parseDurationMinutes("45")).toBe(45);
    expect(parseDurationMinutes("1")).toBe(1);
    expect(parseDurationMinutes(" 30 ")).toBe(30);
  });

  it("rejects an empty field instead of turning it into 1", () => {
    expect(parseDurationMinutes("")).toBeNull();
    expect(parseDurationMinutes("   ")).toBeNull();
  });

  it("rejects zero and negative values", () => {
    expect(parseDurationMinutes("0")).toBeNull();
    expect(parseDurationMinutes("-5")).toBeNull();
  });

  it("rejects decimals and non numeric text", () => {
    expect(parseDurationMinutes("1.5")).toBeNull();
    expect(parseDurationMinutes("1e2")).toBeNull();
    expect(parseDurationMinutes("abc")).toBeNull();
  });

  it("rejects numbers too large to be represented exactly", () => {
    expect(parseDurationMinutes("99999999999999999999")).toBeNull();
  });
});

describe("isValidDurationMinutes", () => {
  it("tells whether the raw text is a valid duration", () => {
    expect(isValidDurationMinutes("45")).toBe(true);
    expect(isValidDurationMinutes("")).toBe(false);
    expect(isValidDurationMinutes("-5")).toBe(false);
  });
});
