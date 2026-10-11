Closes #206

## Problem
Below 768 px the sidebar is rendered as a `Sheet` (Radix Dialog) with no `SheetTitle` / `SheetDescription`: the dialog had no accessible name, and every opening logged `DialogContent requires a DialogTitle` plus the missing `Description` warning.

## Fix
- `src/components/ui/sidebar.tsx`: render a visually hidden (`sr-only`) `SheetHeader` with a `SheetTitle` and a `SheetDescription` inside the mobile `SheetContent`, like the upstream shadcn sidebar does.
- New translation keys `sidebar.title` ("Navigation") and `sidebar.description` ("Application navigation menu") in all 8 locales.
- New test in `mobile-sidebar-bar.test.tsx`: once opened, the dialog is named by the title and described by the description. It fails without the fix.

## Checks
- `vitest run`: 47 files, 367 tests pass (the new test fails without the fix, as expected).
- `eslint` on the changed files: no errors. The one warning (`react-refresh/only-export-components` in `sidebar.tsx`) was already there.
- `tsc -b`: OK.

The tools were run on Node 22 through `npx -p node@22`, because the default Node on the machine is too old for vitest and eslint.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

---
*Generated automatically*
