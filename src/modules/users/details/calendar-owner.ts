import { RegisteredUser } from "@/modules/registered-users/types";
import { UserCalendar } from "../types";

// The owner of a delegated/subscribed calendar is referenced by its technical
// user id (the segment after /calendars/ in the source href), never by email.
// We resolve it via the registered users list (authoritative, full coverage),
// completed by the mailto invites found in the listing itself.
export function buildOwnerEmailMap(
  calendars: UserCalendar[],
  registeredUsers: RegisteredUser[] | null,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const cal of calendars) {
    const invites = [...(cal.invite ?? []), ...(cal["calendarserver:source"]?.invite ?? [])];
    for (const inv of invites) {
      if (inv.href?.startsWith("mailto:") && inv.principal?.startsWith("principals/users/")) {
        map[inv.principal.slice("principals/users/".length)] = inv.href.replace(/^mailto:/, "");
      }
    }
  }
  // Registered users take precedence — they cover owners absent from any invite.
  for (const u of registeredUsers ?? []) {
    if (u.id && u.email) map[u.id] = u.email;
  }
  return map;
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
