import { describe, expect, it } from "vitest";
import {
  canAddJmapSetting,
  checkJmapSettingValue,
  checkLabelDescription,
  checkLabelDisplayName,
  exceedsLabelLimits,
  isLabelFormValid,
  isNearLimit,
  jmapSettingsExcess,
} from "./size-limits";

describe("label display name", () => {
  it("accepts 255 characters", () => {
    expect(checkLabelDisplayName("a".repeat(255))).toBeNull();
  });

  it("refuses 256 characters, saying how long it is", () => {
    expect(checkLabelDisplayName("a".repeat(256))).toEqual({ kind: "tooLong", max: 255, length: 256 });
  });

  it("refuses a blank one", () => {
    expect(checkLabelDisplayName("   ")).toEqual({ kind: "required" });
  });

  it("measures the trimmed name, the one sent", () => {
    expect(checkLabelDisplayName(` ${"a".repeat(255)} `)).toBeNull();
  });
});

describe("label description", () => {
  it("accepts 4096 characters", () => {
    expect(checkLabelDescription("a".repeat(4096))).toBeNull();
  });

  it("refuses 4097 characters", () => {
    expect(checkLabelDescription("a".repeat(4097))).toEqual({ kind: "tooLong", max: 4096, length: 4097 });
  });

  it("accepts no description", () => {
    expect(checkLabelDescription(undefined)).toBeNull();
    expect(checkLabelDescription(null)).toBeNull();
  });
});

describe("label form", () => {
  it("is valid with a display name and a description within the limits", () => {
    expect(isLabelFormValid({ displayName: "Work", description: "a".repeat(4096) })).toBe(true);
  });

  it("is invalid once a field breaks a limit", () => {
    expect(isLabelFormValid({ displayName: "" })).toBe(false);
    expect(isLabelFormValid({ displayName: "Work", description: "a".repeat(4097) })).toBe(false);
  });

  it("tells a stored label over the limits", () => {
    expect(exceedsLabelLimits({ displayName: "a".repeat(256) })).toBe(true);
    expect(exceedsLabelLimits({ displayName: "Work", description: "a".repeat(4097) })).toBe(true);
    expect(exceedsLabelLimits({ displayName: "Work", description: "Work emails" })).toBe(false);
  });
});

describe("JMAP setting value", () => {
  it("accepts 16384 characters", () => {
    expect(checkJmapSettingValue("a".repeat(16384))).toBeNull();
  });

  it("refuses 16385 characters", () => {
    expect(checkJmapSettingValue("a".repeat(16385))).toEqual({ kind: "tooLong", max: 16384, length: 16385 });
  });

  it("accepts an empty value, sent as an empty string", () => {
    expect(checkJmapSettingValue("")).toBeNull();
  });
});

describe("JMAP settings count", () => {
  it("accepts 1000 settings, but no more can be added", () => {
    expect(jmapSettingsExcess(1000)).toBe(0);
    expect(canAddJmapSetting(999)).toBe(true);
    expect(canAddJmapSetting(1000)).toBe(false);
  });

  it("counts the settings to remove past 1000", () => {
    expect(jmapSettingsExcess(1001)).toBe(1);
  });
});

describe("counter threshold", () => {
  it("shows from 90% of the limit", () => {
    expect(isNearLimit("a".repeat(229), 255)).toBe(false);
    expect(isNearLimit("a".repeat(230), 255)).toBe(true);
  });
});
