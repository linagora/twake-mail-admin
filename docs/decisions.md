# Decisions

Decisions taken on twake-mail-admin, oldest first. Append only: a decision that changes gets a new entry that replaces the old one and cites it. Entry format: the `twake-decisions` skill of [linagora/twake-guidelines](https://github.com/linagora/twake-guidelines/blob/main/skills/twake-decisions/SKILL.md).

Categories: UX, UI, Product, Architecture, Infra, Tech.

## 2026-11-23, [UX] The reprocessing queue field suggests the existing mail queues

- Decision: in every mail repository reprocess dialog (all mails, one mail, default and Extended views), the Queue field is a free-text field suggesting the queues of `GET /mailQueues` (spool by default), with an inline warning when the typed queue is not among them; when the queues cannot be listed it stays plain free text without warning. A 400 from WebAdmin keeps the dialog open with the typed values and the server message, and announces no task.
- Decided by: chibenwa, [issue #717](https://github.com/linagora/twake-mail-admin/issues/717); free text with suggestions rather than a strict select chosen by agent (PR for #717), to be confirmed by chibenwa.
- Why: WebAdmin now refuses an unknown queue with a 400, while a suggestion list still lets a queue missing from the list (e.g. listing not allowed for the profile) be typed.
- Scope: desktop and mobile, mail repository list and mail repository pages (default and Extended).

## 2026-11-23, [UX] Rate limits: invalid values are refused on the field

- Decision: on the user and domain Rate Limiting editors, a limit is empty (no limit set, sent as `null`), `-1` (unlimited) or a whole number ≥ 0 (sent as a JSON integer); any other value, including text the number input cannot parse, is flagged on the field and disables Save, and is never rounded or sent.
- Decided by: chibenwa, [issue #711](https://github.com/linagora/twake-mail-admin/issues/711), following tmail-backend [c89f212](https://github.com/linagora/tmail-backend/commit/c89f212ce9c3b083248bad4b93e1a3aa002fb4be) which answers 400 to such values.
- Why: what is saved must be exactly what the operator typed, and the backend now rejects other values.
- Scope: desktop and mobile, user detail, domain detail and domain admin Rate Limiting page.

## 2026-11-23, [UX] A team mailbox vault restore brings back all its messages, with no criteria

- Decision: on a team mailbox page, "Restore all deleted messages" opens its own confirmation, which names the team mailbox, says every deleted message goes back into its restore folder and that they cannot be picked, and previews a curl command with no body. The request has no body. The criteria of the Deleted Message Vault section only search the vault: they offer no Restore of the criteria nor of a single message.
- Decided by: Benoit Tellier, [issue #706](https://github.com/linagora/twake-mail-admin/issues/706)
- Why: tmail-backend restores the whole vault of a team mailbox and answers 400 to any body, so a restore by criteria would either fail or restore more than asked.
- Scope: desktop and mobile, team mailbox detail page, Tasks list and task page (task type `team-mailbox-deleted-messages-restore`).

## 2026-11-24, [Infra] A fork pull request runs no code before a linagora member vouches for its head commit

- Decision: the Jenkinsfile starts with an `Authorize fork` stage: a pull request from a fork runs nothing of its own (install, tests, build, e2e, image) unless the fork owner is a linagora member, or a member approved its head commit, submitted a review "Build this please" on it, or commented "Build this please <sha>" with its full id. `Validate CI files` and the trusted report script are kept. No credential is bound at pipeline level; `github` and `dockerHub` are bound only around the steps that use them (`withGithubCredential`, `withDockerHubLogin` with a throwaway Docker config). The block holding these helpers is the same in the Jenkinsfiles of twake-contacts-frontend, twake-calendar-frontend, twake-calendar-side-service, webadmin-proxy, tmail-flutter, esn-sabre, tmail-backend and twake-mail-admin, and is changed in all of them.
- Decided by: Benoit Tellier, after the twake-qa security review of twake-calendar-side-service (SEV-1, 2026-11-23); the pipeline of twake-contacts-frontend is the model, the commit-bound "Build this please <sha>" comment comes from this repository (#697, #699).
- Why: an unapproved fork used to run its code here and only lose the credentials for the rest of its build, but the agent is persistent and shared: a process it leaves behind can read the credentials of a later build, such as the next main delivery. Comments and reviews are now read on every page (100 per page at most).
- Scope: `Jenkinsfile`. An unapproved fork gets no CI feedback anymore, the authorization failure excepted.

## 2026-11-24, [UX] "Add delegated user" refuses a user already delegated

- Decision: in the "Add delegated user" modal of a user, an address already in the user's delegated users (case insensitive, surrounding spaces ignored) shows "<delegated user> is already a delegated user of <user>" in red in place of the user existence hint, and disables Add, as self delegation does. Nothing is sent.
- Decided by: chibenwa, [issue #743](https://github.com/linagora/twake-mail-admin/issues/743)
- Why: WebAdmin answers 200 to an existing delegation, so the console used to report "Delegated user added" while nothing changed.
- Scope: desktop and mobile, user detail page, Delegated Users section.

## 2026-11-25, [Infra] The console's nginx hides its version and sends a Referrer-Policy

- Decision: `nginx.conf` sets `server_tokens off;` and adds `Referrer-Policy: strict-origin-when-cross-origin` (with `always`) at the server level, re-declared in every `location` that has its own `add_header` (`/env.js`, `/index.html`, `/assets/`), next to the CSP and `X-Content-Type-Options`.
- Decided by: chibenwa, [issue #767](https://github.com/linagora/twake-mail-admin/issues/767); `strict-origin-when-cross-origin` rather than `no-referrer` chosen by agent (PR for #767), to be confirmed by chibenwa.
- Why: the exact nginx version helps fingerprint the image, and console paths hold user addresses that must not reach another origin; the bare origin is still sent so that a backend checking it keeps working.
- Scope: every response of the console image (documents, assets, env.js, error pages).

## 2026-11-25, [Product] Only platform operators see and remove the sources pointing at a user

- Decision: on a user's Mappings section, "Sources pointing to this user" and its "Remove all <type> sources" buttons need `GET` / `DELETE /mappings/sources/{username}`; without the GET the sources are neither fetched nor shown, while the user's own mappings (`GET /mappings/user/{username}`) stay. The profile generator offers both calls in GLOBAL mode only, and the vendored `functional-admin-mail-baseline.json` no longer grants `/mappings/sources/%@{domain}` but denies `/mappings/sources/{target}` (a documented difference from webadmin-proxy, see `profile-editor/UPSTREAM.md`).
- Decided by: chibenwa, [issue #770](https://github.com/linagora/twake-mail-admin/issues/770) (twake-qa security review SEV-1 of 2026-11-25); dropping the view for domain admins rather than a domain-filtered backend route chosen by agent (PR for #770), to be confirmed by chibenwa.
- Why: the route is a reverse lookup across every domain, so a domain profile pinning `{username}` to its own domain could still list and remove other tenants' aliases, forwards and groups pointing at its users.
- Scope: desktop and mobile, user detail page, Mappings section; generated DOMAIN profiles and the vendored mail baseline. The same change is still due in webadmin-proxy's own baselines.

## 2026-11-25, [UX] A Users domain filter naming an unmanaged domain stays applied

- Decision: when the Users list is opened with `?domain=` naming a domain that is not managed (unknown, or deleted since the link was made), the filter is kept and the Domain select shows it as an extra selected option "<domain> (domain not managed)"; picking "All domains" drops it. The URL is not rewritten.
- Decided by: agent, fixing [issue #772](https://github.com/linagora/twake-mail-admin/issues/772), which offered keeping or dropping the filter; to be confirmed by chibenwa.
- Why: the users of a deleted domain stay on the server and the list already badges them "domain not managed", so a link to them is meaningful; only the select disagreed with the list.
- Scope: desktop and mobile, Users list.

## 2026-11-25, [UX] The page of an unmanaged domain says so and shows no section

- Decision: the domain page first asks `HEAD /domains/{domain}`. On a 404 it shows only its header (kind "Unknown domain") and a notice "No domain named <domain> exists on this server." with a link back to Domains: no summary, section nor action. Any other failure of the check renders the page as before.
- Decided by: agent, fixing [issue #773](https://github.com/linagora/twake-mail-admin/issues/773), modelled on the user page's "Address without account" state.
- Why: a stale link used to open a full domain page with scattered errors and actions (Save, Run) that make no sense for a domain the server does not have.
- Scope: desktop and mobile, mail domain page (`/domains/domain/<domain>`).

## 2026-11-25, [UX] Provision templates only from an account of the target's domain, and only a Templates folder

- Decision: in the domain and user "Provision templates" dialogs, the source user must belong to the target domain (the user's domain on the user page), whatever the console mode, and the folder name must be empty (sent as none, the server uses `Templates`), `Templates` or `Templates.<sub-folder>` (case sensitive, trimmed before sending). A typed source of another domain (once its `@` is typed) or another folder is flagged in red on its field and disables Start task; the source user suggestions are limited to the target domain. A 400 naming either field keeps the dialog open with its values, a sentence naming the refused field and the server message. This replaces the DOMAIN-mode-only source domain check.
- Decided by: chibenwa, [issue #798](https://github.com/linagora/twake-mail-admin/issues/798), following tmail-backend [61dd831](https://github.com/linagora/tmail-backend/commit/61dd83111af55831623fad32cf4e741989f06800) (GHSA-xh5x-j93m-v7p8); flagging the source only once its `@` is typed chosen by agent (PR for #798), to be confirmed by chibenwa.
- Why: the backend now answers 400 to both, as the task used to copy (and prune) any folder of any user of any tenant.
- Scope: desktop and mobile, domain page and user page, Tasks section.
