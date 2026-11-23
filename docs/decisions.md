# Decisions

Decisions taken on twake-mail-admin, oldest first. Append only: a decision that changes gets a new entry that replaces the old one and cites it. Entry format: the `twake-decisions` skill of [linagora/twake-guidelines](https://github.com/linagora/twake-guidelines/blob/main/skills/twake-decisions/SKILL.md).

Categories: UX, UI, Product, Architecture, Infra, Tech.

## 2026-11-23, [UX] A domain mapping to its own domain is refused before sending

- Decision: the "Add a mapping" dialog refuses a Domain mapping whose destination equals its source (trimmed, case insensitive): an inline error under the destination, Create disabled, the typed values kept; a 400 WebAdmin still returns is shown in the dialog with its server message.
- Decided by: chibenwa, [issue #714](https://github.com/linagora/twake-mail-admin/issues/714), following apache/james-project 6f21126 (WebAdmin now answers 400).
- Why: such a mapping is useless and WebAdmin refuses it; saying so before the request saves a round trip and a raw error.
- Scope: desktop and mobile, Mappings page, Add a mapping dialog (Domain type).
