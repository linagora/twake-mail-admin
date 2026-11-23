/**
 * The checks WebAdmin runs on a message posted to /mail-transfer-service, run in the browser so
 * that the server rarely has to refuse it: exactly one valid `From` address, and at least one
 * recipient (`To`, `Cc` or `Bcc`), every one of them valid.
 */

export type RecipientHeader = "To" | "Cc" | "Bcc";

export type MessageProblem =
  | { kind: "empty" }
  | { kind: "noFrom" }
  | { kind: "severalFrom" }
  | { kind: "invalidFrom"; address: string }
  | { kind: "noRecipient" }
  | { kind: "invalidRecipient"; header: RecipientHeader; address: string };

const RECIPIENT_HEADERS: RecipientHeader[] = ["To", "Cc", "Bcc"];

// RFC 5322 addr-spec, non-ASCII allowed (RFC 6532): a dot-atom or quoted local part, a dot-atom or literal domain
const ATOM = String.raw`[A-Za-z0-9!#$%&'*+/=?^_\x60{|}~\u0080-￿-]+`;
const DOT_ATOM = String.raw`${ATOM}(?:\.${ATOM})*`;
const QUOTED_STRING = String.raw`"(?:[^"\\\r\n]|\\.)*"`;
const DOMAIN_LITERAL = String.raw`\[[^\[\]\\\s]*\]`;
const ADDR_SPEC = new RegExp(`^(?:${DOT_ATOM}|${QUOTED_STRING})@(?:${DOT_ATOM}|${DOMAIN_LITERAL})$`);

export const isValidAddress = (address: string): boolean => ADDR_SPEC.test(address);

interface Header {
  name: string;
  value: string;
}

/** The header section: everything before the first empty line. */
const headerSection = (message: string): string => message.split(/\r?\n\r?\n/, 1)[0];

/** The header lines, a folded line (starting with a space or a tab) joined to the one it continues. */
const unfoldedLines = (section: string): string[] =>
  section.split(/\r?\n/).reduce<string[]>((lines, line) => {
    if (/^[ \t]/.test(line) && lines.length > 0) {
      return [...lines.slice(0, -1), `${lines[lines.length - 1]} ${line.trim()}`];
    }
    return [...lines, line];
  }, []);

const toHeader = (line: string): Header | null => {
  const colon = line.indexOf(":");
  return colon > 0 ? { name: line.slice(0, colon).trim().toLowerCase(), value: line.slice(colon + 1) } : null;
};

export const parseHeaders = (message: string): Header[] =>
  unfoldedLines(headerSection(message))
    .map(toHeader)
    .filter((header): header is Header => header !== null);

const valuesOf = (headers: Header[], name: string): string[] =>
  headers.filter((header) => header.name === name.toLowerCase()).map((header) => header.value);

interface ScanState {
  parts: string[];
  current: string;
  quoted: boolean;
  escaped: boolean;
  angle: number;
  comment: number;
  literal: boolean;
}

const isTopLevel = (state: ScanState) => !state.quoted && state.angle === 0 && state.comment === 0 && !state.literal;

const scanChar = (state: ScanState, char: string): ScanState => {
  if (state.escaped) return { ...state, escaped: false, current: state.current + char };
  if (char === "\\" && (state.quoted || state.comment > 0)) return { ...state, escaped: true, current: state.current + char };
  if (char === '"' && state.comment === 0) return { ...state, quoted: !state.quoted, current: state.current + char };
  if (state.quoted) return { ...state, current: state.current + char };
  if (char === "(") return { ...state, comment: state.comment + 1 };
  if (char === ")" && state.comment > 0) return { ...state, comment: state.comment - 1 };
  if (state.comment > 0) return state;
  if (char === "<") return { ...state, angle: state.angle + 1, current: state.current + char };
  if (char === ">" && state.angle > 0) return { ...state, angle: state.angle - 1, current: state.current + char };
  if (char === "[") return { ...state, literal: true, current: state.current + char };
  if (char === "]") return { ...state, literal: false, current: state.current + char };
  if (char === "," && isTopLevel(state)) return { ...state, parts: [...state.parts, state.current], current: "" };
  return { ...state, current: state.current + char };
};

/** The mailboxes of an address list, split on the commas outside quotes, brackets and comments, comments dropped. */
const splitMailboxes = (value: string): string[] => {
  const initial: ScanState = { parts: [], current: "", quoted: false, escaped: false, angle: 0, comment: 0, literal: false };
  const state = [...value].reduce(scanChar, initial);
  return [...state.parts, state.current];
};

// A group ("Team: a@b, c@d;") leaves its name on its first mailbox and its ";" on its last one
const withoutGroupSyntax = (mailbox: string): string => {
  const groupName = /^[^"<@]*:/.exec(mailbox);
  return (groupName ? mailbox.slice(groupName[0].length) : mailbox).replace(/;\s*$/, "").trim();
};

/** The address of a mailbox: inside its angle brackets when it has a display name, the whole mailbox otherwise. */
const addressOf = (mailbox: string): string => {
  const angle = /<([^<>]*)>\s*$/.exec(mailbox);
  return (angle ? angle[1] : mailbox).trim();
};

/** The addresses an address header lists, its display names and comments dropped. */
export const addressesOf = (value: string): string[] =>
  splitMailboxes(value)
    .map(withoutGroupSyntax)
    .filter((mailbox) => mailbox !== "")
    .map(addressOf);

const addressesIn = (headers: Header[], name: string): string[] => valuesOf(headers, name).flatMap(addressesOf);

const fromProblems = (headers: Header[]): MessageProblem[] => {
  const from = addressesIn(headers, "From");
  if (from.length === 0) return [{ kind: "noFrom" }];
  if (from.length > 1) return [{ kind: "severalFrom" }];
  return isValidAddress(from[0]) ? [] : [{ kind: "invalidFrom", address: from[0] }];
};

const recipientProblems = (headers: Header[]): MessageProblem[] => {
  const recipients = RECIPIENT_HEADERS.flatMap((header) =>
    addressesIn(headers, header).map((address) => ({ header, address })));
  if (recipients.length === 0) return [{ kind: "noRecipient" }];
  return recipients
    .filter(({ address }) => !isValidAddress(address))
    .map(({ header, address }) => ({ kind: "invalidRecipient", header, address }));
};

/** What keeps WebAdmin from accepting the message; empty when it can be sent. */
export const checkMessage = (message: string): MessageProblem[] => {
  if (message.trim() === "") return [{ kind: "empty" }];
  const headers = parseHeaders(message);
  return [...fromProblems(headers), ...recipientProblems(headers)];
};

export interface ComposedEmail {
  from: string;
  to: string;
  cc: string;
  subject: string;
  body: string;
}

const CRLF = "\r\n";

/** RFC 822 lines end with CRLF; a textarea gives its value with LF only. */
export const withCrlf = (text: string): string => text.replace(/\r?\n/g, CRLF);

const isAscii = (text: string) => /^[\x20-\x7E]*$/.test(text);

const toBase64 = (text: string): string =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)));

// RFC 2047: a subject that is not plain ASCII travels as an encoded word
const encodedSubject = (subject: string): string =>
  isAscii(subject) ? subject : `=?UTF-8?B?${toBase64(subject)}?=`;

const headerLine = (name: string, value: string): string[] =>
  value.trim() === "" ? [] : [`${name}: ${value.trim()}`];

/** The RFC 822 message of the composer: a plain text UTF-8 body, CRLF line endings. */
export const composeMessage = (email: ComposedEmail, date: Date = new Date()): string => {
  const headers = [
    ...headerLine("From", email.from),
    ...headerLine("To", email.to),
    ...headerLine("Cc", email.cc),
    ...headerLine("Subject", encodedSubject(email.subject.trim())),
    `Date: ${date.toUTCString()}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
  ];
  return `${headers.join(CRLF)}${CRLF}${CRLF}${withCrlf(email.body)}${CRLF}`;
};
