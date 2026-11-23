# Decisions

Decisions taken on twake-mail-admin, oldest first. Append only: a decision that changes gets a new entry that replaces the old one and cites it. Entry format: the `twake-decisions` skill of [linagora/twake-guidelines](https://github.com/linagora/twake-guidelines/blob/main/skills/twake-decisions/SKILL.md).

Categories: UX, UI, Product, Architecture, Infra, Tech.

## 2026-11-23, [Product] The console does not delete James accounts; Delete user data warns about delegations

- Decision: the console offers no "Delete user" action (`DELETE /users/{username}`), so the delete-user confirmation, delegation count and delegation-list refresh of #721 are not added. The Delete user data confirmation says the user's mail delegations, from and to it, are removed.
- Decided by: agent ([#721](https://github.com/linagora/twake-mail-admin/issues/721)), to be confirmed by chibenwa
- Why: the `DelegationUserDeletionTaskStep` of Delete user data removes the delegations in both directions, and the dialog did not say so.
- Scope: desktop, MAIL user page, Tasks section, Delete user data dialog.
