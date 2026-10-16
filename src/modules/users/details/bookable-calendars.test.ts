import { describe, expect, it } from "vitest";
import { isBookableCalendar, isResourceCalendar } from "./bookable-calendars";
import { CalendarInvite, UserCalendar } from "../types";

const BOB = "bob@open-paas.org";

function invite(href: string, principal: string, access: number): CalendarInvite {
  return { href, principal, access, comment: null, inviteStatus: 2 };
}

const ownCalendar: UserCalendar = {
  _links: { self: { href: "/calendars/bob/bob.json" } },
  "dav:name": "#default",
};

const resourceAdministeredByBob: UserCalendar = {
  _links: { self: { href: "/calendars/bob/073e50b9.json" } },
  "calendarserver:delegatedsource": "/calendars/room/room.json",
  "dav:name": "QA Room",
  invite: [
    invite("principals/resources/room", "principals/resources/room", 1),
    invite(`mailto:${BOB}`, "principals/users/bob", 3),
  ],
};

const resourceSubscription: UserCalendar = {
  _links: { self: { href: "/calendars/bob/sub.json" } },
  "dav:name": "Projector",
  "calendarserver:source": {
    acl: [{ privilege: "{DAV:}read", principal: "principals/resources/projector" }],
  },
};

const writeDelegated: UserCalendar = {
  _links: { self: { href: "/calendars/bob/writable.json" } },
  "calendarserver:delegatedsource": "/calendars/charlotte/writable.json",
  "dav:name": "Writable",
  invite: [invite(`mailto:${BOB}`, "principals/users/bob", 3)],
};

const readDelegated: UserCalendar = {
  _links: { self: { href: "/calendars/bob/readonly.json" } },
  "calendarserver:delegatedsource": "/calendars/charlotte/readonly.json",
  "dav:name": "Read only",
  invite: [invite(`mailto:${BOB}`, "principals/users/bob", 2)],
};

describe("isResourceCalendar", () => {
  it("detects a resource calendar seen by its administrator as a delegated calendar", () => {
    expect(isResourceCalendar(resourceAdministeredByBob)).toBe(true);
  });

  it("detects a resource calendar seen as a subscription", () => {
    expect(isResourceCalendar(resourceSubscription)).toBe(true);
  });

  it("does not flag user calendars", () => {
    expect(isResourceCalendar(ownCalendar)).toBe(false);
    expect(isResourceCalendar(writeDelegated)).toBe(false);
  });
});

describe("isBookableCalendar", () => {
  it("offers the user's own calendars", () => {
    expect(isBookableCalendar(ownCalendar, BOB)).toBe(true);
  });

  it("offers calendars delegated with write access", () => {
    expect(isBookableCalendar(writeDelegated, BOB)).toBe(true);
  });

  it("never offers read-only delegated calendars", () => {
    expect(isBookableCalendar(readDelegated, BOB)).toBe(false);
  });

  it("never offers a resource calendar, even to its administrator", () => {
    expect(isBookableCalendar(resourceAdministeredByBob, BOB)).toBe(false);
  });

  it("never offers a resource subscription", () => {
    expect(isBookableCalendar(resourceSubscription, BOB)).toBe(false);
  });
});
