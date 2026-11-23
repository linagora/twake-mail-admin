# Decisions

Decisions taken on twake-mail-admin, oldest first. Append only: a decision that changes gets a new entry that replaces the old one and cites it. Entry format: the `twake-decisions` skill of [linagora/twake-guidelines](https://github.com/linagora/twake-guidelines/blob/main/skills/twake-decisions/SKILL.md).

Categories: UX, UI, Product, Architecture, Infra, Tech.

## 2026-11-23, [UX] Rename user explains the merge rule for labels and rate limits

- Decision: the Rename user dialog always says that the data is merged into the existing account, that on a label keyword collision the existing account keeps its own label, and that existing rate limits are kept. The request does not change.
- Decided by: chibenwa, [issue #712](https://github.com/linagora/twake-mail-admin/issues/712); showing the hint always, not only with `force`, is agent (PR for #712), to be confirmed by chibenwa
- Why: the target must already exist, so every rename merges, and the operator should know which side wins before running the task.
- Scope: desktop and mobile, the Rename user dialog in User Tasks on the user page.
