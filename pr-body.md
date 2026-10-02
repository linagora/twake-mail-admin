Closes #95

## What

When the app targets Calendar, the domain page now shows how many contacts each domain address book holds:

- **Domain address book (dab)**: N
- **Domain members**: N

- `getDomainAddressBookContactCount(domain, addressBookId)` was added to `src/modules/domains/api-client.ts`. It calls `GET /domains/{domain}/addressbooks/{dab|domain-members}/contactCount`.
- The new `DomainAddressBookCounts` component fetches both counts in parallel when the page loads and shows a spinner while each one is loading. A refresh button reads them again, for example after starting a republish task.
- On a `404`, the count is replaced with "Address book not available". Any other error (`500`, …) shows an inline warning on that line only, so the rest of the page is unaffected.
- The component appears on the calendar domain detail page (GLOBAL mode) and on the calendar Tasks page (DOMAIN mode), just above the sync / republish tasks.
- i18n strings were added for en, fr, mn, ru and vi.

## Permissions

Each count has its own gate (`GET /domains/{domain}/addressbooks/dab/contactCount` and `GET /domains/{domain}/addressbooks/domain-members/contactCount`). If neither is allowed, the whole block is hidden. This is documented in `validation.md`, and a matching `contact-counts` section with one action per count was added to the profile-editor inventory.

## Checks

- `vitest run`: 148/148 pass. New tests: `api-client.test.ts` covers the routes and domain encoding. `domain-address-book-counts.test.tsx` covers counts, 404 and 500 handling, refresh, and per-route gating.
- `eslint .`: 0 errors (only the existing `no-explicit-any` warnings)
- `tsc -b && vite build`: OK
- profile-editor `python3 -m unittest`: 225 tests OK
- Not run: `docker build .`. Dependencies did not change, so the lockfiles were not touched.

---
*Generated automatically*
