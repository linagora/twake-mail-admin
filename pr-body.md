Closes #132

## Changes
- `rate-limits-section.tsx` keeps the raw input strings instead of `parseInt`-ing them on every keystroke, so `1.5` no longer gets silently truncated to `1`.
- On save, every field must be empty (use the default limit), `-1` (unlimited) or an integer >= 0. `0` is accepted because the possible-cause analysis in the issue allows it, and it is a meaningful limit (block). If any field is invalid, a toast says "Invalid rate limit — Enter a positive integer, -1 for unlimited, or leave empty for the default limit." and no request is sent.
- Invalid fields get a red border (`aria-invalid`), and the inputs have `min=-1 step=1`.
- The helpers `toRateLimitInputs`, `isValidRateLimitInput`, `invalidRateLimitKeys` and `parseRateLimitInputs` are in `rate-limits.ts`, with unit tests.
- Added the `rateLimits.invalid` and `rateLimits.invalidDesc` translations in all 8 locales.

The same component is used for domain and user rate limits, so both are covered.

## Checks
- `vitest run`: 14 files, 219 tests passed
- `eslint .`: 0 errors. The 157 warnings were already there; the changed files have none.
- `tsc -b`: OK

Node 22 ran the checks (via `npx node@22`) because the system Node is v12.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

---
*Generated automatically*
