import { describe, expect, it } from "vitest";
import { formatMailboxCreationDate, uuidV1ToDate } from "./mailbox-creation-date";

const INBOX_ID = "6a2b03d0-c59c-11f1-b635-a7d8ba5015eb";
const INBOX_CREATION = new Date("2026-10-11T17:51:41.197Z");

describe("uuidV1ToDate", () => {
  it("decodes the creation instant of a version 1 UUID", () => {
    expect(uuidV1ToDate(INBOX_ID)?.getTime()).toBe(INBOX_CREATION.getTime());
  });

  it("returns null for an id that is not a UUID", () => {
    expect(uuidV1ToDate("not-a-uuid")).toBeNull();
    expect(uuidV1ToDate("42")).toBeNull();
  });
});

describe("formatMailboxCreationDate", () => {
  it("formats the date in the chosen language and the local time zone", () => {
    const date = uuidV1ToDate(INBOX_ID)!;

    expect(formatMailboxCreationDate(INBOX_ID, "fr")).toBe(
      `${date.toLocaleDateString("fr")} ${date.toLocaleTimeString("fr")}`
    );
  });

  it("no longer falls back to an English GMT string", () => {
    const formatted = formatMailboxCreationDate(INBOX_ID, "fr");

    expect(formatted).not.toContain("GMT");
    expect(formatted).not.toContain("Sun");
    expect(formatted).toMatch(/\d{2}\/10\/2026/);
  });

  it("returns null for an id that is not a UUID", () => {
    expect(formatMailboxCreationDate("not-a-uuid", "fr")).toBeNull();
  });
});
