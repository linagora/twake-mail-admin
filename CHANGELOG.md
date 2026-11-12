# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)

## [Unreleased]

### Upgrade instructions

- Regenerate the profiles of the domain administrators and reload `webadmin-proxy`. DOMAIN profiles no longer grant the global `/registeredUsers`, `/tasks` and `/mailingLists` routes, or domain alias writes. User rename, alias creation and template provisioning are now scoped to the administrator's own domain, and `copyFrom` is GLOBAL only. A profile that grants nothing is now written as a single deny-all rule instead of `[]`, which the proxy read as "everything allowed" (#602).
- The geolocation of the network channels map is now opt-in. Set an `https` `GEOIP_URL` in `env.js` to keep it. Leaflet is bundled and no longer loaded from unpkg.
- Rebuild the Docker image with `--pull`. The serve image now applies Alpine security updates (#632).

### Added

- Common Tasks are grouped by purpose, each with a line saying what it does and what it costs, and a filter on names and descriptions (#418).
- Task Run buttons carry a risk badge ("Modifies data" or "Deletes data") and a green, orange or red colour code (#416, #439).
- Task parameters have plain-language labels, units, help and "(optional)" marks (#417).
- Task dialogs are titled after their task, and archiving calendar events without a criterion warns that every event is moved (#422).
- Common Tasks can run the Twake Space reindex and purge tasks (#551), and sync the spaces (#550).
- Team mailboxes show their Twake Space, and can be bound to a space, including a deleted one (#550, #552).
- Detail pages have a title with a breadcrumb back to the list (#425) and a sticky bar with the object and Expand all / Collapse all (#445).
- Sections remember whether they are expanded (#428).
- The user page has a summary strip of quota, mailboxes, aliases, forwards and vacation (#415).
- The calendar domain page has a summary strip with a link to its users (#451).
- The domain page shows resource administrators and team calendar members (#449).
- Calendar and address book rows show who they are shared with (#429), and where a shared calendar comes from (#446).
- Calendar tasks show the user, domain or calendar they worked on (#447).
- User fields suggest matching users as you type, from three characters (#439).
- Edit limits is a single dialog for message-count and size limits, prefilled, with the applied limit and its source (#437, #443).
- Tasks are followed to the end: a toast reports how each started task ended, with a link to its details (#440).
- The Tasks list refreshes by itself and has status chips, a type picker by task name and filters kept in the URL (#480).
- The task page gives a readable summary and refreshes while the task runs (#414).
- The Users search and domain filter live in the URL, and a domain links to its users (#436).
- Health Check is a triage page with a summary banner, and problems come first (#413).
- Event Dead Letter shows readable groups and events, and events can be redelivered from the group page (#434).
- Mail Repositories describes each standard repository and lists those holding mails first (#438).
- Mappings explain the RE2 limits of regex mappings and warn while typing.
- Local addresses link to their user page everywhere in the console (#435).
- The sidebar is grouped into Monitoring, Accounts and addresses, and Maintenance, for domain administrators too (#442).
- Domains show what they still hold before deletion (#432).
- Calendar Resources offers the 40 icons of the side service (#409).
- The calendar "Delete user data" dialog supports the `DavDomainMemberDeletionTaskStep` step and previews the command.
- Unavailable features such as Mailing Lists and Live Metrics are explained instead of showing a raw 404 (#421).
- Triage pages show an empty state (#420).
- Pagination is hidden when everything fits on one page (#419).

### Changed

- Irreversible confirmations are red, name their verb, and open with the focus on Cancel or on a type-to-confirm field (#412).
- Creation and add actions open in a modal, with refusals shown in the modal and the typed values kept. This applies to the + of every section, plus domains, registered users, mappings, mailing lists, calendars and address books (#473).
- The search and the actions of a list sit on one toolbar line.
- Dialogs keep their place and size, and give the focus back to the button that opened them.
- The main calendar reads "Main calendar" instead of "#default", and is exported as `Main_calendar.ics` (#427).
- Domain address book exports are named as shown, not by their id.
- Forwards ask whether to keep a copy in the mailbox, and warn when mail is only forwarded (#431).
- The user page of an address without an account says so (#433), and an invalid address reads "Invalid address" (#461, #494).
- Registered Users link to their user page, and both lists explain how they differ (#426).
- Deleting a registered user warns that their calendar delegations are revoked.
- Users, Domains and Registered Users lists are compact, numbered and have named delete buttons (#444).
- Deleting a domain also removes its domain aliases (#457).
- Common Tasks: Blob garbage collection and Purge Deleted Messages are marked "Modifies data", ask for a simple confirmation, and safe tasks come first (#439).
- Cancel task asks "Keep running" or "Cancel task" (#440).
- Row buttons are named after the item they act on (#492).
- Touch screens: toasts appear at the bottom, tooltips open on tap (#531, #592), and several pages are laid out for phones (#478, #525, #526, #529).
- French uses "Réécriture d'adresse" for mappings.
- Counts use real plurals in the supported languages (#593).

### Fixed

- An address typed but not added, or staged changes, are no longer dropped (#424).
- Edit limits refuses a fractional message count (#454).
- Creation dialogs reopen empty after Close, Cancel or Escape (#456).
- Escape in an open suggestion or icon list closes the list, not the dialog (#460, #475).
- Creating a mailbox that already exists says so (#455).
- Removing a user's last forward also removes the self-forward kept for the copy (#464).
- Cancelling a task that ended meanwhile no longer reports it cancelled.
- Team calendar Members closes after a successful Apply (#476).
- The Registered Users search finds a full name (#410).
- Mail repository downloads release their resources (#489).
- The mail repository Extended view wraps long names (#609).
- Mailing Lists shows a load error alone, without an empty table (#610).
- Network channel grid sorting uses a consistent order (#625).
- The page `lang` follows the language shown (#474).
- Task details no longer show an empty unlabelled list (#612).
- Tier user data marks its retention period as required.
- A refused Sync domain members or Delete all users data is shown in its dialog (#411).
- Team mailbox Members, Extra Senders and folders warn about or refuse other-domain members, invalid senders and empty folder name parts (#547, #548, #549).

### Security

- Domain administrators can no longer rename a user into another domain, add aliases of another domain, copy another tenant's address book, or provision templates from another tenant (#634).
- `X-Content-Type-Options: nosniff` is sent on every nginx response.
- Leaflet is bundled and the channel map geolocation needs an `https` source (GHSA-wgch-mmfq-r383).
- Dependencies are updated for the `npm audit` findings (minimatch, follow-redirects).
- The Docker serve image gets Alpine fixes for libxslt CVE-2026-87636 and CVE-2026-9947 (#632).
