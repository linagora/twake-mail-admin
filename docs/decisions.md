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

## 2026-11-25, [UX] Domain Admins accepts only users of the domain

- Decision: in the "Add admin" modal of a calendar domain, an address whose domain part (after the last `@`, case insensitive) is not the page's domain shows "Only users of <domain> can administer it" in red in place of the user existence hint, and disables Add; nothing is sent. The suggestions under the field list only users of that domain. A 400 from the side service still keeps the modal open with the typed address and the server message, without "Admin added". In the list, an existing admin of another domain carries a badge "Other domain: cannot be added again" and keeps its Remove button.
- Decided by: chibenwa, [issue #799](https://github.com/linagora/twake-mail-admin/issues/799), following twake-calendar-side-service [3c5855a](https://github.com/linagora/twake-calendar-side-service/commit/3c5855a433c53b0bce37e1214da639e12ef7d930) which answers 400 to such a `PUT /domains/{domain}/admins/{username}` while `DELETE` still works.
- Why: the console used to offer and send an admin the server now refuses, and gave no hint that admins granted before the check can no longer be granted again.
- Scope: desktop and mobile, calendar domain page and domain admin "Calendar Admins" page, Domain Admins section.

## 2026-11-26, [Security] Refusing team mailbox quota edits also refuses the route setting both limits

- Decision: the profile editor's "Update the quota" action of the team mailbox Quota sub-tab (`domains.team-mailboxes.quota.save`) also covers `PUT /domains/{domain}/team-mailboxes/{mailbox}/quota/limit`. The console never calls this route. It sets both limits at once, so a generated profile that refuses the action now denies it before including the mail baseline. validation.md lists it as a "never called" row so the inventory stays aligned with it.
- Decided by: chibenwa, following webadmin-proxy [PR #74](https://github.com/linagora/webadmin-proxy/pull/74) (issue #73), which closed the same gap in `linagora-mail-functional-support.json`.
- Why: the mail baseline allows `/domains/{domain}/*`, and the editor only denied `…/quota/limit/count` and `…/size`. A support profile answering "no" to quota edits could still lift every team mailbox limit of its tenant.
- Scope: profile editor (generated profiles reusing the mail baseline), validation.md. No UI change.
## 2026-11-26, [Architecture] A generated DOMAIN profile carries the vendored-only security rules itself

- Decision: with a baseline, every generated DOMAIN profile starts with `{"denied": true, "endpoint": "/mappings/sources/{target}"}` (`DOMAIN_ALWAYS_DENIED` in `profile-editor/twake_profile_editor/generator.py`), before its other denies, and ends, right before its `include`, with the `POST /users/{user}/templates` and `POST /domains/{targetDomain}/templates` denies of #634 (`DOMAIN_FALLBACK_DENIED`). A granted template provisioning is emitted as an allow ahead of those denies, even though the vendored baseline allows it. None of these is filtered through the vendored baseline. A DOMAIN grant that `DOMAIN_ALWAYS_DENIED` would block makes generation fail (`UnscopedDomainRule`), with or without a baseline: it is an inventory bug, never a reason to drop the deny. GLOBAL profiles carry none of them. This completes the 2026-11-25 decision "Only platform operators see and remove the sources pointing at a user" and #634: the vendored baseline's rules stay, but are no longer what protects a deployment.
- Decided by: chibenwa, [issue #803](https://github.com/linagora/twake-mail-admin/issues/803) (twake-qa security review SEV-1 of 2026-11-26); the narrow fixed list rather than a deny derived from every GLOBAL-only endpoint chosen by agent (PR for #803), to be confirmed by chibenwa. The template rules and the failure on an overlapping grant follow Arsnael's review of [PR #804](https://github.com/linagora/twake-mail-admin/pull/804).
- Why: webadmin-proxy resolves `classpath://functional-admin-mail-baseline.json` against its own resource, which still grants `/mappings/sources/%@{domain}` and lacks the template rules, so `/users/%@{domain}/*` and `/domains/{domain}/*` allow provisioning `from=` a user of another tenant. A rule held only by the vendored copy never applies, and the generator's `--check` reads that copy; the generator tests now also expand the include against the upstream rule set.
- Scope: profile editor, generated DOMAIN profiles reusing a baseline. Profiles generated since #770 must be regenerated. The change is still due in webadmin-proxy's own baselines.
