Closes #197

## Problem
In the user detail page, "Sources pointing to this user" passed the raw API source type (`alias`, `forward`, ...) as `{{type}}` to the remove-all-sources tooltip, confirmation dialog and toasts. In English the success toast therefore started with a lowercase letter (`alias sources of emma@example.com removed`), and every locale showed the untranslated type (e.g. `Alle Quellen vom Typ alias entfernen`). The heading only looked capitalised because of the CSS `capitalize` class.

## Fix
- Add `users.mappings.sourceTypes.{address,alias,forward,group}` to all 8 locales.
- `user-mappings.tsx` uses that translated label for the type heading (no more CSS `capitalize`), the trash button tooltip, the confirmation dialog and both toasts. The API call still uses the raw type.

English output now matches the test plan:
- Dialog: `Remove all Alias sources of emma@example.com (emma.qa@example.com)?`
- Toast: `Alias sources of emma@example.com removed`

## Tests
- New `user-mappings.test.tsx` renders the component with the real English translations and checks the heading, tooltip, dialog, success toast and error toast.
- Updated `user-destructive-actions.test.tsx`: it now expects the label key instead of the raw type.

## Checks run
- `vitest run` (full suite): 48 files, 369 tests passed
- `eslint` on the changed files: clean
- `tsc -b`: clean

The local default Node is 12, so these checks ran under Node 22 via `npx node@22`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

---
*Generated automatically*
