import { describe, expect, it } from "vitest";
import { folderNameProblem, isTeamMailboxSystemFolder, parseMailboxPath } from "./mailbox-path";

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
    expect(folderNameProblem("INBOX")).toBeNull();
    expect(folderNameProblem("INBOX.work")).toBeNull();
    expect(folderNameProblem("a#b")).toBeNull();
  });

  it("refuses a name with an empty hierarchy part", () => {
    expect(folderNameProblem("")).toBe("emptyPart");
    expect(folderNameProblem(".work")).toBe("emptyPart");
    expect(folderNameProblem("INBOX.")).toBe("emptyPart");
    expect(folderNameProblem("a..b")).toBe("emptyPart");
  });

  it("refuses a name with a hierarchy part starting with the namespace prefix", () => {
    expect(folderNameProblem("#user")).toBe("namespacePrefix");
    expect(folderNameProblem("INBOX.#work")).toBe("namespacePrefix");
  });
});

describe("team mailbox system folder", () => {
  it("tells the top-level folders provisioned with the team mailbox", () => {
    ["INBOX", "Sent", "Trash", "Outbox", "Drafts", "Templates"]
      .forEach((folder) => expect(isTeamMailboxSystemFolder(folder)).toBe(true));
  });

  it("does not protect their sub-folders nor other folders", () => {
    expect(isTeamMailboxSystemFolder("INBOX.work")).toBe(false);
    expect(isTeamMailboxSystemFolder("Archive")).toBe(false);
  });
});
