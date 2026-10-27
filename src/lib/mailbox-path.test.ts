import { describe, expect, it } from "vitest";
import { isValidFolderName, parseMailboxPath } from "./mailbox-path";

describe("mailbox path", () => {
  it("tells the owner and the mailbox of a private path", () => {
    expect(parseMailboxPath("#private:charlotte@example.com:INBOX")).toEqual({ owner: "charlotte@example.com", mailbox: "INBOX" });
    expect(parseMailboxPath("#private:bob@example.com:Archive.2024")).toEqual({ owner: "bob@example.com", mailbox: "Archive.2024" });
  });

  it("returns null for another namespace", () => {
    expect(parseMailboxPath("#team:sales@example.com:INBOX")).toBeNull();
    expect(parseMailboxPath("INBOX")).toBeNull();
  });
});

describe("folder name", () => {
  it("accepts a name and a nested name", () => {
    expect(isValidFolderName("INBOX")).toBe(true);
    expect(isValidFolderName("INBOX.work")).toBe(true);
  });

  it("refuses a name with an empty hierarchy part", () => {
    expect(isValidFolderName("")).toBe(false);
    expect(isValidFolderName(".work")).toBe(false);
    expect(isValidFolderName("INBOX.")).toBe(false);
    expect(isValidFolderName("a..b")).toBe(false);
  });
});
