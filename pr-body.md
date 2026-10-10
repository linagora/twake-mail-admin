Closes #161

## Changes
`src/modules/users/details/user-delegation.tsx` now takes the result of the existing check into account, instead of only displaying it:
- **Self delegation** (the entered user is the user themself, ignoring case and surrounding spaces): a red "You cannot delegate a user to themself" hint is shown and Add is disabled.
- **Invalid username** or **check still running**: Add is disabled.
- **User not found**: Add asks for a confirmation ("… does not exist and will not be able to log in. Add it as delegated user anyway?"). If the admin cancels, nothing is sent.
- The same checks apply when pressing Enter in the field.

WebAdmin itself does not validate these cases, so this is only a UI-side safeguard. Unknown users still require confirmation rather than being blocked outright. The existence check reports any non-404/400 error (e.g. a proxy 403 on `HEAD /users/{user}`) as "not found", and blocking those users would lock some admins out of the feature.

New translation keys (`selfDelegation`, `unknownUserTitle`, `unknownUserConfirm`) added in all 8 locales.

## Checks
- `vitest run`: 29 files / 281 tests pass, including the new `user-delegation.test.tsx` (6 tests: existing user, self delegation including Enter key, invalid/checking states, unknown user confirmed and cancelled)
- `eslint` on the changed files: clean
- `tsc -b`: clean

---
*Generated automatically*
