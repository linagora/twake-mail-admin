# Decisions

Decisions taken on twake-mail-admin, oldest first. Append only: a decision that changes gets a new entry that replaces the old one and cites it. Entry format: the `twake-decisions` skill of [linagora/twake-guidelines](https://github.com/linagora/twake-guidelines/blob/main/skills/twake-decisions/SKILL.md).

Categories: UX, UI, Product, Architecture, Infra, Tech.

## 2026-11-23, [UX] The reprocessing queue field suggests the existing mail queues

- Decision: in every mail repository reprocess dialog (all mails, one mail, default and Extended views), the Queue field is a free-text field suggesting the queues of `GET /mailQueues` (spool by default), with an inline warning when the typed queue is not among them; when the queues cannot be listed it stays plain free text without warning. A 400 from WebAdmin keeps the dialog open with the typed values and the server message, and announces no task.
- Decided by: chibenwa, [issue #717](https://github.com/linagora/twake-mail-admin/issues/717); free text with suggestions rather than a strict select chosen by agent (PR for #717), to be confirmed by chibenwa.
- Why: WebAdmin now refuses an unknown queue with a 400, while a suggestion list still lets a queue missing from the list (e.g. listing not allowed for the profile) be typed.
- Scope: desktop and mobile, mail repository list and mail repository pages (default and Extended).

## 2026-11-23, [UX] A team mailbox vault restore brings back all its messages, with no criteria

- Decision: on a team mailbox page, "Restore all deleted messages" opens its own confirmation, which names the team mailbox, says every deleted message goes back into its restore folder and that they cannot be picked, and previews a curl command with no body. The request has no body. The criteria of the Deleted Message Vault section only search the vault: they offer no Restore of the criteria nor of a single message.
- Decided by: Benoit Tellier, [issue #706](https://github.com/linagora/twake-mail-admin/issues/706)
- Why: tmail-backend restores the whole vault of a team mailbox and answers 400 to any body, so a restore by criteria would either fail or restore more than asked.
- Scope: desktop and mobile, team mailbox detail page, Tasks list and task page (task type `team-mailbox-deleted-messages-restore`).
