import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { datetimeLocalToIso, isoToDatetimeLocal } from "./datetime-local";

describe("datetime-local conversions (Europe/Paris)", () => {
  const originalTz = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = "Europe/Paris";
  });

  afterAll(() => {
    process.env.TZ = originalTz;
  });

  it("displays a UTC instant as local wall-clock time", () => {
    expect(isoToDatetimeLocal("2026-10-10T06:00:00Z")).toBe("2026-10-10T08:00");
  });

  it("converts a local wall-clock time to a UTC instant", () => {
    expect(datetimeLocalToIso("2026-10-20T18:00")).toBe("2026-10-20T16:00:00.000Z");
  });

  it("round-trips the value entered by the operator", () => {
    expect(isoToDatetimeLocal(datetimeLocalToIso("2026-10-11T09:30"))).toBe("2026-10-11T09:30");
  });

  it("handles the winter offset", () => {
    expect(isoToDatetimeLocal("2026-12-24T23:30:00Z")).toBe("2026-12-25T00:30");
  });

  it("returns an empty string for empty or invalid values", () => {
    expect(isoToDatetimeLocal("")).toBe("");
    expect(isoToDatetimeLocal(undefined)).toBe("");
    expect(isoToDatetimeLocal("not a date")).toBe("");
    expect(datetimeLocalToIso("")).toBe("");
  });
});
