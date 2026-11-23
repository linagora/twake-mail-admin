/**
 * The size limits tmail-backend puts on the label and JMAP settings models (WebAdmin answers 400
 * past them). Data stored before these limits is not checked on read: it may exceed them.
 */
export const LABEL_DISPLAY_NAME_MAX_LENGTH = 255;
export const LABEL_DESCRIPTION_MAX_LENGTH = 4096;
export const JMAP_SETTING_VALUE_MAX_LENGTH = 16384;
export const JMAP_SETTINGS_MAX_COUNT = 1000;

// A counter shows up once a field holds this share of its limit
const COUNTER_THRESHOLD = 0.9;

export type TextProblem =
  | { kind: "required" }
  | { kind: "tooLong"; max: number; length: number };

const tooLong = (value: string, max: number): TextProblem | null =>
  value.length > max ? { kind: "tooLong", max, length: value.length } : null;

export const isNearLimit = (value: string, max: number): boolean =>
  value.length >= Math.ceil(max * COUNTER_THRESHOLD);

/** Checks the display name as it will be sent: trimmed, not blank, within the limit. */
export const checkLabelDisplayName = (displayName: string): TextProblem | null => {
  const trimmed = displayName.trim();
  return trimmed ? tooLong(trimmed, LABEL_DISPLAY_NAME_MAX_LENGTH) : { kind: "required" };
};

/** Checks the description as it will be sent: trimmed, an empty one being no description. */
export const checkLabelDescription = (description: string | null | undefined): TextProblem | null =>
  tooLong((description ?? "").trim(), LABEL_DESCRIPTION_MAX_LENGTH);

export const isLabelFormValid = (form: { displayName: string; description?: string | null }): boolean =>
  !checkLabelDisplayName(form.displayName) && !checkLabelDescription(form.description);

/** Whether a stored label exceeds the limits, so that it cannot be saved unchanged. */
export const exceedsLabelLimits = (label: { displayName: string; description?: string | null }): boolean =>
  label.displayName.trim().length > LABEL_DISPLAY_NAME_MAX_LENGTH
  || (label.description ?? "").trim().length > LABEL_DESCRIPTION_MAX_LENGTH;

export const checkJmapSettingValue = (value: string): TextProblem | null =>
  tooLong(value, JMAP_SETTING_VALUE_MAX_LENGTH);

/** The number of settings to remove before saving: 0 when within the limit. */
export const jmapSettingsExcess = (count: number): number => Math.max(0, count - JMAP_SETTINGS_MAX_COUNT);

export const canAddJmapSetting = (count: number): boolean => count < JMAP_SETTINGS_MAX_COUNT;
