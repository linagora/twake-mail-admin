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
