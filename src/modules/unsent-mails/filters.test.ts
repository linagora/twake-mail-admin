import { describe, expect, it } from "vitest";
import { bulkSelection, isMailAddress, matchesAddress, matchesFilters } from "./filters";
import type { UnsentMail } from "./types";

const mail = (mailFrom: string | null, rcptTo: string[]): UnsentMail => ({
  id: "1",
  mailFrom,
  rcptTo,
  body: "",
  createdAt: "2026-10-16T00:00:00Z",
  sendingTrials: [],
});

describe("isMailAddress", () => {
  it("accepts a complete address", () => {
    expect(isMailAddress("alice@open-paas.org")).toBe(true);
  });

  it.each(["alice", "alice@", "@open-paas.org", "ali ce@open-paas.org"])(
    "rejects %s",
    (value) => expect(isMailAddress(value)).toBe(false)
  );
});

describe("matchesAddress", () => {
  it("matches everything when the filter is blank", () => {
    expect(matchesAddress("  ", "alice@open-paas.org")).toBe(true);
  });

  it("searches a partial filter as a case insensitive substring", () => {
    expect(matchesAddress("ALICE", "malice@open-paas.org")).toBe(true);
  });

  it("matches a complete address exactly, like the bulk tasks do", () => {
    expect(matchesAddress("alice@open-paas.org", "malice@open-paas.org")).toBe(false);
  });

  it("matches a complete address case insensitively", () => {
    expect(matchesAddress(" Alice@Open-Paas.org ", "alice@open-paas.org")).toBe(true);
  });
});

describe("matchesFilters", () => {
  const unsent = mail("alice@open-paas.org", ["bob@open-paas.org", "carol@open-paas.org"]);

  it("requires both the sender and a recipient to match", () => {
    expect(matchesFilters(unsent, "alice", "carol@open-paas.org")).toBe(true);
    expect(matchesFilters(unsent, "alice", "dave")).toBe(false);
  });

  it("treats a null sender as an empty address", () => {
    expect(matchesFilters(mail(null, ["bob@open-paas.org"]), "", "bob")).toBe(true);
    expect(matchesFilters(mail(null, ["bob@open-paas.org"]), "alice", "")).toBe(false);
  });
});

describe("bulkSelection", () => {
  it("selects everything when no filter is set", () => {
    expect(bulkSelection(" ", "")).toEqual({ sender: undefined, recipient: undefined });
  });

  it("passes complete addresses trimmed", () => {
    expect(bulkSelection(" alice@open-paas.org ", "bob@open-paas.org")).toEqual({
      sender: "alice@open-paas.org",
      recipient: "bob@open-paas.org",
    });
  });

  it.each([
    ["alice", ""],
    ["", "bob"],
    ["alice@open-paas.org", "bob"],
  ])("refuses the partial filters %j / %j", (sender, recipient) => {
    expect(bulkSelection(sender, recipient)).toBeNull();
  });
});
