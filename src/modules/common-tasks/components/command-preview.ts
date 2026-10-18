import { TaskParam } from "../types";

// Builds the command preview by reflecting the user's custom parameters into the
// base command: a parameter already present in the command URL is overridden in
// place (avoiding duplicates like `eventsPerSecond=100eventsPerSecond=100`),
// otherwise it is appended to the query string, inside the closing quote of a
// quoted URL. Falsy values are dropped, including from the base command, to match
// what is actually sent to the backend.
const TRAILING_QUOTE = /["']$/;

// Removes `key=value` from the query string, keeping the separator of the
// following parameter: `?key=1&b=2` -> `?b=2`, `?a=1&key=2` -> `?a=1`.
const removeQueryParam = (command: string, key: string): string =>
  command.replace(
    new RegExp(`([?&])${key}=[^&"']*(&)?`),
    (_match, separator, nextSeparator) => (nextSeparator ? separator : "")
  );

const appendQueryParam = (command: string, key: string, value: string | boolean): string => {
  const closingQuote = TRAILING_QUOTE.exec(command)?.[0] ?? "";
  const url = command.slice(0, command.length - closingQuote.length);
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${key}=${value}${closingQuote}`;
};

export const buildCommandPreview = (
  command: string,
  customParams: Record<string, string | boolean>
): string => {
  return Object.entries(customParams).reduce((result, [key, value]) => {
    if (!value) {
      return removeQueryParam(result, key);
    }
    const existing = new RegExp(`([?&]${key}=)[^&"']*`);
    if (existing.test(result)) {
      return result.replace(existing, (_match, prefix) => `${prefix}${value}`);
    }
    return appendQueryParam(result, key, value);
  }, command);
};

// The command run with the default parameters, as the dialog first previews it:
// shown before the dialog opens, e.g. in the tooltip of the Run button.
export const defaultCommand = (command: string, params?: TaskParam[]): string =>
  buildCommandPreview(
    command,
    Object.fromEntries((params ?? []).map((param) => [param.key, param.defaultValue ?? ""]))
  );
