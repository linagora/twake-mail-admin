import { AvailabilityRule } from "../types";

// WebAdmin refuses a rule whose end is not after its start, or whose time zone
// is unknown, with a 400 that does not tell which rule is wrong (see issue
// #359): the dialogs flag them beforehand.
export interface RuleErrors {
  range: boolean;
  timeZone: boolean;
}

// The rule editor shows these values when a rule has none.
export const DEFAULT_RULE_START = "09:00";
export const DEFAULT_RULE_END = "17:00";

// Every time zone the browser knows, suggested in the rule editor. Empty when
// the browser cannot list them: the zone is then only checked when typed.
export function listTimeZones(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
  try {
    const zones = intl.supportedValuesOf?.("timeZone") ?? [];
    return zones.includes("UTC") ? zones : ["UTC", ...zones];
  } catch {
    return [];
  }
}

export function isValidTimeZone(timeZone: string): boolean {
  const trimmed = timeZone.trim();
  if (!trimmed) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: trimmed });
    return true;
  } catch {
    return false;
  }
}

export function ruleErrors(rule: AvailabilityRule): RuleErrors {
  const start = rule.start ?? DEFAULT_RULE_START;
  const end = rule.end ?? DEFAULT_RULE_END;
  // "HH:mm" values compare as strings.
  return {
    range: !start || !end || start >= end,
    timeZone: !isValidTimeZone(rule.timeZone ?? ""),
  };
}

export function isValidRule(rule: AvailabilityRule): boolean {
  const errors = ruleErrors(rule);
  return !errors.range && !errors.timeZone;
}

export function areValidRules(rules: AvailabilityRule[]): boolean {
  return rules.every(isValidRule);
}
