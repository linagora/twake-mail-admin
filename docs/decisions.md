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

## 2026-11-24, [UX] Team mailbox "Add member" tells an existing member apart, and announces a role change as such

- Decision: in the team mailbox Add member modal, a typed address matching a listed member (case-insensitive) replaces the "User exists" hint with "<user> is already a <role> of <mailbox>". With the same role, Add is disabled. With the other role, the button reads "Change role", the hint says the role will change to the picked one, and the toast reads "Role of <user> changed to <role>" instead of "Member added".
- Decided by: chibenwa, [issue #749](https://github.com/linagora/twake-mail-admin/issues/749); allowing the role change from the modal, announced by its button, hint and toast, rather than refusing it, chosen by agent (PR for #749), to be confirmed by chibenwa.
- Why: WebAdmin's member PUT is an upsert: it cannot tell an addition from a role change, so a manager was silently demoted while "Member added" was shown.
- Scope: desktop and mobile, team mailbox detail page, members section.
