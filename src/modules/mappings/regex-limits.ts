/**
 * The limits James puts on a regex mapping (`regex:replacement`) when it evaluates them with RE2,
 * its default. A hint only, never a block: the console cannot read `james.rrt.regex.safe`, and a
 * server running with `false` accepts and applies such mappings.
 */
export const MAX_REGEX_LENGTH = 500;

export type RegexLimit = "braces" | "length" | "controlCharacters";

const BRACES = /[{}]/;
const CONTROL_CHARACTER = /\p{Cc}/u;

// The regex stops at the first colon; the length limit does not count the replacement
const regexOf = (mapping: string) => mapping.split(":", 1)[0];

const LIMIT_CHECKS: [RegexLimit, (mapping: string) => boolean][] = [
  ["braces", (mapping) => BRACES.test(mapping)],
  ["length", (mapping) => regexOf(mapping).length > MAX_REGEX_LENGTH],
  ["controlCharacters", (mapping) => CONTROL_CHARACTER.test(mapping)],
];

export const exceededRegexLimits = (mapping: string): RegexLimit[] =>
  LIMIT_CHECKS.filter(([, isExceeded]) => isExceeded(mapping)).map(([limit]) => limit);
