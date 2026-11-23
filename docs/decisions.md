# Decisions

Decisions taken on twake-mail-admin, oldest first. Append only: a decision that changes gets a new entry that replaces the old one and cites it. Entry format: the `twake-decisions` skill of [linagora/twake-guidelines](https://github.com/linagora/twake-guidelines/blob/main/skills/twake-decisions/SKILL.md).

Categories: UX, UI, Product, Architecture, Infra, Tech.

## 2026-11-23, [UX] Mail repository creation: protocol required, with suggestions

- Decision: the Create Mail Repository dialog always sends a trimmed, non-blank `protocol`; it suggests `cassandra`, `postgres`, `file` and `memory` (default `cassandra`) while accepting free text, with a hint that the server must support it, and a WebAdmin 400 is shown inside the still-open dialog with its message.
- Decided by: chibenwa, [issue #716](https://github.com/linagora/twake-mail-admin/issues/716); suggestion list chosen by agent (PR for #716), to be confirmed by chibenwa
- Why: James WebAdmin now answers 400 to a missing, blank or unsupported protocol (apache/james-project a2b6231b).
- Scope: desktop and mobile, Mail Repositories page, create dialog.
