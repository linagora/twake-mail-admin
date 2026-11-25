import { describe, expect, it } from "vitest";
import type { TFunction } from "i18next";
import { calendarDisplayName, isMainCalendar } from "./main-calendar";
import { UserCalendar } from "../types";

function calendarAt(href: string): UserCalendar {
  return { _links: { self: { href } }, "dav:name": "any" };
}

describe("isMainCalendar", () => {
  it("recognises the calendar named after the calendar home", () => {
    expect(isMainCalendar(calendarAt("/calendars/6ad1f971/6ad1f971.json"))).toBe(true);
  });

  it("recognises the legacy events calendar", () => {
    expect(isMainCalendar(calendarAt("/calendars/6ad1f971/events.json"))).toBe(true);
  });

  it("rejects any other calendar of the home", () => {
    expect(isMainCalendar(calendarAt("/calendars/6ad1f971/073e50b9.json"))).toBe(false);
  });

  it("rejects a calendar without href", () => {
    expect(isMainCalendar({ "dav:name": "any" })).toBe(false);
  });

  it("rejects an unexpected href", () => {
    expect(isMainCalendar(calendarAt("/addressbooks/6ad1f971/6ad1f971.json"))).toBe(false);
  });
});

describe("calendarDisplayName", () => {
  const t = ((key: string, options?: { owner?: string }) => (options?.owner ? `${key}:${options.owner}` : key)) as unknown as TFunction;
  const calendar = (name: string | undefined, href: string): UserCalendar =>
    ({ "dav:name": name, _links: { self: { href } } }) as UserCalendar;

  it("names the user's own main calendar", () => {
    expect(calendarDisplayName(calendar("#default", "/calendars/alice/alice.json"), t)).toBe("users.calendars.mainCalendar");
    expect(calendarDisplayName(calendar(undefined, "/calendars/alice/alice.json"), t)).toBe("users.calendars.mainCalendar");
  });

  it("names a delegated main calendar after its owner", () => {
    const delegated = { ...calendar("#default", "/calendars/bob/x1.json"), "calendarserver:delegatedsource": "/calendars/alice/alice.json" } as UserCalendar;
    expect(calendarDisplayName(delegated, t, "alice@open-paas.org")).toBe("users.calendars.mainCalendarOf:alice@open-paas.org");
    expect(calendarDisplayName(delegated, t)).toBe("users.calendars.mainCalendar");
  });

  it("shows a secondary calendar of the user named \"#default\" by its name", () => {
    expect(calendarDisplayName(calendar("#default", "/calendars/alice/073e50b9.json"), t)).toBe("#default");
  });

  it("keeps the name the user gave", () => {
    expect(calendarDisplayName(calendar("Work", "/calendars/alice/w.json"), t)).toBe("Work");
    expect(calendarDisplayName(calendar("Work", "/calendars/bob/w.json"), t, "alice@open-paas.org")).toBe("Work");
  });
});
