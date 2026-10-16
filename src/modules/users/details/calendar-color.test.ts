import { describe, expect, it } from "vitest";
import { DEFAULT_CALENDAR_COLOR, isValidCalendarColor, toColorPickerValue } from "./calendar-color";

describe("isValidCalendarColor", () => {
  it.each(["#007fd8", "#ABCDEF", " #00ff00 ", "#007fd8ff"])("accepts %s", (color) => {
    expect(isValidCalendarColor(color)).toBe(true);
  });

  it.each(["", "  ", undefined])("accepts an empty colour (%s) since it is optional", (color) => {
    expect(isValidCalendarColor(color)).toBe(true);
  });

  it.each(["notacolor", "red; x", "red", "#fff", "007fd8", "#007fd", "#007fd8f", "#gggggg"])("rejects %s", (color) => {
    expect(isValidCalendarColor(color)).toBe(false);
  });
});

describe("toColorPickerValue", () => {
  it("keeps a #rrggbb colour", () => {
    expect(toColorPickerValue(" #00ff00 ")).toBe("#00ff00");
  });

  it("drops the alpha channel the colour picker does not understand", () => {
    expect(toColorPickerValue("#007fd8ff")).toBe("#007fd8");
  });

  it.each(["", undefined, "notacolor", "red; x"])("falls back to the default colour for %s", (color) => {
    expect(toColorPickerValue(color)).toBe(DEFAULT_CALENDAR_COLOR);
  });
});
