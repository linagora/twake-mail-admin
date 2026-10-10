import { UserLabel, UserLabelUpdatePayload } from "../types";

/**
 * The tmail-backend label PATCH treats a null/absent colour as "unchanged" and rejects an empty one:
 * once set, a label colour cannot be removed. The colour is thus only sent when the user provides one.
 */
export const buildLabelUpdatePayload = (form: UserLabelUpdatePayload): UserLabelUpdatePayload => {
  const color = form.color?.trim();
  return {
    displayName: form.displayName,
    ...(color ? { color } : {}),
    description: form.description?.trim() || null,
    readOnly: form.readOnly,
  };
};

export const isColorClearAttempt = (label: UserLabel, form: UserLabelUpdatePayload): boolean =>
  !!label.color && !form.color?.trim();
