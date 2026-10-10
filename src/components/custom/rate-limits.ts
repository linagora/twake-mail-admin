export interface RateLimits {
  mailsSentPerMinute: number | null;
  mailsSentPerHours: number | null;
  mailsSentPerDays: number | null;
  recipientsSentPerMinute: number | null;
  recipientsSentPerHours: number | null;
  recipientsSentPerDays: number | null;
  mailsReceivedPerMinute: number | null;
  mailsReceivedPerHours: number | null;
  mailsReceivedPerDays: number | null;
}

// Ordered minute / hour / day so that each group fills one row of a 3 column grid.
export const RATE_LIMIT_KEYS: (keyof RateLimits)[] = [
  "mailsSentPerMinute",
  "mailsSentPerHours",
  "mailsSentPerDays",
  "recipientsSentPerMinute",
  "recipientsSentPerHours",
  "recipientsSentPerDays",
  "mailsReceivedPerMinute",
  "mailsReceivedPerHours",
  "mailsReceivedPerDays",
];

// The backend leaves an omitted recipientsSent* limit unchanged (older backends do not know them at all).
const OPTIONAL_KEYS: (keyof RateLimits)[] = ["recipientsSentPerMinute", "recipientsSentPerHours", "recipientsSentPerDays"];

export const normalizeRateLimits = (data: Partial<RateLimits> | null | undefined): RateLimits =>
  Object.fromEntries(RATE_LIMIT_KEYS.map((key) => [key, data?.[key] ?? null])) as unknown as RateLimits;

// Only sends a recipientsSent* limit when it is set or was set before: an explicit null unsets it, while omitting
// untouched unset limits keeps the payload compatible with backends predating them.
export const toRateLimitsPayload = (form: RateLimits, loaded: RateLimits): Partial<RateLimits> =>
  Object.fromEntries(
    RATE_LIMIT_KEYS.filter((key) => !OPTIONAL_KEYS.includes(key) || form[key] !== null || loaded[key] !== null).map(
      (key) => [key, form[key]],
    ),
  );

export type RateLimitInputs = Record<keyof RateLimits, string>;

// Accepted: empty (default limit), -1 (unlimited) or an integer >= 0.
const RATE_LIMIT_INPUT = /^(-1|\d+)$/;

export const toRateLimitInputs = (limits: RateLimits): RateLimitInputs =>
  Object.fromEntries(
    RATE_LIMIT_KEYS.map((key) => [key, limits[key] === null ? "" : String(limits[key])]),
  ) as RateLimitInputs;

export const isValidRateLimitInput = (input: string): boolean => {
  const trimmed = input.trim();
  return trimmed === "" || RATE_LIMIT_INPUT.test(trimmed);
};

export const invalidRateLimitKeys = (inputs: RateLimitInputs): (keyof RateLimits)[] =>
  RATE_LIMIT_KEYS.filter((key) => !isValidRateLimitInput(inputs[key]));

// Expects inputs without invalidRateLimitKeys.
export const parseRateLimitInputs = (inputs: RateLimitInputs): RateLimits =>
  Object.fromEntries(
    RATE_LIMIT_KEYS.map((key) => [key, inputs[key].trim() === "" ? null : Number(inputs[key].trim())]),
  ) as unknown as RateLimits;
