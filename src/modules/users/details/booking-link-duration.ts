// The duration input keeps the raw text the admin typed, so that it can be
// emptied and retyped freely (see issue #294). It is turned into a number only
// when valid: WebAdmin refuses anything but a positive whole number of minutes.
const WHOLE_NUMBER = /^\d+$/;

export function parseDurationMinutes(raw: string): number | null {
  const trimmed = raw.trim();
  if (!WHOLE_NUMBER.test(trimmed)) return null;
  const minutes = Number(trimmed);
  return minutes >= 1 && Number.isSafeInteger(minutes) ? minutes : null;
}

export function isValidDurationMinutes(raw: string): boolean {
  return parseDurationMinutes(raw) !== null;
}
