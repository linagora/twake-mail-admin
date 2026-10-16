import { UserCalendar } from "../types";

// esn-sabre sharee access codes: 2 = read, 3 = read-write, 5 = administration.
const WRITE_ACCESS = new Set([3, 5]);

const RESOURCE_PRINCIPAL_PREFIX = "principals/resources/";

// A calendar backed by a resource (meeting room, equipment…) is shared with a
// `principals/resources/…` principal. Its users see it as a subscription (the
// principal is on the subscription source), while its administrators see it as
// a delegated calendar (the principal is on the calendar itself).
export function isResourceCalendar(calendar: UserCalendar): boolean {
  const source = calendar["calendarserver:source"];
  const principals = [
    ...(calendar.invite ?? []).map((i) => i.principal),
    ...(calendar.acl ?? []).map((a) => a.principal),
    ...(source?.invite ?? []).map((i) => i.principal),
    ...(source?.acl ?? []).map((a) => a.principal),
  ];
  return principals.some((p) => p?.startsWith(RESOURCE_PRINCIPAL_PREFIX));
}

// True when the viewed user (identified by their e-mail address, which is the
// username here) is an explicit sharee of this calendar with read-write or
// administration access. The sharing invites live on the calendar itself or on
// its subscription source.
function hasWriteDelegation(calendar: UserCalendar, username: string): boolean {
  const mine = `mailto:${username.toLowerCase()}`;
  const invites = [
    ...(calendar.invite ?? []),
    ...(calendar["calendarserver:source"]?.invite ?? []),
  ];
  return invites.some((i) => i.href?.toLowerCase() === mine && WRITE_ACCESS.has(i.access));
}

// A booking link may only target a calendar the user can write to: their own
// calendars, or calendars explicitly shared to them with write delegation.
// Resource calendars and read-only shares are never bookable (see issue #27).
export function isBookableCalendar(calendar: UserCalendar, username: string): boolean {
  if (isResourceCalendar(calendar)) return false;
  // Owned calendars have neither a subscription source nor a delegated source.
  const isOwned = !calendar["calendarserver:source"] && !calendar["calendarserver:delegatedsource"];
  if (isOwned) return true;
  return hasWriteDelegation(calendar, username);
}
