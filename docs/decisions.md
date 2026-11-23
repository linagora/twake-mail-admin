# Decisions

Decisions taken on twake-mail-admin, oldest first. Append only: a decision that changes gets a new entry that replaces the old one and cites it. Entry format: the `twake-decisions` skill of [linagora/twake-guidelines](https://github.com/linagora/twake-guidelines/blob/main/skills/twake-decisions/SKILL.md).

Categories: UX, UI, Product, Architecture, Infra, Tech.

## 2026-11-23, [Product] Sending an email through WebAdmin is a Mail common task

- Decision: in the MAIL application, Common Tasks lists "Send an email" (server group, caution) when `POST /mail-transfer-service` is allowed; its dialog composes a plain text message (From, To, Cc, Subject, Body) or takes a pasted or loaded `.eml`, keeps Send disabled until the message has exactly one valid `From` address and at least one recipient (`To`, `Cc` or `Bcc`) whose every address is valid, sends it as `message/rfc822`, reports a 201 as "Email enqueued for processing" (never "delivered"), and on a refusal stays open with the message and shows the WebAdmin message in place and in a toast.
- Decided by: chibenwa, [issue #715](https://github.com/linagora/twake-mail-admin/issues/715); placement and the composer without Bcc: agent (PR for #715), to be confirmed by chibenwa.
- Why: James WebAdmin now answers 400 on these errors (apache/james-project@9f35fd9a); checking them in the browser means the server rarely has to refuse.
- Scope: desktop and mobile, Common Tasks of the MAIL application; not in CALENDAR nor DOMAIN mode.
