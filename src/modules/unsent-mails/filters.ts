import type { UnsentMail, UnsentMailSelection } from "./types";

const MAIL_ADDRESS = /^[^\s@]+@[^\s@]+$/;

/** Whether the filter is a complete address, the only form WebAdmin accepts. */
export const isMailAddress = (value: string): boolean => MAIL_ADDRESS.test(value);

/**
 * A complete address matches exactly (case insensitively, as WebAdmin does), so
 * that the list shows what a bulk task would target. Anything else is a
 * substring search.
 */
export const matchesAddress = (filter: string, address: string): boolean => {
  const expected = filter.trim().toLowerCase();
  const actual = address.toLowerCase();
  if (!expected) return true;
  return isMailAddress(expected) ? actual === expected : actual.includes(expected);
};

export const matchesFilters = (
  mail: UnsentMail,
  senderFilter: string,
  recipientFilter: string
): boolean =>
  matchesAddress(senderFilter, mail.mailFrom ?? "") &&
  (!recipientFilter.trim() ||
    mail.rcptTo.some((rcpt) => matchesAddress(recipientFilter, rcpt)));

const isValidCriterion = (value: string): boolean => !value || isMailAddress(value);

/**
 * The server side selection mirroring the filters, or null when a filter is a
 * partial address WebAdmin can not select by.
 */
export const bulkSelection = (
  senderFilter: string,
  recipientFilter: string
): UnsentMailSelection | null => {
  const sender = senderFilter.trim();
  const recipient = recipientFilter.trim();
  if (![sender, recipient].every(isValidCriterion)) return null;
  return { sender: sender || undefined, recipient: recipient || undefined };
};
