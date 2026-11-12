# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)

## [Unreleased]

### Upgrade instructions

- Geolocation of client IPs on the network channels map is now opt-in: set an https `GEOIP_URL` in `env.js` to enable it. Client IPs are no longer sent in clear text to ip-api.com.
- Regenerate the `webadmin-proxy` profiles of domain administrators (DOMAIN mode) and redeploy them. They are stricter: a profile granting nothing now denies every call, and domain alias writes, `copyFrom` and the Twake Space sync are no longer granted to domain administrators. Aliases, renames and template provisioning are pinned to the administrator's own domain, and the global `/registeredUsers`, `/tasks` and `/mailingLists` routes are never granted.
- Rebuild the Docker image with `docker build --pull`: the serve image now applies Alpine security updates (libxslt CVEs).

### Added

- Destructive confirmations are red, name their verb, open with the focus on Cancel and can require typing DELETE (#412).
- Task Run buttons show their risk (safe, "Modifies data", "Deletes data") in green, orange or red. Task parameters are labelled in plain language with help, units and optional marks (#416, #417).
- Common Tasks are grouped by purpose, each with a description and a filter. Their dialogs are titled after the task, and archiving warns that every event will be moved while no criterion is set (#418, #422, #439).
- Every task is named in plain words in toasts, the Tasks list, the task page and the cancel dialog. Calendar tasks show their user, domain, team calendar or resource (#440, #447, #499).
- Started tasks are followed to the end: a toast reports their status, duration and a link to their details on any page (#440).
- The task page shows a readable summary that refreshes while the task runs (#414, #467, #498).
- The Tasks list follows running tasks by itself, with status chips and counts, a type picker by task name, folded date filters and filters kept in the URL (#480).
- Detail pages have a title, a breadcrumb back to the parent list and a sticky bar with Expand all / Collapse all. Sections remember whether they are open (#425, #428, #445).
- The user page has a summary strip (quota, mailboxes, aliases, forwards, vacation) and a clear "Address without account" state. The calendar user and domain pages get the same strip, and domain pages link to their users (#415, #433, #436, #451).
- Calendar and address book rows show who they are shared with. Shared items say where they come from, and removing them reads "Remove" (#429, #446).
- Registered Users link to the user pages, and both lists explain how they differ (#426).
- Domain pages show resource administrators and team calendar members (#449).
- Health Check is a triage page with an overall banner, causes shown and problems first. UnsentMails links to Unsent Mails (#413).
- Pages without data explain themselves: an empty Event Dead Letter, empty repositories and unavailable features (Mailing Lists, Live Metrics) (#420, #421).
- Event dead letters are readable and can be redelivered from their group page (#434).
- Mail Repositories gets one toolbar line, repository descriptions and repositories holding mails first (#438).
- Quota limits (message count and size) are edited together in one prefilled modal. Each level and the source of the applied limit are shown (#437, #443).
- Every local address links to its user page (#435).
- User fields suggest matching users from three typed characters (#460).
- Forwards ask whether to keep a copy in the mailbox and warn when mail is only forwarded (#431).
- Deleting a domain tells what it still holds and asks for typed confirmation. It also removes the domain's aliases (#432, #457).
- Creation and add actions open a modal that keeps typed values and shows refusals in the dialog. This covers domains, registered users, mappings, mailing lists, mailboxes, aliases, forwards, delegations, labels, identities, team mailboxes and folders, resources, calendars and address books (#456, #473).
- The sidebar is grouped into Monitoring, Accounts and addresses, and Maintenance, including for domain administrators (#442, #483).
- Users and Domains lists are compact and counted. Registered users get the same layout (#444).
- Common Tasks can run the Twake Space reindex and purge tasks. Team mailboxes show, bind and sync their Twake space (#550, #551, #552).
- Warnings before adding a team mailbox member or extra sender from another domain. Folder names with an empty hierarchy part are refused (#547, #548, #549).
- Regex mappings explain the RE2 limits and warn while typing.
- The calendar Delete user data dialog supports the `DavDomainMemberDeletionTaskStep` step (#591).
- The delete confirmation for a registered user states that their calendar delegations are revoked (#590).
- Calendar resources: all 40 icons of the side service are available (#409).
- Domain contacts explain the two address books (#452).
- Domain settings name the system default and explain each setting (#448).

### Changed

- The main calendar reads "Main calendar" instead of "#default", including in exported file names (#427).
- The French wording for mappings is "Réécriture d'adresse".
- Mailing lists, event dead letters and other triage pages share the same toolbars, empty states and hover highlighting.
- Pagination disappears when everything fits on one page (#419).
- Mail repository downloads release their memory once the file is saved (#489).
- Domain administrators' deletion and rename dialogs follow the stricter profiles above.
- Counts use real plurals in every language instead of "(s)" (#535, #593).
- Tier user data marks its retention period as required.
- Blob garbage collection and Purge Deleted Messages are marked "Modifies data" and ask for a confirmation instead of a typed word.
- The cancel-task confirmation reads "Keep running" / "Cancel task".

### Fixed

- A task that ended meanwhile is no longer reported as cancelled.
- Creating a mailbox that already exists says so instead of "created" (#455).
- Fractional message counts in quota limits are refused (#454).
- Removing a user's last forward also removes the self-forward kept for the copy (#464).
- Invalid addresses read "Invalid username" or "Invalid address" instead of "User not found" or "Address without account" (#461, #494).
- The Escape key closes an open suggestion or icon list before the dialog (#460, #475).
- The `lang` attribute of the page follows the interface language (#474).
- Calendar resource edit refuses a blank name and keeps an icon the console doesn't know (#409, #553).
- Registered Users search finds a full name such as "Emma QA" (#410).
- Team calendar Members closes after a successful Apply (#476).
- Mail repository Extended view and Explore User Quota are readable on phones (#525, #526, #609).
- Touch screens: tooltips open on tap and the navigation sheet has a Close button (#530, #531, #592).
- Focus returns to the button that opened a dialog.
- Icon buttons in rows are named after the item they act on (#492).
- A load error on Mailing Lists replaces the list (#610).
- The channel grid sort is consistent (#625).
- Task page Details drop empty unlabelled lists (#612).

### Security

- Domain administrators can no longer rename users into another domain, add aliases of another domain, copy another tenant's address book, provision templates from another tenant, or read other tenants' mailing lists.
- A profile granting nothing now denies every call instead of allowing everything.
- A GET rule now also covers HEAD in the proxy resolver.
- Leaflet is bundled instead of loaded from unpkg. The CSP no longer allows unpkg, and geolocation answers are shown as text (GHSA-wgch-mmfq-r383).
- nginx sends `X-Content-Type-Options: nosniff` on every response.
- npm audit fixes: minimatch (GHSA-g3hv-75wg-m249) and follow-redirects (GHSA-mrwp-f3q8-3g9p).
- The Docker image applies Alpine security updates (#632).

## [1.0.12] - 2026-10-22

### Changed

- Global quota: the users with specific quotas and the aggregated extra quotas reports are now collapsed sections fetched when opened, so they no longer block the display of the page; they are hidden when the profile does not grant their report endpoint (ISSUE-407)
- Health check: the cards of each section are sorted by component name (ISSUE-403)

### Fixed

- Common Tasks: the Trash and Spam cleanup tooltips show the command of their dialog (ISSUE-402)
- Confirm task: a stray "0" is no longer displayed for a task without parameter (ISSUE-404)

## [1.0.11] - 2026-10-22

### Upgrade instructions

- To sign in against an OpenID provider served over plain http (for example a local demo), set `SSO_ALLOW_INSECURE_REQUESTS: "true"` in `env.js`. It is off unless set to the literal `"true"` (#231)

### Added

- Domain and global quota: remove the size limit, with a "Reset to global default" action on a domain quota and a "Remove size limit" action on the Global Quota page (#185)
- Mobile: a menu button opens the sidebar below 768 px, and the sidebar closes after choosing an entry (#154, #202)
- Address Books: the system address books ("My contacts", "Collected contacts") are labelled with a "System" badge and can no longer be edited or deleted (#309)
- Address Books: the Sharing dialog lists the existing sharees, including those of the owner's book from a shared copy, and shared books are named after their source with a link to their owner (#276, #270, #398)
- Booking links: links whose calendar was deleted are flagged "Calendar deleted", inactive links read "Inactive", and availability rules ending before they start or in an unknown time zone are flagged (#358, #364, #359)
- Health Check: each component card writes out its status ("Healthy", "Degraded", "Unhealthy") and the cards are readable (#369, #246)
- Domain Tasks: the Provision templates and Delete all users data dialogs preview the curl command (#354)
- User Tasks: every confirmation dialog previews the WebAdmin call it makes (#332)
- Common Tasks: the Run tooltips show the command with its default parameters (#378, #397)
- Tasks: a single "Task created" toast with a link to the task is shown whenever a task is created (#373)
- Empty-state messages when no user, domain, registered user, unsent mail or mail matches (#175, #204, #305, #324, #355)
- Event Dead Letter: an unknown event ID is reported as not found (#345)
- Task page: cancelling a task asks for confirmation (#351)
- Forms can be submitted with Enter (create mail repository, labels, identities, booking links) (#370)
- Sizes and percentages are formatted in the UI language (#287, #333)
- Keyboard and screen reader accessibility improvements: labelled fields and icon buttons, keyboard-reachable details and help, focus returned after closing dialogs, current page exposed in the sidebar, readable toasts (#117, #139, #149, #166, #169, #180, #181, #183, #184, #205, #206, #208, #210, #212, #233, #234, #243, #248, #254, #274, #280, #340, #346, #350, #353, #357, #365, #367, #393, #394)

### Changed

- Tasks: the whole list is sorted, not only the current page, and is fetched once when the filters are applied (#285, #352)
- Tasks: the end date of failed and cancelled tasks is shown, statuses are translated and task details are displayed as returned by WebAdmin (#325, #344, #241, #219)
- Tasks list: header aligned with rows, rows stacked on phones with full type and dates (#200, #242)
- Error toasts show the WebAdmin message instead of the raw Axios error, printed once (#150, #308, #335, #273)
- Task dialogs stay open until WebAdmin accepts the request, keeping the typed values on failure (#244, #201, #307)
- Dialogs: required fields are reported in place and long words wrap so the buttons stay inside (#141, #337)
- Calendar: documentation links point to the twake-calendar side-service WebAdmin documentation (#265)
- Registered Users: adding a user asks for firstname and lastname, and flags users already registered (#343, #271, #362)
- Domain Admins: only existing users who are not yet admins can be added (#272, #311)
- Delegated users and team mailbox members, extra senders and extra ACL: self-delegation is refused and unknown accounts ask for confirmation (#187, #288)
- Sharing and Delegation: the owner cannot be added as sharee and DAV errors are readable (#264)
- Edit label: the colour cannot be cleared and the current colour is kept (#148, #372)
- Rename user dialog labels the current username and requires the new one (#142)
- Mail repositories: confirmations name the repository (#177)
- Signature templates: Save changes is only shown when the list differs from the saved one (#396)
- Mail repository: the Extended view opens on the mails of the current page (#384)
- Team mailbox folders: the team mailbox root is hidden from the folder list (#211)
- Phones: layouts of list, detail and dialog pages no longer overflow the screen (#129, #147, #162, #189, #303, #306, #318, #341, #348, #361, #375, #283)
- Booking links: the duration can be emptied and retyped, and values below 1 are refused (#315)
- Calendars: the main calendar of a user cannot be deleted, and the colour of calendars is validated (#312, #314)
- Booking links and calendar resources: delegated calendars are named after their owner, resource calendars are no longer offered to their administrator, and resources without a name are tolerated (#399, #275, #316)
- User Address Books: Sharing and visibility are hidden on read-only shared address books (#339)
- Vacation, Explore User Quota, Rate limits, Event Dead Letter and Common Tasks reject invalid values (#178, #291, #347, #144, #245, #151)
- Deleted Message Vault: Search and Restore are blocked while a criterion is incomplete (#342, #356)
- Booking links: the calendar list is refreshed when the section is expanded (#317)
- User detail: every mapping-related section refreshes after a change, and leaving a team mailbox refreshes Allowed From Headers and JMAP Identities (#179, #336)
- Unsent Mails: bulk actions require complete addresses and filters match them exactly (#269)

### Fixed

- Vacation: From/To dates are displayed in the browser time zone (#138)
- Hardcoded English strings are translated (#139, #214, #400, #371, #376, #377)
- Tier user data: the duration is prefilled with 30 days (#140)
- Per user reindexing: the toast counts planned tasks and errors correctly (#145)
- Domain mapping removal uses the right route (#153)
- Domain resource usage no longer blanks the console on an unexpected answer (#157)
- Common tasks: malformed URLs for mapping, JMAP uploads and blob GC tasks fixed (#156)
- Mail repositories: moving mails to another repository, reprocessing, and opening repositories whose path contains a space now work (#155, #177, #290)
- Event Dead Letter: the group total and pagination are computed from its events, and the redeliver limit and maxRetries are sent (#191, #203)
- Tasks: the Cancelled / Cancel Requested filters work (#152)
- Live Metrics shows load errors and empty states (#146)
- Common tasks: the Run error toast is titled correctly and the tooltips no longer cover the previous Run button (#214, #360)
- Users: the domain filter is sorted, and paging restarts at page 1 when a previous filter is revisited (#176, #213)
- User detail: the page is remounted when navigating to another user (#268)
- Booking links: rule count is pluralized correctly (#267)
- Load errors follow language changes (#199)
- User mappings name source types with a translated label (#198)
- Exports show the WebAdmin message when a blob request fails (#273)
- Health Check shows the components when WebAdmin answers 503 (#386)
- Mail repository Extended view shows the repository path again (#349)
- Calendar Resources: a resource with an unknown icon no longer renders a broken image (#316)
- Address Books: no ghost row when the same book is listed twice (#363)
- Delete User Data in the calendar console suggests a calendar step (#266)

### Security

- Profile editor: in DOMAIN mode the quota explorer is scoped to the caller's domain, so another tenant's quotas can no longer be read (#405)

## [1.0.10] - 2026-10-09

### Added

- Health check page now shows sections, and a tooltip with the cause of a failure (#94)
- Calendar domain pages show how many contacts the domain address book and the domain members address book hold, with a refresh button (#96)
- Calendar domain pages can export the domain address book and the domain members address book as vCards, and import a vCard file into the domain address book (#101)
- Calendar domain pages can clear the contacts of the domain address book, optionally restricted to contacts having a mail address in a given source domain (#105)
- Calendar domain pages can copy the users of another domain into the domain address book, with an optional LDAP filter (#113)
- The user lists support server-side pagination, prefix search on the username and filtering by domain (#115)
- Spanish, German and Italian are available in the language selector
- Labels that were hardcoded are now translated, and dates and times are formatted in the UI language

### Fixed

- A domain without signature templates now shows "No signature templates configured." instead of a 404 error (#98)

### Security

- Fixed the vulnerable dependencies reported by npm audit (braces, source-map-js) by migrating to Tailwind CSS v4 and bumping source-map-js (#103, #108)

## [1.0.9] - 2026-09-29

### Added

- Team mailboxes, calendar domain administrators, resources and team calendars are now listed 50 per page (configurable with `VITE_PAGE_LIMIT`) and can be searched by name and by the secondary text shown on each row (ISSUE-86)
- User and domain rate limit forms now include the recipients sent per minute, hour and day limits (ISSUE-87)

### Changed

- Complete Mongolian, Russian and Vietnamese translations (team calendars, domain import and event dead-letter group search), which previously fell back to English (ISSUE-86)
- Improved French translations: team calendars wording, ellipsis, and error messages that now say what failed (ISSUE-86)

## [1.0.8] - 2026-09-25

### Added

- Domains: an Import button next to domain creation imports domains in bulk from a text file, one domain per line (LF or CRLF, `#` and `//` comments allowed). Missing domains are created one by one, a toast reports the created, already existing and failed counts, and a details dialog lists the failures (ISSUE-82)
- Domain > Team calendars and Domain > Resources: a globe button next to each calendar opens the private / public visibility dialog already available for user calendars, using the new `publicRight` webadmin routes of twake-calendar-side-service (ISSUE-84)

## [1.0.7] - 2026-09-22

### Added

- Global quota: the list of users with specific quotas is folded by default and paginated by 20 users (#68, #69)
- Unsent mails: a button to delete all of them, and "delete all" and "resend all" now apply only to the sender and recipient filters typed in the page (#77, #78)
- Users > Calendars and Users > Address books: the number of events or contacts of each collection is displayed, including delegated, subscribed and shared ones (#73)
- Common contacts: contacts can be republished from the admin UI, from the Common tasks page and from the domain detail Tasks section, for bootstrap and repair (#76)
- Domain > Team calendars and Domain > Resources: the number of events of each calendar is displayed, with buttons to export a calendar as an ICS document and import one back (#74, #81)
- Address books: their name and description can be edited, when the endpoint is allowed for the current OIDC client (#75, #80)

### Fixed

- Address books: sharing with the administration right no longer revokes the share, and revoking a share now works, the DAV share access codes having been swapped

## [1.0.6] - 2026-09-17

### Changed

- Front and profile editor aligned with webadmin-proxy (#65)

## [1.0.4] - 2026-08-26

### Added

- Mass delete for mappings (#41)
- Generator of Twake Admin profiles (#54)

### Changed

- Quota views now label the per-user limits of the domain and the user as "Per user limit" instead of the ambiguous "Limits" (#48)
- The Delegated Users section of the user page now describes the direction of delegation: the listed users can access the viewed user's data (#49)

### Fixed

- Mailbox and team-mailbox names containing special characters such as `&` or `*` are no longer rejected upfront by the interface; the validation is left to James, whose error is shown to the user (#42)

### Security

- Dependencies updated for security fixes

## [1.0.3] - 2026-07-17

### Added

- Calendar user page: users not yet registered on the DAV server are now stated explicitly, with a button to register them when the admin is allowed to (#36)
- Mailing lists can now be created, deleted, and have their members and owners added or removed from the page, when the backend exposes the write routes and the admin is allowed to (#38)
- Mappings page: group members can now be removed with a delete icon on Group rows, when the admin is allowed to (#40)

### Fixed

- Calendar user page no longer shows a wall of errors for users that are not registered on the DAV server yet (#36)

## [1.0.2] - 2026-07-10

### Added

- Address Books section on the user page (CALENDAR): list, create and delete a user's address books, set their public visibility and manage their sharees.
- Russian, Vietnamese and Mongolian translations (#6). The language selector is now a dropdown listing all supported languages.
- Booking links now have an optional name and description, which can be set in the create and edit dialogs and are shown in the list (#9).
- Booking links now have a color (default `#6B4ECC`), chosen with a color picker in the create and edit dialogs and shown as a swatch in the list (#32).
- Mail template provisioning (#11).
- Booking link event clean up action: delete every calendar event created through a given booking link (#16).
- Team Calendars section on the calendar domain page: list, create, rename and delete the team calendars of a domain (#18).
- Team calendar member management: view, add, change the role of and remove the members of a team calendar (#30).
- Per user reindexing button in the mail common tasks (#20).
- Domain mapping creation from the Mappings page (#23).
- Read-only Mailing Lists page listing LDAP mailing lists, with search, pagination and the members, owners and business category of each list (#26).
- `maxIterations` and `autoMerge` parameters for the mailbox SolveInconsistencies task, exposed in its confirmation dialog (#34).

### Changed

- Booking link administration improved (#21).
- Booking link create and edit dialogs only offer the calendars the user can write to, excluding read-only shares and resource calendars (#28).

### Fixed

- Duplicated query parameters in the command preview of the task confirmation dialog (#14).

### Security

- Stricter Content Security Policy.
- Cookies are now marked secure.
- Safer HTML rendering in the mailRepository and eventDeadLetter pages.

## [1.0.0] - 2026-06-24

### Added

- Health check page showing the state of the James server
- Mail repositories: browse, view mails (JSON/MIME), paginate, copy a mail key, remove a single mail, reprocess mails (individually, asking for a processor and queue), filter, create repositories and move mails between them
- Event dead letter management: list failed events by group, display the full error, redeliver and delete events
- Common tasks page with customizable task parameters, task detail page and tasks list with pagination
- Mailbox inconsistencies fix task and cleanup of old tasks
- Authentication support, then OIDC login with a session store for OIDC tokens and logout handling
- User management: list users, rename, delete user data, per-user reindexing, subscription and preview tasks, username validation
- Mailbox management: create, read, update, delete, mailbox count, mailbox ID display and search, clear mailbox content, delete all mailboxes
- User quota management, quota search and global quotas
- Alias, forward and address mapping management, including regex mappings, removal of every mapping type, a list of all mappings and a mappings section on the user page
- User restored messages, deleted message vault browser, purge, restore button and message search
- Label management
- User vacation handling
- User network channels, global channels, channel grid with source IP and search, IP world map and user agent pie chart
- Certificate reload
- Domain management: list, create, delete, quota, aliases, data deletion, contacts, signature and settings
- Team mailbox management: CRUD, members, folders, quotas, folder rights, sub-addressing control, extra ACLs, extra senders, deleted message vault and a section in the user page
- Live metrics, rate limiting and Cassandra sections
- Delegated user management, allowed From header and JMAP identities (with a button to delete them)
- Reindexing of contacts from the Sent mailbox
- Utilities for Spam and Trash cleanup
- Management of user settings and reports on JMAP settings
- Registered users: delete, filter and scope by domain, with a warning when editing
- Email query view re-computation
- Data tiering
- Twake Calendar Admin imported into this project: list, create, edit and delete calendars and entries, manage public visibility and sharing, domain member deletion, ldapFilters handling upon domain member sync, and booking link management
- Domain mode with multi-tenancy for resources, registered users and tasks, and clarified role of calendar domain admins
- French translation
- Adaptive, responsive UI with a new sidebar, pagination controls and the Twake Calendar styling
- Docker packaging (Dockerfile, Docker Compose and published image) with `VITE_API_BASE_URL` configurable through environment variables
- Licensed under AGPL-V3

### Changed

- Docker now requires `env.js` to run
- Functional admin merged into the global admin
- Channel pagination adapted for JAMES-4091

### Fixed

- Mail repository pagination and reprocess API calls
- Event dead letter count and size
- `bun run dev` repaired
- Unwanted 403 errors
- Several reported vulnerabilities (npm audit and dependency CVEs)

### Upgrade instructions

- Provide an `env.js` when running the Docker image, and set `VITE_API_BASE_URL` through environment variables to point to the James admin API
