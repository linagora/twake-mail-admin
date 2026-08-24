# What this project reads, and from where

The generator lives in the frontend's own repository on purpose: the endpoint
inventory, the resolver and the permission gates are read from their real
location, so the generator cannot quietly fall behind the UI it describes.

## Read in place — no copies

| Source | Used for |
|---|---|
| `../validation.md` | The endpoint inventory. `tests/test_inventory.py` re-parses it on every run and requires the permission tree to declare exactly its `(verb, pattern)` pairs. |
| `../src/lib/proxy-resolver.ts` | The rule matcher, ported to `twake_profile_editor/resolver.py`. |
| `../src/lib/proxy-resolver.test.ts` | Transcribed case by case into `tests/test_resolver.py`. |
| `../src/**/*.ts`, `../src/**/*.tsx` | Every `useIsAllowed(verb, pattern)` call site and every `allowanceCheck` table entry, extracted at test time by `twake_profile_editor/repo.py` and diffed against the tree. |

## Checksummed — and only what is mirrored

`checksums.sha256` pins exactly two files, and a test enforces that it pins no
more. They are not copies — they are the originals — but `resolver.py` and
`test_resolver.py` mirror them line for line, so editing one without re-reading
the port is a silent divergence. `tests/test_upstream.py` fails when they move,
which is the prompt to review the port.

Refresh after reviewing:

```sh
cd "$(git rev-parse --show-toplevel)"
sha256sum src/lib/proxy-resolver.ts src/lib/proxy-resolver.test.ts \
  > profile-editor/checksums.sha256
```

The vendored profiles are deliberately **not** pinned. Nothing here mirrors their
contents — they are runtime data — so a baseline updated upstream should simply
be picked up. Pinning them once turned an upstream update into a red build, which
is the wrong answer. Whether their content still behaves correctly is covered by
`test_generator.py` and `test_check.py`, which resolve the real rules.

## Vendored — the one external dependency

`twake_profile_editor/profiles/*.json` are verbatim copies of the classpath
profiles shipped by [linagora/webadmin-proxy](https://github.com/linagora/webadmin-proxy)
(`src/main/resources/`), pinned at `705c40d`. They are the reusable baselines an
`include` directive points at. Being in another repository, they are the only
files here that can drift unnoticed; the checksums catch an accidental local
edit, not an upstream change.
