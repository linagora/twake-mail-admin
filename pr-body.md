Closes #172

## Changes
- `mail-repositories-list.tsx`: the Reprocess / Move / Clear dialogs now show `repository` (e.g. `var/mail/error`) instead of the URL-encoded `path` (`var%2Fmail%2Ferror`). The handlers now receive the whole `MailRepository`.
- The reprocess command preview no longer ends with `&`, so it no longer shows `action=reprocess&&queue=…`.
- `reprocessMailRepository` (`api-client.ts`): parameters are `set` instead of `append`ed, so a custom processor replaces the default `root` one rather than being sent twice; blank values (empty `limit` / `maxRetries`) are no longer sent.
- New `api-client.test.ts` covering the reprocess query string.

## Checks
- `npm ci`: OK.
- `vitest`, `eslint` and `tsc -b` could **not** be run: the only Node available in the environment where this was written is too old for these tools (they fail with `SyntaxError: Unexpected token ?`). The diff was reviewed by hand instead, so please let CI run them.

## Out of scope
- `handleMoveAll` calls `moveAllMails(encodeURIComponent(sourcePath), …)` even though `path` is already encoded, so the path is encoded twice. Not touched here because the issue only covers what the dialog displays.
- The single-mail reprocess previews in `details/mail-repository*.tsx` still end with `&'`.

---
*Generated automatically*
