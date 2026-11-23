# Decisions

Decisions taken on twake-mail-admin, oldest first. Append only: a decision that changes gets a new entry that replaces the old one and cites it. Entry format: the `twake-decisions` skill of [linagora/twake-guidelines](https://github.com/linagora/twake-guidelines/blob/main/skills/twake-decisions/SKILL.md).

Categories: UX, UI, Product, Architecture, Infra, Tech.

## 2026-11-23, [UX] The contact of a team mailbox is not deletable from Domain Contacts

- Decision: a domain contact whose address is the one of an existing team mailbox shows a "Team mailbox" badge linking to the team mailbox, and its Delete action is disabled with a hint explaining that it is removed with the team mailbox; a 409 answered by the delete is reported in an error toast with the server message, the contact staying listed.
- Decided by: Benoit Tellier (chibenwa), [issue #708](https://github.com/linagora/twake-mail-admin/issues/708), following tmail-backend [62ebe0e](https://github.com/linagora/tmail-backend/commit/62ebe0e7364e38ff0c9de780c80622026f040774)
- Why: tmail-backend creates and removes that contact together with the team mailbox, and now refuses its deletion with a 409.
- Scope: desktop and mobile, domain page, Domain Contacts section (list and contact details); the badge needs `GET /domains/{domain}/team-mailboxes`.
