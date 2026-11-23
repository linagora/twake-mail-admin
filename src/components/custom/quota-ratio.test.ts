import { describe, expect, it } from "vitest";
import { barWidth, formatRatio, hasZeroLimit, occupationRatio, occupationRatios } from "./quota-ratio";

describe("occupationRatio", () => {
  it("is 0 for a zero limit when nothing is used", () => {
    expect(occupationRatio(0, 0, 0)).toBe(0);
  });

  it("is 1 for a zero limit with some usage", () => {
    expect(occupationRatio(1, 5, 0)).toBe(1);
  });

  it("ignores the NaN or Infinity of older backends for a zero limit", () => {
    expect(occupationRatio(NaN, 0, 0)).toBe(0);
    expect(occupationRatio("NaN", 0, 0)).toBe(0);
    expect(occupationRatio(Infinity, 5, 0)).toBe(1);
    expect(occupationRatio("Infinity", 5, 0)).toBe(1);
  });

  it("is 0 for an unlimited quota", () => {
    expect(occupationRatio(0, 5, -1)).toBe(0);
    expect(occupationRatio("NaN", 5, -1)).toBe(0);
    expect(occupationRatio(undefined, 5, null)).toBe(0);
  });

  it("trusts a finite backend ratio", () => {
    expect(occupationRatio(0.25, 25, 100)).toBe(0.25);
  });

  it("works a non finite ratio out from usage and limit", () => {
    expect(occupationRatio("NaN", 25, 100)).toBe(0.25);
  });

  it("cannot work a non finite ratio out without the limit", () => {
    expect(occupationRatio("NaN", 25, undefined)).toBeNull();
  });
});

describe("occupationRatios", () => {
  it("takes the max of the count and size ratios", () => {
    const ratios = occupationRatios({ count: 3, size: 10, ratio: { count: "NaN", size: 0.1, max: "NaN" } }, { count: 0, size: 100 });
    expect(ratios).toEqual({ count: 1, size: 0.1, max: 1 });
  });

  it("is unknown without limits nor a finite ratio", () => {
    expect(occupationRatios({ count: 3, size: 10, ratio: { count: NaN, size: NaN, max: NaN } }, null)).toEqual({ count: null, size: null, max: null });
  });
});

describe("display helpers", () => {
  it("shows — for an unknown ratio, never NaN%", () => {
    expect(formatRatio(null)).toBe("—");
    expect(formatRatio(1)).toMatch(/100/);
  });

  it("caps the bar at 100% and empties it for an unknown ratio", () => {
    expect(barWidth(1.5)).toBe("100%");
    expect(barWidth(null)).toBe("0%");
  });

  it("detects a zero limit", () => {
    expect(hasZeroLimit({ count: 0, size: null })).toBe(true);
    expect(hasZeroLimit({ count: -1, size: 100 })).toBe(false);
    expect(hasZeroLimit(null)).toBe(false);
  });
});
