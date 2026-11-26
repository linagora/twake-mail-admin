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
(`src/main/resources/`), pinned at the release following webadmin-proxy 1.1.6 (rename denials that match
the actual `POST /users/{user}/rename/{newUser}` call). They are the reusable baselines an
`include` directive points at. Being in another repository, they are the only
files here that can drift unnoticed; the checksums catch an accidental local
edit, not an upstream change.

### Known, deliberate difference

`functional-admin-mail-baseline.json` is webadmin-proxy `master`'s copy (including
the `/messages` and `/quota/users` verb binding of linagora/webadmin-proxy#53)
plus the four template-provisioning rules of #634, placed right after the alias
rules:

```json
{"verb": ["POST"], "endpoint": "/users/%@{domain}/templates?action=provision&from=%@{domain}"},
{"denied": true, "verb": ["POST"], "endpoint": "/users/{user}/templates"},
{"verb": ["POST"], "endpoint": "/domains/{domain}/templates?action=provision&from=%@{domain}"},
{"denied": true, "verb": ["POST"], "endpoint": "/domains/{targetDomain}/templates"},
```

Without them `/users/%@{domain}/*` and `/domains/{domain}/*` let a tenant admin
provision templates copied from a user of *another* tenant (`from=` is a free
address).

It also drops upstream's `{"endpoint": "/mappings/sources/%@{domain}"}` grant and
denies the route instead, right before the `/domains/{domain}` rules (#770):

```json
{"denied": true, "endpoint": "/mappings/sources/{target}"},
```

`/mappings/sources/{user}` is a reverse lookup: it lists and removes every source,
in any domain, whose mapping points at the user. Pinning the user to the caller's
domain pins the target, not the owner of the records, so a tenant admin could read
and remove other tenants' aliases, forwards and groups pointing at their users.

Neither difference protects anything at run time: the proxy resolves a
`classpath://` include against its *own* resource, which still grants both
routes. A generated DOMAIN profile therefore carries them itself (#803):

- `DOMAIN_ALWAYS_DENIED` in `generator.py`, the reverse lookup deny, comes first.
  A DOMAIN grant it would block makes generation fail.
- `DOMAIN_FALLBACK_DENIED`, the two template denies, comes right before the
  `include`; a granted template provisioning (`from=%@{domain}`) is emitted ahead
  of them even though the vendored copy already allows it.

`upstream_mail_baseline()` in `tests/test_generator.py` rebuilds the proxy's copy
from the vendored one minus `VENDORED_ONLY_MAIL_RULES`, and the generator tests
expand the include against it. Any future vendored-only rule needs the same
treatment, and an entry in that list.

Both are security fixes that belong upstream; until webadmin-proxy ships them,
these are the only accepted differences:

```sh
diff <(gh api 'repos/linagora/webadmin-proxy/contents/src/main/resources/functional-admin-mail-baseline.json?ref=master' --jq .content | base64 -d) \
  profile-editor/twake_profile_editor/profiles/functional-admin-mail-baseline.json
```
