// The DAV server stores apple:color as an opaque property, so the console has
// to check it. Apple clients append an alpha channel (#rrggbbaa), keep it valid.
const CALENDAR_COLOR = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

export const DEFAULT_CALENDAR_COLOR = "#007fd8";

export const isValidCalendarColor = (color: string | undefined): boolean => {
  const trimmed = color?.trim() ?? "";
  return trimmed === "" || CALENDAR_COLOR.test(trimmed);
};

// <input type="color"> only understands #rrggbb
export const toColorPickerValue = (color: string | undefined): string => {
  const trimmed = color?.trim() ?? "";
  return trimmed && CALENDAR_COLOR.test(trimmed) ? trimmed.slice(0, 7) : DEFAULT_CALENDAR_COLOR;
};
