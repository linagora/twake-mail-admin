# Self-adaptive frontend — endpoint inventory

> **Purpose:** list every API call made by each page, section, and action button.  
> Legend: **MUST** = component hidden if forbidden · **MAY** = degraded but still shown

## Resolver rules (validated)

- **Fallbacks ignored**: only the domain-scoped pattern is evaluated (e.g. `/domains/{domain}/resources`). Legacy fallback patterns are not declared as required.
- **Query strings included**: the resolver compares verb + path + query string (e.g. `/users/{username}/mailboxes?task=reIndex` is distinct from `/users/{username}/mailboxes`).
- **DOMAIN mode — tasks**: only `/domains/{domain}/tasks/{id}` is evaluated (the global `/tasks/{id}` pattern is ignored in DOMAIN mode).
- **`.proxy/` calls**: never blocked, not subject to evaluation.
- **`Accept` header**: ignored by the resolver (download and regular GET share the same pattern).
- **Gate ≠ call**: a number of components ask the resolver about one pattern and then call another — almost always the bare path while the call carries a query string. Because query strings are compared, **both must be granted** or the control never renders. They are all listed under [Permission gates that differ from the call](#permission-gates-that-differ-from-the-call).
- **Two left bars**: GLOBAL and DOMAIN mode do not share a page tree. See [DOMAIN mode left bar](#domain-mode-left-bar).
- **Application scope**: MAIL and CALENDAR mount different components. Every section below is annotated `MAIL`, `CALENDAR`, or both.

---

## Permission gates that differ from the call

A component asks the resolver about one pattern and then calls another. Since the
resolver compares the query string, the two are unrelated rules: **grant only the
call and the control is never rendered; grant only the gate and pressing it
fails**. Both belong in a profile.

Almost every case is the same shape — the gate is the bare path, the call carries
a task or action parameter.

| Gate the component evaluates | Call it actually makes |
|---|---|
| `DELETE /blobs` | `DELETE /blobs?scope=unreferenced&{params}` |
| `DELETE /deletedMessages` | `DELETE /deletedMessages?scope=expired` |
| `DELETE /jmap/uploads` | `DELETE /jmap/uploads?scope=expired&{params}` |
| `DELETE /mappings/sources/{username}` | `DELETE /mappings/sources/{username}?type={type}` |
| `DELETE /messages` | `DELETE /messages?mailbox={mailbox}&olderThan={date}&useSavedDate` |
| `DELETE /messages?mailbox=Spam` | `DELETE /messages?mailbox={mailbox}&olderThan={date}&useSavedDate` |
| `DELETE /messages?mailbox=Trash` | `DELETE /messages?mailbox={mailbox}&olderThan={date}&useSavedDate` |
| `DELETE /registeredUsers` | `DELETE /registeredUsers?email={email}` |
| `DELETE /tasks` | `DELETE /tasks?olderThan={days}day` |
| `GET /quota/users?minOccupationRatio={min}&maxOccupationRatio={max}&limit={limit}&offset={offset}&domain={domain}` | `GET /quota/users?minOccupationRatio={min}&maxOccupationRatio={max}&limit={limit}&offset={offset}` |
| `GET /tasks` | `GET /tasks?{query_params}` |
| `PATCH /registeredUsers` | `PATCH /registeredUsers?id={id}` |
| `POST /addressbook/domain-members/{domain}` | `POST /addressbook/domain-members/{domain}?task=sync` |
| `POST /calendars/{username}` | `POST /calendars/{username}?task=archive` |
| `POST /cassandra/mappings` | `POST /cassandra/mappings?action=SolveInconsistencies&{params}` |
| `POST /deletedMessages/users/{username}` | `POST /deletedMessages/users/{username}?action=restore` |
| `POST /domains/{domain}/templates` | `POST /domains/{domain}/templates?action=provision&{params}` |
| `POST /events/deadLetter/groups/{group}` | `POST /events/deadLetter/groups/{group}?action=reDeliver` |
| `POST /mailboxes` | `POST /mailboxes?{params}` |
| `POST /messages` | `POST /messages?{params}` |
| `POST /quota/users` | `POST /quota/users?{params}` |
| `POST /servers` | `POST /servers?reload-certificate` |
| `POST /team-mailboxes` | `POST /team-mailboxes?action=repositionSystemRights` |
| `POST /users` | `POST /users?{params}` |
| `POST /users/{username}/mailboxes` | `POST /users/{username}/mailboxes?task=reIndex`<br>`POST /users/{username}/mailboxes?task=subscribeAll`<br>`POST /users/{username}/mailboxes?task=recomputeFastViewProjectionItems` |
| `POST /users/{username}/mails` | `POST /users/{username}/mails?limit={limit}&offset={offset}` |
| `POST /users/{username}/rename/{newUser}` | `POST /users/{username}/rename/{newUsername}?action=rename` |
| `POST /users/{username}/templates` | `POST /users/{username}/templates?action=provision&{params}` |
| `PUT /mailRepositories/{encodedPath}` | `PUT /mailRepositories/{encodedPath}?protocol={protocol}` |

The gate patterns are also the reason a rule cannot simply be written against the
documented call. They are kept in step by
`profile-editor/twake_profile_editor/inventory.py` (the `gates=` field) and
checked by `profile-editor/tests/test_frontend_crosscheck.py`, which fails when a
component starts gating on something no rule grants.

---

## DOMAIN mode left bar

GLOBAL and DOMAIN mode do **not** share a page tree. In DOMAIN mode the frontend
mounts a different sidebar and a different route table
(`modules/domain-admin/`): there is no domain list, no global user list and no
health check page, and what are sections of a domain in GLOBAL mode become
top-level entries.

### APPLICATION:"MAIL" — `domain-admin/domain-sidebar.tsx`

| Left bar entry | Gated on |
|---|---|
| Users | `GET /domains/{domain}/users` |
| Domain aliases | `GET /domains/{domain}/aliases` |
| Team mailboxes | `GET /domains/{domain}/team-mailboxes` |
| Quota | `GET /quota/domains/{domain}` |
| Rate limiting | `GET /domains/{domain}/ratelimits` |
| Mailing lists | `GET /mailingLists` |
| Tasks | `GET /tasks` |

### APPLICATION:"CALENDAR" — `domain-admin/calendar-domain-sidebar.tsx`

| Left bar entry | Gated on |
|---|---|
| Calendar admins | `GET /domains/{domain}/admins` |
| Resources | `GET /domains/{domain}/resources` |
| Users | `GET /domains/{domain}/users` |
| Registered users | `GET /registeredUsers` |
| Calendar settings | `GET /domains/{domain}/settings` |
| Tasks | `GET /tasks` |

The user detail page is reachable from the Users entry in both applications
(`user/:username`), so every *User detail* section below applies in DOMAIN mode
too — gated by the domain Users page rather than by `GET /users`.

---

## App bootstrap

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| App init (DOMAIN mode only) | GET | `/.proxy/myDomain` | — (never blocked) |

---

## Health check (default route)

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Page load | GET | `/healthcheck` | MUST |

---

## Domains

### Domain list

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Page load | GET | `/domains` | MUST |

### Domain detail — Aliases tab *(APPLICATION:"MAIL")*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Tab load | GET | `/domains/{domain}/aliases` | MUST |
| "Add alias" button | PUT | `/domains/{domain}/aliases/{source}` | MAY (do not show the button) |
| "Delete alias" button | DELETE | `/domains/{domain}/aliases/{source}` | MAY (do not show the button) |

### Domain detail — Users tab *(DOMAIN mode: this is the domain admin Users page)*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Tab load | GET | `/domains/{domain}/users` | MUST |

### Domain detail — Quota tab *(APPLICATION:"MAIL")*

The usage figures come from the same call as the tab load; there is no second endpoint.

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Tab load, and domain quota usage section | GET | `/quota/domains/{domain}` | MUST |
| Save quota form | PUT | `/quota/domains/{domain}` | MAY (do not show quota update options) |

### Domain detail — Rate limits tab *(APPLICATION:"MAIL")*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Tab load | GET | `/domains/{domain}/ratelimits` | MUST |
| Save button | PUT | `/domains/{domain}/ratelimits` | MAY (do not show update options) |

### Domain detail — Contacts tab *(APPLICATION:"MAIL")*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Tab load | GET | `/domains/{domain}/contacts` | MUST |
| Contact detail load | GET | `/domains/{domain}/contacts/{username}` | MUST |
| "Create contact" button | POST | `/domains/{domain}/contacts` | MAY (do not show the button if missing) |
| "Edit contact" form | PUT | `/domains/{domain}/contacts/{username}` | MAY (do not show the button if missing)|
| "Delete contact" button | DELETE | `/domains/{domain}/contacts/{username}` | MAY (do not show the button if missing) |

### Domain detail — Team mailboxes tab *(APPLICATION:"MAIL")*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Tab load | GET | `/domains/{domain}/team-mailboxes` | MUST |
| "Create team mailbox" button | PUT | `/domains/{domain}/team-mailboxes/{name}` | MAY (do not show the button if missing) |
| "Delete team mailbox" button | DELETE | `/domains/{domain}/team-mailboxes/{name}` | MAY (do not show the button if missing) |

#### Team mailbox detail — Members sub-tab

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Sub-tab load | GET | `/domains/{domain}/team-mailboxes/{mailbox}/members` | MUST |
| "Add member" button | PUT | `/domains/{domain}/team-mailboxes/{mailbox}/members/{username}` | MAY (do not show the button if missing) |
| "Remove member" button | DELETE | `/domains/{domain}/team-mailboxes/{mailbox}/members/{username}` | MAY (do not show the button if missing) |

#### Team mailbox detail — Extra senders sub-tab

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Sub-tab load | GET | `/domains/{domain}/team-mailboxes/{mailbox}/extraSenders` | MUST |
| "Add sender" button | PUT | `/domains/{domain}/team-mailboxes/{mailbox}/extraSenders/{username}` | MAY (do not show the button if missing) |
| "Remove sender" button | DELETE | `/domains/{domain}/team-mailboxes/{mailbox}/extraSenders/{username}` | MAY (do not show the button if missing) |

#### Team mailbox detail — Quota sub-tab

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Sub-tab load | GET | `/domains/{domain}/team-mailboxes/{mailbox}/quota` | MUST |
| Save quota form | PUT | `/domains/{domain}/team-mailboxes/{mailbox}/quota/limit/size` | MAY (do not show the button if missing) |
| "Clear quota" button | DELETE | `/domains/{domain}/team-mailboxes/{mailbox}/quota/limit/size` | MAY (do not show the button if missing) |

#### Team mailbox detail — Folders sub-tab

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Sub-tab load | GET | `/domains/{domain}/team-mailboxes/{mailbox}/mailboxes` | MUST |
| Folder message count | GET | `/domains/{domain}/team-mailboxes/{mailbox}/mailboxes/{folderName}/messageCount` | MAY |
| Folder unseen count | GET | `/domains/{domain}/team-mailboxes/{mailbox}/mailboxes/{folderName}/unseenMessageCount` | MAY |
| "Create folder" button | PUT | `/domains/{domain}/team-mailboxes/{mailbox}/mailboxes/{folderName}` | MAY (do not show the button if missing) |
| "Delete folder" button | DELETE | `/domains/{domain}/team-mailboxes/{mailbox}/mailboxes/{folderName}` | MAY (do not show the button if missing) |
| Subaddressing status | GET | `/domains/{domain}/team-mailboxes/{mailbox}/mailboxes/{folderName}/subaddressing` | MAY |
| Toggle subaddressing | PUT | `/domains/{domain}/team-mailboxes/{mailbox}/mailboxes/{folderName}/subaddressing` | MAY (do not show the button if missing) |
| Extra ACL tab load | GET | `/domains/{domain}/team-mailboxes/{mailbox}/mailboxes/{folderName}/extraAcl` | MUST |
| "Add ACL entry" button | PUT | `/domains/{domain}/team-mailboxes/{mailbox}/mailboxes/{folderName}/extraAcl/{username}` | MAY (do not show the button if missing) |
| "Remove ACL entry" button | DELETE | `/domains/{domain}/team-mailboxes/{mailbox}/mailboxes/{folderName}/extraAcl/{username}` | MAY (do not show the button if missing) |
| "Clear all ACL" button | DELETE | `/domains/{domain}/team-mailboxes/{mailbox}/mailboxes/{folderName}/extraAcl` | MAY (do not show the button if missing) |

### Domain detail — Signature templates section *(APPLICATION:"MAIL")*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Section load | GET | `/domains/{domain}/signature-templates` | MUST (do not show the section if forbidden) |
| "Save signatures" form | PUT | `/domains/{domain}/signature-templates` | MAY (do not show the form controls if missing) |
| "Delete signatures" button | DELETE | `/domains/{domain}/signature-templates` | MAY (do not show the button if missing) |

### Domain detail — JMAP settings report section *(APPLICATION:"MAIL")*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Section load | GET | `/jmap/settings/reports` | MUST (do not show the section if forbidden) |

### Domain detail — Tasks section *(APPLICATION:"MAIL")*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| "Apply signature templates" button | POST | `/domains/{domain}/signature-templates?action=apply` | MAY (do not show the button if missing) |
| "Provision templates" button | POST | `/domains/{domain}/templates?action=provision&{params}` | MAY (do not show the button if missing) |

### Domain actions

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| "Create domain" button | PUT | `/domains/{domain}` | MAY (do not show the button if missing) |
| "Delete domain" button | DELETE | `/domains/{domain}` | MAY (do not show the button if missing) |
| "Delete all data" button | POST | `/domains/{domain}?action=deleteData` | MAY (do not show the button if missing) |

#### Team mailbox detail — Deleted messages sub-tab

Rendered by `team-mailbox-detail.tsx`, not by the domain detail page.

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| "Search deleted messages" button | POST | `/deletedMessages/users/{mailbox@domain}/messages?force=true` | MAY (disable search button if missing) |
| "Restore messages" button | POST | `/deletedMessages/teamMailbox/{mailbox@domain}?action=restore` | MAY (disable restore button if missing) |

Note: if none are present, hide the deleted message vault.

### Domain detail — Calendar: Admins tab *(APPLICATION:"CALENDAR" only)*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Tab load | GET | `/domains/{domain}/admins` | MUST |
| "Add admin" button | PUT | `/domains/{domain}/admins/{username}` | MAY (do not show the button if missing) |
| "Remove admin" button | DELETE | `/domains/{domain}/admins/{username}` | MAY (do not show the button if missing) |

### Domain detail — Calendar: Resources tab *(APPLICATION:"CALENDAR" only)*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Tab load | GET | `/domains/{domain}/resources` | MUST |
| Resource detail load | GET | `/domains/{domain}/resources/{resourceId}` | MUST |
| "Create resource" button | POST | `/domains/{domain}/resources` | MAY (do not show the button if missing) |
| "Delete resource" button | DELETE | `/domains/{domain}/resources/{resourceId}` | MAY (do not show the button if missing) |
| "Edit resource" form | PATCH | `/domains/{domain}/resources/{resourceId}` | MAY (do not show the button if missing) |
| "Reposition write rights" button | POST | `/domains/{domain}/resources?task=repositionWriteRights` | MAY (do not show the button if missing) |

### Domain detail — Calendar: Team calendars section *(APPLICATION:"CALENDAR" only)*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Section load | GET | `/domains/{domain}/team-calendars` | MUST (hide the whole section if forbidden) |
| "Create team calendar" button | POST | `/domains/{domain}/team-calendars` | MAY (do not show the button if missing) |
| "Edit team calendar" button | PATCH | `/domains/{domain}/team-calendars/{teamCalendarId}` | MAY (do not show the button if missing) |
| "Delete team calendar" button | DELETE | `/domains/{domain}/team-calendars/{teamCalendarId}` | MAY (do not show the button if missing) |
| "Manage members" button | GET | `/domains/{domain}/team-calendars/{teamCalendarId}/members` | MAY (do not show the button if missing) |
| "Add/change/remove member" apply | POST | `/domains/{domain}/team-calendars/{teamCalendarId}/members/invitee` | MAY (read-only members view if missing) |

### Domain detail — Calendar: Sync members *(APPLICATION:"CALENDAR" only)*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| "Sync members" button | POST | `/addressbook/domain-members/{domain}?task=sync` | MAY (do not show the button if missing) |

### Domain detail — Calendar: Settings section *(APPLICATION:"CALENDAR" only)*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Foldable section load | GET | `/domains/{domain}/settings` | MUST (do not show the section if forbidden) |
| "Save settings" button | PUT | `/domains/{domain}/settings` | MAY (do not show the form controls / save button if missing) |

---

## Users

### User list

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Page load | GET | `/users` | MUST |

### User detail — Mailboxes tab *(APPLICATION:"MAIL")*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Tab load | GET | `/users/{username}/mailboxes` | MUST |
| Mailbox message count | GET | `/users/{username}/mailboxes/{mailboxName}/messageCount` | MAY |
| Mailbox unseen count | GET | `/users/{username}/mailboxes/{mailboxName}/unseenMessageCount` | MAY |
| "Create mailbox" button | PUT | `/users/{username}/mailboxes/{mailboxName}` | MAY (do not show the button if missing) |
| "Delete mailbox" button | DELETE | `/users/{username}/mailboxes/{mailboxName}` | MAY (do not show the button if missing) |
| "Clear mailbox" button | DELETE | `/users/{username}/mailboxes/{mailboxName}/messages` | MAY (do not show the button if missing) |
| "Delete all mailboxes" button | DELETE | `/users/{username}/mailboxes` | MAY (do not show the button if missing) |
| "Reindex mailboxes" button | POST | `/users/{username}/mailboxes?task=reIndex` | MAY (do not show the button if missing) |
| "Subscribe all" button | POST | `/users/{username}/mailboxes?task=subscribeAll` | MAY (do not show the button if missing) |
| "Recompute projection" button | POST | `/users/{username}/mailboxes?task=recomputeFastViewProjectionItems` | MAY (do not show the button if missing) |

### User detail — Quota tab *(APPLICATION:"MAIL")*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Tab load | GET | `/quota/users/{username}` | MUST |
| Save quota form | PUT | `/quota/users/{username}/size` | MAY (do not show the button if missing) |
| "Clear quota" button | DELETE | `/quota/users/{username}/size` | MAY (do not show the button if missing) |

### User detail — Aliases tab *(APPLICATION:"MAIL")*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Tab load | GET | `/address/aliases/{username}` | MUST |
| "Add alias" button | PUT | `/address/aliases/{username}/sources/{alias}` | MAY (do not show the button if missing) |
| "Remove alias" button | DELETE | `/address/aliases/{username}/sources/{alias}` | MAY (do not show the button if missing)|

### User detail — Forwards tab *(APPLICATION:"MAIL")*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Tab load | GET | `/address/forwards/{username}` | MUST |
| "Add forward" button | PUT | `/address/forwards/{username}/targets/{destination}` | MAY (do not show the button if missing) |
| "Remove forward" button | DELETE | `/address/forwards/{username}/targets/{destination}` | MAY (do not show the button if missing) |

### User detail — Vacation tab *(APPLICATION:"MAIL")*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Section open | GET | `/vacation/{username}` | MUST |
| "Save vacation" button | POST | `/vacation/{username}` | MAY (do not show the button if missing) |
| "Delete vacation" button | DELETE | `/vacation/{username}` | MAY (do not show the button if missing) |

### User detail — Identities tab *(APPLICATION:"MAIL")*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Tab load | GET | `/users/{username}/identities` | MUST |
| "Create identity" button | POST | `/users/{username}/identities` | MAY (do not show the button if missing) |
| "Edit identity" form | PUT | `/users/{username}/identities/{identityId}` | MAY (do not show the button if missing) |
| "Delete identity" button | DELETE | `/users/{username}/identities/{identityId}` | MAY (do not show the button if missing) |

### User detail - allowed from header section *(APPLICATION:"MAIL")*

| Allowed from headers (detail load) | GET | `/users/{username}/allowedFromHeaders` | MUST |

### User detail — Delegated users tab *(APPLICATION:"MAIL")*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Tab load | GET | `/users/{username}/authorizedUsers` | MUST |
| "Add delegated user" button | PUT | `/users/{username}/authorizedUsers/{delegated}` | MAY (do not show the button if missing) |
| "Remove delegated user" button | DELETE | `/users/{username}/authorizedUsers/{delegated}` | MAY (do not show the button if missing) |

### User detail — Channels tab *(APPLICATION:"MAIL")*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Tab load | GET | `/servers/channels/{username}` | MUST |
| "Disconnect channels" button | DELETE | `/servers/channels/{username}` | MAY (do not show the button if missing) |

### User detail — Rate limits tab *(APPLICATION:"MAIL")*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Tab load | GET | `/users/{username}/ratelimits` | MUST |
| Save button | PUT | `/users/{username}/ratelimits` | MAY (do not show the button if missing) |

### User detail — Mappings tab *(APPLICATION:"MAIL")*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Tab load | GET | `/mappings/user/{username}` | MUST |
| Mapping sources | GET | `/mappings/sources/{username}?type={type}` | MUST |
| "Delete mapping sources" button | DELETE | `/mappings/sources/{username}?type={type}` | MAY (do not show the button if missing) |

### User detail — Labels tab *(APPLICATION:"MAIL")*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Tab load | GET | `/users/{username}/labels` | MUST |
| "Create label" button | POST | `/users/{username}/labels` | MAY (do not show the button if missing) |
| "Edit label" form | PATCH | `/users/{username}/labels/{labelId}` | MAY (do not show the button if missing) |
| "Delete label" button | DELETE | `/users/{username}/labels/{labelId}` | MAY (do not show the button if missing) |

### User detail — Deleted messages tab *(APPLICATION:"MAIL")*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| "Search deleted messages" button | POST | `/deletedMessages/users/{username}/messages` | MAY (do not show the button if missing) |
| "Restore messages" button | POST | `/deletedMessages/users/{username}?action=restore` | MAY (do not show the button if missing) |

Same than for team mailbox: if both are missing do not display the section...

### User detail — Team mailboxes tab *(APPLICATION:"MAIL")*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Tab load | GET | `/users/{username}/team-mailboxes` | MUST |
| "Leave" button | DELETE | `/domains/{domain}/team-mailboxes/{mailbox}/members/{username}` | MAY (do not show the button if missing) |

### User detail — Message search tab *(APPLICATION:"MAIL")*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| "Search messages" button | POST | `/users/{username}/mails?limit={limit}&offset={offset}` | MUST |

### User detail — Tasks section *(APPLICATION:"MAIL")*

Rendered by `user-tasks.tsx`. Every button of the panel gates on a pattern that
differs from the call it makes — see [Permission gates that differ from the call](#permission-gates-that-differ-from-the-call).

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| "Cleanup mailbox" button | DELETE | `/messages?mailbox={mailbox}&olderThan={date}&useSavedDate` | MAY (do not show the button if missing) |
| "Tier user data" button | POST | `/users/{username}/data?tiering={tiering}` | MAY (do not show the button if missing) |
| "Provision templates" button | POST | `/users/{username}/templates?action=provision&{params}` | MAY (do not show the button if missing) |

### User detail — JMAP settings section *(APPLICATION:"MAIL")*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Section load | GET | `/users/{username}/jmap/settings` | MUST (do not show the section if forbidden) |
| "Save settings" form | PUT | `/users/{username}/jmap/settings` | MAY (do not show the form controls if missing) |

### User actions

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| "Rename user" button | POST | `/users/{username}/rename/{newUsername}?action=rename` | MAY (do not show the button if missing) |
| "Delete user data" button | POST | `/users/{username}?action=deleteData` | MAY (do not show the button if missing) |

### User detail — Calendar: Archive events *(APPLICATION:"CALENDAR" only)*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| "Archive events" button | POST | `/calendars/{username}?task=archive` | MAY (do not show the button if missing)|

### User detail — Calendar: Calendars section *(APPLICATION:"CALENDAR" only)*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Section load | GET | `/users/{username}/calendars` | MUST (hide the whole section if missing) |
| "Create calendar" button (+) | POST | `/users/{username}/calendars` | MAY (do not show the + if missing) |
| "Edit calendar" button (pencil) | PATCH | `/users/{username}/calendars/{calendarId}` | MAY (do not show the pencil icon if missing) |
| "Public visibility" button (eye) | POST | `/users/{username}/calendars/{calendarId}/publicRight` | MAY (do not show the eye icon if missing) |
| "Invitees / delegation" button (users) | POST | `/users/{username}/calendars/{calendarId}/invitee` | MAY (do not show the users icon if missing) |
| Invitee email existence check | HEAD | `/users/{username}` | MAY |
| Owner email resolution (delegated/subscription) | GET | `/registeredUsers` | MAY (owner line hidden if missing) |
| "Delete calendar" button (trash) | DELETE | `/users/{username}/calendars/{calendarId}` | MAY (do not show the trash icon if missing) |

### User detail — Calendar: Address books section *(APPLICATION:"CALENDAR" only)*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Section load | GET | `/users/{username}/addressbooks` | MUST (hide the whole section if missing) |
| "Create address book" button | POST | `/users/{username}/addressbooks` | MAY (do not show the button if missing) |
| "Delete address book" button | DELETE | `/users/{username}/addressbooks/{addressBookId}` | MAY (do not show the button if missing) |
| "Public visibility" button | POST | `/users/{username}/addressbooks/{addressBookId}/publicRight` | MAY (do not show the button if missing) |
| "Invitees / delegation" button | POST | `/users/{username}/addressbooks/{addressBookId}/invitee` | MAY (do not show the button if missing) |

### User detail — Calendar: Booking links section *(APPLICATION:"CALENDAR" only)*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Section load | GET | `/users/{username}/booking-links` | MUST (hide the whole section if missing) |
| "Create booking link" button | POST | `/users/{username}/booking-links` | MAY (do not show the button if missing) |
| "Edit booking link" form | PATCH | `/users/{username}/booking-links/{publicId}` | MAY (do not show the button if missing) |
| "Delete booking link" button | DELETE | `/users/{username}/booking-links/{publicId}` | MAY (do not show the button if missing) |
| "Regenerate link" button | POST | `/users/{username}/booking-links/{publicId}/reset` | MAY (do not show the button if missing) |
| "Delete booked events" button | POST | `/users/{username}/booking-links/{publicId}?action=deleteEvents` | MAY (do not show the button if missing) |

### User detail — Calendar: registration *(APPLICATION:"CALENDAR" only)*

Shown when the user exists in Twake Mail but is not yet a registered calendar user.

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Registration status load | GET | `/registeredUsers` | MUST (hide the whole detail page if missing) |
| "Register user" button | POST | `/registeredUsers` | MAY (do not show the button if missing) |

### User quota explorer (inline component) *(APPLICATION:"MAIL")*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| "Search by occupation ratio" button | GET | `/quota/users?minOccupationRatio={min}&maxOccupationRatio={max}&limit={limit}&offset={offset}` | MUST |

---

## Mailing lists *(APPLICATION:"MAIL")*

### Mailing list list

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Page load | GET | `/mailingLists` | MUST |
| "Create mailing list" form | PUT | `/mailingLists/{address}` | MAY (do not show the form if missing) |
| "Delete mailing list" button | DELETE | `/mailingLists/{address}` | MAY (do not show the button if missing) |

### Mailing list detail *("Show details" row)*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Detail load | GET | `/mailingLists/{address}` | MUST |
| "Add member" button | PUT | `/mailingLists/{address}/members/{member}` | MAY (do not show the button if missing) |
| "Remove member" button | DELETE | `/mailingLists/{address}/members/{member}` | MAY (do not show the button if missing) |
| "Add owner" button | PUT | `/mailingLists/{address}/owners/{owner}` | MAY (do not show the button if missing) |
| "Remove owner" button | DELETE | `/mailingLists/{address}/owners/{owner}` | MAY (do not show the button if missing) |

Note: the sidebar entry (both GLOBAL and DOMAIN mode) is gated on `GET /mailingLists`.
In DOMAIN mode the actual call carries a `?domain={domain}` query string, which the
"query strings included" resolver rule would make a distinct pattern — to be confirmed
against what the proxy actually declares.

---

## Mail repositories *(APPLICATION:"MAIL", GLOBAL mode)*

### Repository list

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Page load | GET | `/mailRepositories` | MUST |
| "Create repository" button | PUT | `/mailRepositories/{encodedPath}?protocol={protocol}` | MAY (do not show the button if missing) |

### Repository detail

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Detail load — info | GET | `/mailRepositories/{encodedPath}` | MUST |
| Detail load — mail keys | GET | `/mailRepositories/{encodedPath}/mails` | MUST |
| "Clear all mails" button | DELETE | `/mailRepositories/{encodedPath}/mails` | MAY (do not show the button if missing) |
| "Reprocess all" button | PATCH | `/mailRepositories/{encodedPath}/mails?action=reprocess` | MAY (do not show the button if missing) |
| "Move all mails" button | PATCH | `/mailRepositories/{encodedPath}/mails` | MAY (do not show the button if missing) |
| Mail detail load | GET | `/mailRepositories/{encodedPath}/mails/{mailKey}` | MUST |
| "Download mail" button | GET | `/mailRepositories/{encodedPath}/mails/{mailKey}` (Accept: message/rfc822) | MAY |
| "Reprocess mail" button | PATCH | `/mailRepositories/{encodedPath}/mails/{mailKey}?action=reprocess` | MAY (do not show the button if missing) |
| "Move mail" button | PATCH | `/mailRepositories/{encodedPath}/mails/{mailKey}` | MAY (do not show the button if missing) |
| "Delete mail" button | DELETE | `/mailRepositories/{encodedPath}/mails/{mailKey}` | MAY (do not show the button if missing) |

---

## Event dead-letter *(APPLICATION:"MAIL", GLOBAL mode)*

### Group list

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Page load | GET | `/events/deadLetter/groups` | MUST |
| "Redeliver all" button | POST | `/events/deadLetter?action=reDeliver` | MAY (do not show the button if missing) |

### Group detail

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Detail load | GET | `/events/deadLetter/groups/{group}` | MUST |
| "Redeliver group" button | POST | `/events/deadLetter/groups/{group}?action=reDeliver` | MAY (do not show the button if missing) |
| "Delete all group events" button | DELETE | `/events/deadLetter/groups/{group}` | MAY (do not show the button if missing) |
| Event detail load | GET | `/events/deadLetter/groups/{group}/{insertionId}` | MUST - disable link if not supported|
| "Delete event" button | DELETE | `/events/deadLetter/groups/{group}/{insertionId}` | MAY (do not show the button if missing) |

### Search by event ID

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| "Search by event ID" subsection | GET | `/events/deadLetter?eventId={eventId}` | MAY (do not show the subsection if missing) |
| "Group" narrowing input | GET | `/events/deadLetter?eventId={eventId}&group={group}` | MAY (do not show the input if missing) |

---

## Global quota *(APPLICATION:"MAIL", GLOBAL mode)*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Page load | GET | `/quota` | MUST |
| Save quota form | PUT | `/quota` | MAY (do not show the button if missing) |
| Report: users with specific quotas | GET | `/reports/quota/users?hasSpecificQuota` | MAY (do not show the section if missing)|
| Report: quota summary | GET | `/reports/quota/users/sum?hasSpecificQuota` | MAY (do not show the button if missing) |
| Global quota usage section open | GET | `/quota/sum` | MUST (do not show the section if forbidden) |

---

## Tasks

A left bar entry in both modes; the detail pattern differs, see the two snackbar sections below.

| Trigger | Verb | Pattern | MUST/MAY | Mode |
|---------|------|---------|----------|------|
| Page load | GET | `/tasks?{query_params}` | MUST | GLOBAL |
| Task detail load | GET | `/tasks/{id}` | MUST | GLOBAL |
| "Cancel task" button | DELETE | `/tasks/{id}` | MAY (do not show the button if missing) | GLOBAL |

## Tasks snackbar *(GLOBAL mode)*

| Trigger | Verb | Pattern | MUST/MAY | Mode |
|---------|------|---------|----------|------|
| Task detail load | GET | `/tasks/{id}` | MUST | GLOBAL |
| "Cancel task" button | DELETE | `/tasks/{id}` | MAY (do not show the button if missing) | GLOBAL |

## Tasks snackbar *(DOMAIN mode)*

| Trigger | Verb | Pattern | MUST/MAY | Mode |
|---------|------|---------|----------|------|
| Task detail load | GET | `/domains/{domain}/tasks/{id}` | MUST | DOMAIN |
| "Cancel task" button | DELETE | `/domains/{domain}/tasks/{id}` | MAY (do not show the button if missing) | DOMAIN |

---

## Live metrics *(APPLICATION:"MAIL", GLOBAL mode)*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Page load | GET | `/metrics` | MUST |

---

## Network channels *(APPLICATION:"MAIL", GLOBAL mode)*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Page load | GET | `/servers/channels` | MUST |
| "Disconnect all" button | DELETE | `/servers/channels` | MAY (do not show the button if missing)|

---

## Mappings *(APPLICATION:"MAIL", GLOBAL mode)*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Page load | GET | `/mappings` | MUST |
| "Add mapping" button | POST | `/mappings/address/{source}/targets/{destination}` | MAY (do not show the button if missing)|
| "Remove mapping" button | DELETE | `/mappings/address/{source}/targets/{destination}` | MAY (do not show the button if missing)|
| "Remove alias mapping" button | DELETE | `/address/aliases/{userAddress}/sources/{aliasSource}` | MAY (do not show the button if missing)|
| "Remove forward mapping" button | DELETE | `/address/forwards/{userAddress}/targets/{targetAddress}` | MAY (do not show the button if missing)|
| "Remove group member" button | DELETE | `/address/groups/{groupAddress}/{memberAddress}` | MAY (do not show the button if missing)|
| "Add domain mapping" button | PUT | `/domainMappings/{fromDomain}` | MAY (do not show the button if missing)|
| "Remove domain alias mapping" button | DELETE | `/domainAliases/{destinationDomain}/sources/{sourceDomain}` | MAY (do not show the button if missing)|
| "Add regex mapping" button | POST | `/mappings/regex/{mappingSource}/targets/{regex}` | MAY (do not show the button if missing)|
| "Remove regex mapping" button | DELETE | `/mappings/regex/{mappingSource}/targets/{regex}` | MAY (do not show the button if missing)|

Group members are removed one at a time: `DELETE /address/groups/{groupAddress}` (without a member) returns 400, and `DELETE /address/groups` (with nothing) would wipe every Group mapping across all groups. Neither is used here. This is the recipient rewrite table only — the LDAP-backed TMail mailing lists are a distinct feature and are unaffected by this button.

---

## Cassandra *(APPLICATION:"MAIL", GLOBAL mode)*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Page load — current version | GET | `/cassandra/version` | MUST |
| Page load — latest version | GET | `/cassandra/version/latest` | MUST |
| "Upgrade" button | POST | `/cassandra/version/upgrade/latest` | MAY (do not show the button if missing)|

---

## Resource locator *(APPLICATION:"MAIL", GLOBAL mode)*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| "Search mailbox" button | GET | `/mailboxes/{mailboxId}` | MAY (do not show the button if missing)|
| "Search message" button | GET | `/messages/{messageId}` | MAY (do not show the button if missing) |

If both are missing hide the page

---

## Registered users *(APPLICATION:"CALENDAR")*

| Trigger | Verb | Pattern | MUST/MAY | Mode |
|---------|------|---------|----------|------|
| Page load | GET | `/domains/{domain}/registeredUsers` | MUST | DOMAIN |
| Page load | GET | `/registeredUsers` | MUST | GLOBAL |
| "Create user" button | POST | `/domains/{domain}/registeredUsers` | MAY (do not show the button if missing) | DOMAIN |
| "Create user" button | POST | `/registeredUsers` | MAY (do not show the button if missing) | GLOBAL |
| "Edit user" form | PATCH | `/domains/{domain}/registeredUsers?id={id}` | MAY (do not show the button if missing) | DOMAIN |
| "Edit user" form | PATCH | `/registeredUsers?id={id}` | MAY (do not show the button if missing) | GLOBAL |
| "Delete user" button | DELETE | `/domains/{domain}/registeredUsers?email={email}` | MAY (do not show the button if missing) | DOMAIN |
| "Delete user" button | DELETE | `/registeredUsers?email={email}` | MAY (do not show the button if missing) | GLOBAL |

---

## JMAP settings report *(APPLICATION:"MAIL", GLOBAL mode)*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| Page load | GET | `/jmap/settings/reports` | MUST |

---

## Common tasks *(admin operations panel)*

### APPLICATION:"MAIL" tasks

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| "Run mailbox task" button | POST | `/mailboxes?{params}` | MAY |
| "Run message task" button | POST | `/messages?{params}` | MAY |
| "Run quota task" button | POST | `/quota/users?{params}` | MAY |
| "Fix cassandra mappings" button | POST | `/cassandra/mappings?action=SolveInconsistencies&{params}` | MAY |
| "Cleanup JMAP uploads" button | DELETE | `/jmap/uploads?scope=expired&{params}` | MAY |
| "Blob garbage collection" button | DELETE | `/blobs?scope=unreferenced&{params}` | MAY |
| "Purge deleted messages" button | DELETE | `/deletedMessages?scope=expired` | MAY |
| "Reload certificates" button | POST | `/servers?reload-certificate` | MAY |
| "Cleanup old messages" button | DELETE | `/messages?mailbox={mailbox}&olderThan={date}&useSavedDate` | MAY |
| "Delete old tasks" button | DELETE | `/tasks?olderThan={days}day` | MAY |
| "Reposition system rights" button | POST | `/team-mailboxes?action=repositionSystemRights` | MAY |
| "Reindex users" button | POST | `/users?{params}` | MAY |

Note: Hide tasks button that are not allowed

### APPLICATION:"CALENDAR" tasks *(calendar only)*

| Trigger | Verb | Pattern | MUST/MAY |
|---------|------|---------|----------|
| "Import LDAP users" button | POST | `/registeredUsers/tasks?task=importFromLDAP` | MAY |
| "Sync domain members" button | POST | `/addressbook/domain-members?task=sync` | MAY |
| "Reindex calendar events" button | POST | `/calendars?task=reindex` | MAY |
| "Archive calendar events" button | POST | `/calendars?task=archive` | MAY |
| "Schedule alarms" button | POST | `/calendars?task=scheduleAlarms` | MAY |
| "Add missing user fields" button | POST | `/registeredUsers?action=addMissingFields` | MAY |

Note: Hide tasks button that are not allowed
