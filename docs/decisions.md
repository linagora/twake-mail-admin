# Decisions

Decisions taken on twake-mail-admin, oldest first. Append only: a decision that changes gets a new entry that replaces the old one and cites it. Entry format: the `twake-decisions` skill of [linagora/twake-guidelines](https://github.com/linagora/twake-guidelines/blob/main/skills/twake-decisions/SKILL.md).

Categories: UX, UI, Product, Architecture, Infra, Tech.

## 2026-11-23, [UX] Reprocessing: free-text processor, a blank one is left out, a refused one is reported in the dialog

- Decision: the Processor field of the reprocess dialogs (whole repository, and one mail in the default and Extended views) stays free text, explained as a processor configured in the server's mailet container; the value is trimmed and, when blank, `processor` is not sent at all, so each mail goes back to its own stored state (the API client no longer forces `root`, which the reprocess-all dialog still pre-fills). A WebAdmin 400 for a processor that is not configured, or a queue that does not exist, keeps the dialog open with its values, names the refused field, says that no mail was moved and shows the server message; the two 400s are told apart by their message. Nothing is checked on the client side.
- Decided by: chibenwa, [issue #718](https://github.com/linagora/twake-mail-admin/issues/718)
- Why: an unknown processor used to send the mails to `error` and lose them; WebAdmin now refuses it, but lists no processors, and older backends still accept any value.
- Scope: desktop and mobile, mail repositories list and repository detail pages.
