# AGENT.md

Checks to run systematically before considering a task done.

## Run every time

```bash
npm audit        # must report "found 0 vulnerabilities"
bun run lint     # 0 error (pre-existing @typescript-eslint/no-explicit-any warnings are tolerated)
docker build .   # must complete the build stage (tsc -b && vite build)
```

## Things to watch

- **Two package managers**: `package-lock.json` (npm) **and** `bun.lockb` (bun). The Docker build uses bun with `bun install --frozen-lockfile`, so after any dependency change, regenerate `bun.lockb` (`bun install`) or the Docker build breaks.
- **Transitive vulnerabilities**: `npm audit fix` patches the npm side, but **bun does not re-bump** transitive deps. To neutralize a CVE in both trees, pin the fixed version in `package.json > overrides` (honored by both npm and bun).
- **Single `vite` version**: pinned to 8.x via `overrides`. Keep `vitest` and `@vitejs/plugin-react-swc` aligned with vite 8, otherwise a `Plugin` type conflict appears in `vite.config.ts` (only surfaced by `tsc` during the Docker build).
- **OIDC client permissions**: When adding a user-facing feature, button, menu item, or option that calls an API endpoint, expose it only when that endpoint is allowed for the current OIDC client ID (for example, through its `allowedUrl` configuration). Do not rely on the UI alone to grant access: the client’s configured permissions must determine whether the capability is visible and usable. Document explicitly permissions needed for each component in `validation.md`.
- **Profile editor**: `validation.md` is not documentation only — `profile-editor/` builds the operator-facing permission questionnaire from it. Adding a component therefore means three edits, not one: the `useIsAllowed` gate in the component, the row in `validation.md`, and the node in `profile-editor/twake_profile_editor/inventory.py` (a page, a section or an action, with its English **and** French label). `cd profile-editor && python3 -m unittest discover -s tests -t .` fails until all three agree, and names exactly what is missing:
  - *"endpoints declared upstream but absent from the inventory"* → the `validation.md` row has no node.
  - *"frontend gates a fully-granting profile would not satisfy"* → the component asks about a pattern nothing grants. Beware the common case: the gate is on the bare path (`POST /users/{username}/mailboxes`) while the call carries a query string (`?task=reIndex`). The resolver treats those as unrelated, so declare the gate in the node's `gates=(...)`.
  - *"changed. Re-read resolver.py"* → `src/lib/proxy-resolver.ts` moved; the Python port mirrors it line for line and must be reviewed before refreshing `profile-editor/checksums.sha256`.
- **Mail and Calendar scope**: When implementing a feature, confirm whether it is intended for Mail, Calendar, or both applications. Only expose it in applications supported by the current OIDC client and its configured permissions; cross-application features must work correctly and be authorized in every application where they are shown.
- Validate build **and** tests: `bun run build` and `bun run test`.
