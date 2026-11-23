# Decisions

Decisions taken on twake-mail-admin, oldest first. Append only: a decision that changes gets a new entry that replaces the old one and cites it. Entry format: the `twake-decisions` skill of [linagora/twake-guidelines](https://github.com/linagora/twake-guidelines/blob/main/skills/twake-decisions/SKILL.md).

Categories: UX, UI, Product, Architecture, Infra, Tech.

## 2026-11-23, [UX] The data tiering refuses a zero retention period and names an unknown user

- Decision: the "Tier user data" dialog refuses an empty, zero or negative retention period in place, explaining that 0 would evict the cached data of the whole account; a WebAdmin 404 says the user does not exist, above the server message, and the dialog keeps the typed values.
- Decided by: chibenwa, [issue #709](https://github.com/linagora/twake-mail-admin/issues/709)
- Why: tmail-backend now answers 400 for a zero tiering and 404 for an unknown user; the console catches the first before sending and makes the second readable.
- Scope: desktop and mobile, user page, User Tasks, data tiering.
