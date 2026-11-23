# Decisions

Decisions taken on twake-mail-admin, oldest first. Append only: a decision that changes gets a new entry that replaces the old one and cites it. Entry format: the `twake-decisions` skill of [linagora/twake-guidelines](https://github.com/linagora/twake-guidelines/blob/main/skills/twake-decisions/SKILL.md).

Categories: UX, UI, Product, Architecture, Infra, Tech.

## 2026-11-23, [UX] User labels and JMAP settings check the tmail-backend size limits before saving

- Decision: the label dialogs and the JMAP settings editor check the tmail-backend limits (label display name not blank and at most 255 characters, description at most 4096, setting value at most 16384, at most 1000 settings) while the operator types: an inline error names the limit and the current length, a counter shows from 90% of a limit, and save stays disabled or refused; data stored over the limits still loads, clamped in the label list with its full text in a tooltip, and must be shortened or removed before the first save; a 400 from the server keeps the dialog or the edited rows and shows its message.
- Decided by: chibenwa, [issue #710](https://github.com/linagora/twake-mail-admin/issues/710); the inline-error-over-maxLength choice by agent (PR for #710), to be confirmed by chibenwa
- Why: tmail-backend now answers 400 past these limits; an inline error is used instead of `maxLength` so that a pasted or stored over-long value is shown and explained, not silently cut.
- Scope: desktop and mobile, user page, Labels and JMAP Settings sections.
