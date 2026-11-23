# Decisions

Decisions taken on twake-mail-admin, oldest first. Append only: a decision that changes gets a new entry that replaces the old one and cites it. Entry format: the `twake-decisions` skill of [linagora/twake-guidelines](https://github.com/linagora/twake-guidelines/blob/main/skills/twake-decisions/SKILL.md).

Categories: UX, UI, Product, Architecture, Infra, Tech.

## 2026-11-23, [UX] Team mailbox system folders show no Delete action

- Decision: in the Folders section of a team mailbox, the top-level folders provisioned with it (`INBOX`, `Sent`, `Trash`, `Outbox`, `Drafts`, `Templates`) show a "System folder" badge and a disabled Delete action, explained by a hint also shown on a tap; any other refusal of WebAdmin to delete a folder is reported in an error toast with its message.
- Decided by: chibenwa, [issue #705](https://github.com/linagora/twake-mail-admin/issues/705)
- Why: since tmail-backend 9b5f9cc0, WebAdmin answers 400 to the deletion of these folders, which a working action would only hide behind an error.
- Scope: desktop and mobile, team mailbox detail page, Folders section.

## 2026-11-23, [UX] A team mailbox folder name cannot start with "#"

- Decision: the folder creation modal refuses, in place and with Create disabled, a name of which any part between dots starts with `#`; a refusal of WebAdmin stays shown in the modal with the typed name, as for the other create modals, rather than in a toast.
- Decided by: chibenwa, [issue #705](https://github.com/linagora/twake-mail-admin/issues/705); keeping the refusal in the modal: agent (PR for issue #705), to be confirmed by chibenwa
- Why: `#` prefixes the IMAP namespaces, so WebAdmin now answers 400 to such a name; the modal already keeps the dialog and the typed value the issue asks to keep.
- Scope: desktop and mobile, team mailbox detail page, folder creation modal.
