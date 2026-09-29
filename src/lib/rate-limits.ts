export interface RateLimits {
  mailsSentPerMinute: number | null;
  mailsSentPerHours: number | null;
  mailsSentPerDays: number | null;
  mailsReceivedPerMinute: number | null;
  mailsReceivedPerHours: number | null;
  mailsReceivedPerDays: number | null;
  recipientsSentPerMinute?: number | null;
  recipientsSentPerHours?: number | null;
  recipientsSentPerDays?: number | null;
}

export type RateLimitsForm = Required<RateLimits>;

export const RATE_LIMITS_FIELD_KEYS: (keyof RateLimits)[] = [
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

// Backends predating recipient rate limiting neither return nor accept these fields:
// only send them when the backend returned them or when a value is set.
const RECIPIENTS_SENT_KEYS: string[] = ["recipientsSentPerMinute", "recipientsSentPerHours", "recipientsSentPerDays"];

export const toRateLimitsForm = (data: Partial<RateLimits> | null | undefined): RateLimitsForm =>
  Object.fromEntries(RATE_LIMITS_FIELD_KEYS.map((key) => [key, data?.[key] ?? null])) as RateLimitsForm;

export const EMPTY_RATE_LIMITS_FORM: RateLimitsForm = toRateLimitsForm(null);

export const toRateLimitsPayload = (form: RateLimitsForm, returnedKeys: ReadonlySet<string>): RateLimits =>
  Object.fromEntries(
    Object.entries(form).filter(
      ([key, value]) => !RECIPIENTS_SENT_KEYS.includes(key) || returnedKeys.has(key) || value !== null
    )
  ) as unknown as RateLimits;
