# Decisions

Decisions taken on twake-mail-admin, oldest first. Append only: a decision that changes gets a new entry that replaces the old one and cites it. Entry format: the `twake-decisions` skill of [linagora/twake-guidelines](https://github.com/linagora/twake-guidelines/blob/main/skills/twake-decisions/SKILL.md).

Categories: UX, UI, Product, Architecture, Infra, Tech.

## 2026-11-23, [Product] The console creates no user and sets no password

- Decision: the console does not call `PUT /users/{user}` (with or without `?force`): it has no Create user dialog and no change or reset password action, so the empty password WebAdmin now refuses with a 400 ([james-project e50fb50](https://github.com/apache/james-project/commit/e50fb509aa6b1bcc1c4091aa15a33f620e8ea84c)) needs no change here. A later change that adds one of these flows makes the password field required (only a strictly empty value refused, never trimmed), keeps the dialog open on a 400 with the WebAdmin `message` / `details`, and keeps its Command preview in line with the request sent.
- Decided by: agent ([#713](https://github.com/linagora/twake-mail-admin/issues/713)), to be confirmed by chibenwa
- Why: no screen of the console sends a password to WebAdmin (the only password field is the WebAdmin token of the sign-in dialog).
- Scope: desktop and mobile, users module.
