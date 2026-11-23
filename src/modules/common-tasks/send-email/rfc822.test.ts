import { describe, expect, it } from "vitest";
import { addressesOf, checkMessage, composeMessage, isValidAddress } from "./rfc822";

const message = (...headers: string[]) => `${headers.join("\r\n")}\r\n\r\nbody\r\n`;

describe("isValidAddress", () => {
  it.each(["bob@domain.tld", "first.last+tag@sub.domain.tld", "\"john doe\"@domain.tld", "user@[127.0.0.1]", "élodie@domaine.fr", "admin@localhost"])(
    "accepts %s",
    (address) => expect(isValidAddress(address)).toBe(true),
  );

  it.each(["not an address", "bob", "bob@", "@domain.tld", "bob@@domain.tld", "bob@domain..tld", ".bob@domain.tld", "bob @domain.tld"])(
    "refuses %s",
    (address) => expect(isValidAddress(address)).toBe(false),
  );
});

describe("addressesOf", () => {
  it("drops display names and comments", () => {
    expect(addressesOf(` "Doe, John" <john@domain.tld>, Alice (work) <alice@domain.tld>, bob@domain.tld (Bob)`))
      .toEqual(["john@domain.tld", "alice@domain.tld", "bob@domain.tld"]);
  });

  it("lists the members of a group, and none for an empty group", () => {
    expect(addressesOf(" Team: a@domain.tld, b@domain.tld;")).toEqual(["a@domain.tld", "b@domain.tld"]);
    expect(addressesOf(" undisclosed-recipients:;")).toEqual([]);
  });

  it("ignores an empty value and a trailing comma", () => {
    expect(addressesOf(" ")).toEqual([]);
    expect(addressesOf(" a@domain.tld,")).toEqual(["a@domain.tld"]);
  });
});

describe("checkMessage", () => {
  it("accepts a message with one sender and valid recipients", () => {
    expect(checkMessage(message("From: Alice <alice@domain.tld>", "To: bob@domain.tld", "Subject: hi"))).toEqual([]);
  });

  it("counts Cc and Bcc as recipients", () => {
    expect(checkMessage(message("From: alice@domain.tld", "Cc: bob@domain.tld"))).toEqual([]);
    expect(checkMessage(message("From: alice@domain.tld", "Bcc: bob@domain.tld"))).toEqual([]);
  });

  it("reads folded headers, LF line endings and any header case", () => {
    expect(checkMessage("from: alice@domain.tld\nTO: bob@domain.tld,\n carol@domain.tld\n\nbody")).toEqual([]);
    expect(checkMessage("From: alice@domain.tld\nTo: bob@domain.tld,\n not an address\n\nbody"))
      .toEqual([{ kind: "invalidRecipient", header: "To", address: "not an address" }]);
  });

  it("only reads the headers, not the body", () => {
    expect(checkMessage("Subject: x\r\n\r\nFrom: alice@domain.tld\r\nTo: bob@domain.tld\r\n"))
      .toEqual([{ kind: "noFrom" }, { kind: "noRecipient" }]);
  });

  it("flags an empty message", () => {
    expect(checkMessage("  \n")).toEqual([{ kind: "empty" }]);
  });

  it("flags a missing, a repeated and an invalid sender", () => {
    expect(checkMessage(message("To: bob@domain.tld"))).toEqual([{ kind: "noFrom" }]);
    expect(checkMessage(message("From: a@domain.tld, b@domain.tld", "To: bob@domain.tld"))).toEqual([{ kind: "severalFrom" }]);
    expect(checkMessage(message("From: not an address", "To: bob@domain.tld")))
      .toEqual([{ kind: "invalidFrom", address: "not an address" }]);
  });

  it("flags a message without recipient, an empty group included", () => {
    expect(checkMessage(message("From: alice@domain.tld", "To: undisclosed-recipients:;"))).toEqual([{ kind: "noRecipient" }]);
  });

  it("flags every invalid recipient with its header", () => {
    expect(checkMessage(message("From: alice@domain.tld", "To: bob@domain.tld, bob", "Bcc: x@")))
      .toEqual([
        { kind: "invalidRecipient", header: "To", address: "bob" },
        { kind: "invalidRecipient", header: "Bcc", address: "x@" },
      ]);
  });
});

describe("composeMessage", () => {
  const date = new Date(Date.UTC(2026, 10, 23, 9, 30));

  it("builds a plain text message with CRLF line endings", () => {
    expect(composeMessage({ from: "alice@domain.tld", to: "bob@domain.tld", cc: " ", subject: "Hello", body: "line 1\nline 2" }, date))
      .toBe([
        "From: alice@domain.tld",
        "To: bob@domain.tld",
        "Subject: Hello",
        "Date: Mon, 23 Nov 2026 09:30:00 GMT",
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: 8bit",
        "",
        "line 1",
        "line 2",
        "",
      ].join("\r\n"));
  });

  it("encodes a non ASCII subject", () => {
    expect(composeMessage({ from: "a@domain.tld", to: "b@domain.tld", cc: "", subject: "Réunion", body: "" }, date))
      .toContain("Subject: =?UTF-8?B?UsOpdW5pb24=?=");
  });

  it("passes the checks once From and a recipient are filled", () => {
    const composed = composeMessage({ from: "a@domain.tld", to: "", cc: "c@domain.tld", subject: "", body: "" }, date);
    expect(checkMessage(composed)).toEqual([]);
    expect(checkMessage(composeMessage({ from: "", to: "", cc: "", subject: "", body: "" }, date)))
      .toEqual([{ kind: "noFrom" }, { kind: "noRecipient" }]);
  });
});
