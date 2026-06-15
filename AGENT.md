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
- Validate build **and** tests: `bun run build` and `bun run test`.
