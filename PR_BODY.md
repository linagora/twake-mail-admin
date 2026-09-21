Closes #72

## Resource counters

`Users > Calendars` and `Users > Address books` display, next to each collection, the number of events or contacts it holds (`GET …/calendars/{calendarId}/eventCount`, `GET …/addressbooks/{addressBookId}/contactCount`).

The counters are fetched lazily: the rows only exist once the section is expanded, so nothing is requested before that, and each collection is counted by its own component — a slow collection never holds up its siblings, and one that cannot be counted simply stays listed without a counter.

Owned, delegated, subscribed and shared collections are all counted: the webadmin routes resolve a shared collection to its source.

## Import and export

Collections the user owns get two extra buttons:

- **download** — `POST …?action=export`, saved as `<name>.ics` / `<name>.vcf`;
- **upload** — picks a file and `POST …?action=import` with its content. The route schedules a task, so the toast links to `/task/{taskId}`, like the other asynchronous actions of the page.

Shared collections do not get them: they are mirrors, and importing into them belongs to their owner. For calendars that is the existing `owner` category; for address books it is the absence of an `openpaas:source`, which is how the DAV listing marks a mirror.

The three controls are shared by the two sections, in `dav-collection-actions.tsx`: a calendar and an address book are the same DAV collection behind routes that differ only by their path and their media type.

## Permissions

Each control is gated on the endpoint it calls, so a client whose `allowedUrl` configuration does not grant it never sees it. The six new endpoints are documented in `validation.md` and declared in `profile-editor/…/inventory.py` (English and French labels).

| Control | Verb | Pattern |
|---------|------|---------|
| Event counter | GET | `/users/{username}/calendars/{calendarId}/eventCount` |
| Export calendar | POST | `/users/{username}/calendars/{calendarId}?action=export` |
| Import events | POST | `/users/{username}/calendars/{calendarId}?action=import` |
| Contact counter | GET | `/users/{username}/addressbooks/{addressBookId}/contactCount` |
| Export address book | POST | `/users/{username}/addressbooks/{addressBookId}?action=export` |
| Import contacts | POST | `/users/{username}/addressbooks/{addressBookId}?action=import` |

Both sections are already `APPLICATION:"CALENDAR"` only, so the scope is unchanged.

Labels were added to the five locales (en, fr, mn, ru, vi).

## Checks

- `cd profile-editor && python3 -m unittest discover -s tests -t .` → **225 passed**, so the frontend gates, `validation.md` and the inventory agree.
- **Not run in this environment**: `bun run lint`, `bun run build`, `bun run test` and `docker build .`. The sandbox this ran in only exposes Node 12 and forbids creating directories, so neither `bun` / `npm install` nor `tsc` could be executed. No dependency changed, so `bun.lockb` is untouched and `npm audit` is unaffected. The TypeScript was reviewed by hand, and every lucide icon used (`CalendarDays`, `Contact`, `Download`, `Upload`, `Loader2`, `type LucideIcon`) was checked against the `lucide-react@0.473.0` tarball. **Please let CI run lint/build/tests before merging.**

---
*Generated automatically*
