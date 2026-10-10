Closes #169

## Problem
Task rows in the Tasks page are `<div onClick>`: they are not focusable and cannot be activated from the keyboard, so the "Task — <id>" dialog (and its "Full Details" link) was only reachable with a mouse.

## Fix
- `src/modules/tasks/index.tsx`: the task ID is now a real `<button type="button">` that opens the detail dialog. It is in the Tab order, works with Enter/Space, and shows a focus ring. The row cannot be a button itself because it already contains the cancel button, and buttons cannot be nested. Clicking anywhere on the row with the mouse still works as before.
- `src/modules/tasks/index.test.tsx`: new test checking that the task ID shows up as a focusable button and opens the dialog.

## Checks
- `npm ci`: OK.
- `vitest`, `eslint` and `tsc -b` were **not run**: this environment only has Node 12 available, which is too old to run them (`SyntaxError: Unexpected token .`). Please let CI or a local run with a recent Node confirm them.

---
*Generated automatically*
