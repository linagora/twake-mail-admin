Closes #162

Follow-up of #129 (which already made the main area shrink to the viewport with `min-w-0` on `SidebarInset` and capped page containers with `max-w-full`). On the detail pages, though, some content could not shrink, so it still overflowed and pushed row actions off-screen.

## Changes
- **Rows** (user mailboxes, aliases, forwards, delegation, team mailboxes; domain team mailboxes, contacts, aliases, calendar admins/resources; team mailbox members, folders, extra senders; dead-letter groups and events): long names and ids now break (`min-w-0 break-all`), and the action buttons never shrink (`shrink-0`). On mailbox and folder rows, the counters and actions wrap below the name when space runs out.
- **Pagination**: the hand-written 5-button pagination bars (team mailbox members, folders, extra senders, dead-letter group events) now use the shared `PaginationControls`, which wraps.
- **Toolbars**: the add-member, add-sender, quota-size and Event Dead Letter search rows wrap (`flex-wrap`, with a minimum width on the main input). The group field is capped at `max-w-full`.
- **Quota rows** wrap. **Rate-limit labels** wrap instead of pushing the inputs out (`whitespace-nowrap` removed, input `shrink-0`).

## Checks
- `tsc -b`: OK
- `eslint` on the touched directories: 0 errors. The only warnings were already there.
- `vitest run src/modules/users src/modules/domains src/modules/event-deadletter src/components`: 15 files, 103 tests passed

The local Node is v12, so these checks ran in a `node:22` container.

Not done: no new unit test, because jsdom has no layout engine and cannot measure overflow. I did not re-measure the pages in a real 390 px browser. Please check the four URLs from the issue at that width.

---
*Generated automatically*

🤖 Generated with [Claude Code](https://claude.com/claude-code)
