import type { TFunction } from "i18next";
import { UserCalendar } from "../types";

// Legacy URI of the main calendar, still recognised by esn-sabre.
const LEGACY_MAIN_CALENDAR_ID = "events";

// The main (default) calendar of a user lives at /calendars/{homeId}/{homeId}.json
// (or the legacy /calendars/{homeId}/events.json). esn-sabre always refuses to
// delete it (see issue #297).
export function isMainCalendar(calendar: UserCalendar): boolean {
  const href = calendar._links?.self?.href ?? "";
  const [root, homeId, file] = href.split("/").filter(Boolean);
  if (root !== "calendars" || !homeId || !file) return false;
  const id = file.replace(/\.json$/, "");
  return id === homeId || id === LEGACY_MAIN_CALENDAR_ID;
}

// Name the server gives the main calendar of every user
export const MAIN_CALENDAR_NAME = "#default";

/**
 * The name shown for a calendar: "Main calendar" for the user's own main calendar, "Main
 * calendar of alice@…" for one delegated or subscribed from its owner, else the stored name
 * (empty when there is none). The stored name stays the one edited and exported. An own calendar
 * is the main one by its address only: a secondary calendar may be named "#default" too.
 */
export function calendarDisplayName(calendar: UserCalendar, t: TFunction, owner?: string | null): string {
  const name = calendar["dav:name"]?.trim() ?? "";
  const isMainName = name === "" || name === MAIN_CALENDAR_NAME;
  const isOwn = !calendar["calendarserver:delegatedsource"] && !calendar["calendarserver:source"];
  if (isOwn) return isMainName && isMainCalendar(calendar) ? t("users.calendars.mainCalendar") : name;
  if (isMainName && owner) return t("users.calendars.mainCalendarOf", { owner });
  if (name === MAIN_CALENDAR_NAME) return t("users.calendars.mainCalendar");
  return name;
}
