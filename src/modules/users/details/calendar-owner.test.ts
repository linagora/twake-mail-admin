import { describe, expect, it } from "vitest";
import { buildOwnerEmailMap, ownerEmail } from "./calendar-owner";
import { UserCalendar } from "../types";

const delegated = {
  "dav:name": "#default",
  "calendarserver:delegatedsource": "/calendars/alice-id/alice-id.json",
  invite: [
    { href: "mailto:alice@example.com", principal: "principals/users/alice-id", access: 1 },
    { href: "mailto:bob@example.com", principal: "principals/users/bob-id", access: 3 },
    { href: "mailto:room@example.com", principal: "principals/resources/room-id", access: 2 },
  ],
} as unknown as UserCalendar;

describe("calendar owner", () => {
  it("resolves the owner from the mailto invites of user principals", () => {
    const emails = buildOwnerEmailMap([delegated], null);

    expect(emails).toEqual({ "alice-id": "alice@example.com", "bob-id": "bob@example.com" });
    expect(ownerEmail(delegated, emails)).toBe("alice@example.com");
  });

  it("prefers the registered users, which also cover owners absent from any invite", () => {
    const emails = buildOwnerEmailMap([delegated], [
      { id: "alice-id", email: "alice.renamed@example.com" },
      { id: "charlotte-id", email: "charlotte@example.com" },
    ] as never);

    expect(emails["alice-id"]).toBe("alice.renamed@example.com");
    expect(emails["charlotte-id"]).toBe("charlotte@example.com");
  });

  it("has no owner for a calendar of the user", () => {
    expect(ownerEmail({ "dav:name": "Own" } as UserCalendar, { "alice-id": "alice@example.com" })).toBeNull();
  });
});
