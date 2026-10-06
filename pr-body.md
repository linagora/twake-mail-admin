Closes #104

## Changes
- `clearDomainAddressBook` API call: `DELETE /domains/{domain}/addressbooks/{id}/contacts[?sourceDomain=…]`.
- New "Clear contacts" button on the **dab** row of the Calendar domain contacts section. It is gated on `DELETE /domains/{domain}/addressbooks/dab/contacts`. It is not offered for `domain-members` because LDAP synchronization feeds that address book and the server rejects clears (same as imports).
- Confirmation dialog: the admin must type the address book id (`dab`) to confirm. It has an optional "only contacts with a mail address in domain" field, checked against a domain-format pattern.
- On submit, the dialog shows a link to the created `domain-addressbook-clear` task, polls the task (reusing the now-exported `waitForTask`), then refreshes the contact counter.
- 400, 404 and 500 errors get their own messages. i18n strings added for en, fr, ru, vi and mn.
- `validation.md` row and profile-editor inventory node (`dab-clear`) added.

Task types aren't listed anywhere in the UI. The task pages render any type and its `additionalInformation` generically, and domain-scoped task routes are tried first in DOMAIN mode. So `domain-addressbook-clear` tasks already display without changes.

## Checks
- `profile-editor` unit tests: OK (225 tests).
- Not run: `bun run lint`, `bun run build`, `bun run test` (vitest) and `docker build`. The host only has Node 12 and Docker wasn't available. I added unit tests (API client, plus dialog gating, confirmation and source-domain validation), but I haven't run them yet; CI needs to confirm them.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

---
*Generated automatically*
