# Decisions

Decisions taken on twake-mail-admin, oldest first. Append only: a decision that changes gets a new entry that replaces the old one and cites it. Entry format: the `twake-decisions` skill of [linagora/twake-guidelines](https://github.com/linagora/twake-guidelines/blob/main/skills/twake-decisions/SKILL.md).

Categories: UX, UI, Product, Architecture, Infra, Tech.

## 2026-11-23, [UX] A zero quota limit reads as full once something is used

- Decision: a quota limit of 0 shows a ratio of 100% (danger colour) when anything is used and 0% otherwise, with the hint "Limit is 0: nothing can be stored"; a ratio the backend answers as NaN, Infinity or a non-number is worked out from the usage and the computed limit, or shown as "—", never as "NaN%".
- Decided by: chibenwa, [issue #720](https://github.com/linagora/twake-mail-admin/issues/720), following James [d0a693d](https://github.com/apache/james-project/commit/d0a693d6e1454d302cbe36958e5669d6ac4c5df1)
- Why: James now rates a zero limit 0 or 1 instead of NaN, and older backends still answer NaN.
- Scope: desktop and mobile; user and team mailbox quota sections, user summary strip, Explore User Quota.
