import { RegisteredUser } from "@/modules/registered-users/types";
import { UserCalendar } from "../types";

type CalendarInvite = NonNullable<UserCalendar["invite"]>[number];

const USER_PRINCIPAL_PREFIX = "principals/users/";
const MAILTO_PREFIX = "mailto:";

const calendarInvites = (calendar: UserCalendar): CalendarInvite[] => [
  ...(calendar.invite ?? []),
  ...(calendar["calendarserver:source"]?.invite ?? []),
];

// An invite tells the e-mail of a user when it addresses a user principal with a mailto href.
const isUserMailtoInvite = (invite: CalendarInvite): boolean =>
  !!invite.href?.startsWith(MAILTO_PREFIX) && !!invite.principal?.startsWith(USER_PRINCIPAL_PREFIX);

const inviteEntry = (invite: CalendarInvite): [string, string] => [
  invite.principal.slice(USER_PRINCIPAL_PREFIX.length),
  invite.href.slice(MAILTO_PREFIX.length),
];

// The owner of a delegated/subscribed calendar is referenced by its technical
// user id (the segment after /calendars/ in the source href), never by email.
// We resolve it via the registered users list (authoritative, full coverage),
// completed by the mailto invites found in the listing itself.
export function buildOwnerEmailMap(
  calendars: UserCalendar[],
  registeredUsers: RegisteredUser[] | null,
): Record<string, string> {
  const fromInvites = calendars.flatMap(calendarInvites).filter(isUserMailtoInvite).map(inviteEntry);
  // Registered users take precedence — they cover owners absent from any invite.
  const fromRegisteredUsers = (registeredUsers ?? [])
    .filter((user) => user.id && user.email)
    .map((user): [string, string] => [user.id, user.email]);
  return Object.fromEntries([...fromInvites, ...fromRegisteredUsers]);
}

// The id a delegated calendar comes from, when its delegated source is /calendars/{id}/{id}.json
// and it is shared by the principal of that id under the given prefix. Null otherwise.
function delegatedSourceId(calendar: UserCalendar, principalPrefix: string): string | null {
  const sourceHref = calendar["calendarserver:delegatedsource"];
  if (!sourceHref) return null;
  const id = sourceHref.split("/").filter(Boolean)[1];
  if (!id) return null;
  return (calendar.invite ?? []).some((invite) => invite.principal === `${principalPrefix}${id}`) ? id : null;
}

/**
 * The id of the team calendar a delegated calendar is the copy of: its delegated source is
 * /calendars/{id}/{id}.json and it is shared by the team calendar principal. Null otherwise.
 */
export function teamCalendarSourceId(calendar: UserCalendar): string | null {
  return delegatedSourceId(calendar, "principals/team-calendars/");
}

/**
 * The id of the resource whose calendar is delegated to one of its administrators: its delegated
 * source is /calendars/{id}/{id}.json and it is shared by the resource principal. Null otherwise.
 */
export function resourceSourceId(calendar: UserCalendar): string | null {
  return delegatedSourceId(calendar, "principals/resources/");
}

export function ownerEmail(calendar: UserCalendar, ownerEmails: Record<string, string>): string | null {
  const sourceHref =
    calendar["calendarserver:delegatedsource"] ?? calendar["calendarserver:source"]?._links?.self?.href;
  if (!sourceHref) return null;
  // href looks like /calendars/{ownerId}/{calendarId}.json
  const ownerId = sourceHref.split("/").filter(Boolean)[1];
  if (!ownerId) return null;
  return ownerEmails[ownerId] ?? null;
}
