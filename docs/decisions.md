# Decisions

Decisions taken on twake-mail-admin, oldest first. Append only: a decision that changes gets a new entry that replaces the old one and cites it. Entry format: the `twake-decisions` skill of [linagora/twake-guidelines](https://github.com/linagora/twake-guidelines/blob/main/skills/twake-decisions/SKILL.md).

Categories: UX, UI, Product, Architecture, Infra, Tech.

## 2026-11-23, [UX] Reindexing the mailboxes of an unknown user

- Decision: the user "Reindex all mailboxes" dialog offers an optional "force" box, unticked by default and sent bare (`&force`, as for the rename), and a WebAdmin 404 keeps the dialog open with "User … does not exist: no reindexing task was created." above the server message. Pages of an address without account show no user tasks, so no reindexing either.
- Decided by: chibenwa, [issue #719](https://github.com/linagora/twake-mail-admin/issues/719)
- Why: WebAdmin now refuses an unknown user, which stops typos; forcing is only useful to clean up the index entries of a user already deleted.
- Scope: desktop, user page > Tasks.
