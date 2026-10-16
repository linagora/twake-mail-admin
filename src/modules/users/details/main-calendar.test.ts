import { describe, expect, it } from "vitest";
import { isMainCalendar } from "./main-calendar";
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
