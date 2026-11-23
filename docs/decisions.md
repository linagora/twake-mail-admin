# Decisions

Decisions taken on twake-mail-admin, oldest first. Append only: a decision that changes gets a new entry that replaces the old one and cites it. Entry format: the `twake-decisions` skill of [linagora/twake-guidelines](https://github.com/linagora/twake-guidelines/blob/main/skills/twake-decisions/SKILL.md).

Categories: UX, UI, Product, Architecture, Infra, Tech.

## 2026-11-23, [Product] The domain administrator lists the tasks of their domain

- Decision: in DOMAIN mode (Mail), the Tasks page lists the tasks of the domain through `GET /domains/{domain}/tasks`, under the actions that start them, never through the global `GET /tasks`; the type is filtered in the console (WebAdmin filters this route by status only) and the date filters are not offered. A team mailbox vault restore names its team mailbox, and a team mailbox quota recomputation counts team mailboxes, not users.
- Decided by: chibenwa, [issue #707](https://github.com/linagora/twake-mail-admin/issues/707); the list layout and its filters by agent (PR for #707), to be confirmed by chibenwa.
- Why: tmail-backend now returns the team mailbox tasks from the domain-scoped routes, and a domain administrator who cannot call `GET /tasks` must still be able to follow and cancel them.
- Scope: desktop and mobile; DOMAIN mode Tasks page, task details and task page (Mail).
