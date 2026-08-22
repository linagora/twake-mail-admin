# Profile editor

Build a [webadmin-proxy](https://github.com/linagora/webadmin-proxy)
`allowed.urls` profile — the thing that decides what this admin frontend shows —
by answering questions about what an administrator should be able to see and do.
No knowledge of the James WebAdmin API required.

## Quick start

### With Docker — for operators

Published alongside the frontend, at the same tag:

```console
$ docker run --rm -it -v "$PWD:/work" --user "$(id -u):$(id -g)" \
      linagora/twake-mail-admin-profile-editor:1.2.3 --name domain-support --fr
```

**Pick the tag that matches your deployed Twake Mail Admin.** The endpoint
inventory is baked into the image, so `:1.2.3` asks about the pages `:1.2.3`
actually has. Running a newer tag against an older deployment produces rules for
pages that are not there — quietly, since a profile is only ever evaluated
against what the frontend requests.

The three flags earn their place:

| Flag | Why |
|---|---|
| `-it` | The interview is interactive. Without it you get no prompts and an empty profile. |
| `-v "$PWD:/work"` | `<name>.json` and `<name>.questions` are written to `/work`. Without it they die with the container. |
| `--user "$(id -u):$(id -g)"` | Otherwise both files land in your directory owned by root. |

Reviewing an existing profile needs neither a terminal nor a name:

```console
$ docker run --rm -v "$PWD:/work" \
      linagora/twake-mail-admin-profile-editor:1.2.3 \
      --check domain-support.json --application MAIL --mode DOMAIN
```

Worth an alias if you use it more than once:

```console
$ alias twake-profile-editor='docker run --rm -it -v "$PWD:/work" \
      --user "$(id -u):$(id -g)" linagora/twake-mail-admin-profile-editor:1.2.3'
```

Every example below then works verbatim.

### From the sources — for developers

Nothing to install. Python 3.10 or later, from this directory:

```console
$ cd profile-editor
$ python3 -m twake_profile_editor --name domain-support --fr
```

That is the whole setup. The tool and its test suite run on the standard library
alone.

Two optional upgrades:

```console
$ pip install questionary   # arrow keys and checkboxes instead of numbered prompts
$ pip install -e .          # a `twake-profile-editor` command on your PATH
```

The Docker image ships questionary already, so it always has the good interview.

**Examples below are written as `twake-profile-editor`.** If you get
`command not found`, you have not run `pip install -e .` — use
`python3 -m twake_profile_editor` instead, which is always equivalent.

---

## Motivation

Today, writing a profile for Twake Mail Admin means knowing the WebAdmin API by
heart. A profile is a list of URL patterns; the frontend
decides what to render by asking the proxy whether each pattern is allowed. To
grant "a support agent may reset a user's vacation reply but not delete their
mailbox", you have to know that this means `GET /vacation/{username}` plus
`POST /vacation/{username}` and *not* `DELETE /users/{username}/mailboxes/{mailboxName}` —
and that missing the `GET` hides the whole tab rather than just the button.

That is expert work, and expert time is expensive. Worse, it is expert work that
fails quietly: a profile with a missing read endpoint produces a blank tab, not
an error, and nobody notices until a customer does.

This tool asks the questions instead. *Which pages? Which sections? Which
actions?* — and emits a profile that is internally coherent by construction.

It also does the reverse. `--check` takes a profile someone else wrote and says,
page by page, what it makes visible. That is the part that lets a profile be
reviewed without being an expert.

---

## How it stays true

The generator lives inside the frontend's repository so that it cannot describe a
UI that no longer exists. Nothing about the frontend is copied here: the tests
read the sources in place, on every run.

| Read from | Used for |
|---|---|
| [`validation.md`](../validation.md) | The endpoint inventory. `test_inventory.py` re-parses it and requires the permission tree to declare **exactly** its 219 `(verb, pattern)` pairs — no omissions, no inventions. |
| [`src/lib/proxy-resolver.ts`](../src/lib/proxy-resolver.ts) | The rule matcher, ported to `resolver.py`. Checksummed: edit it and `test_upstream.py` fails, which is the prompt to re-read the port. |
| [`src/lib/proxy-resolver.test.ts`](../src/lib/proxy-resolver.test.ts) | Transcribed case by case into `test_resolver.py`, keeping its section numbering. |
| `src/**/*.ts{,x}` | Every `useIsAllowed` gate and every `allowanceCheck` table entry — 182 of them — extracted at test time and diffed against the tree. |

Only [webadmin-proxy](https://github.com/linagora/webadmin-proxy)'s classpath
profiles are vendored, since they live in another repository. See
[`UPSTREAM.md`](UPSTREAM.md).

### What the cross-check found

Building this turned up a set of divergences between `validation.md` and the
frontend. They have since been corrected in `validation.md`; the tests now pin
the corrections down so they cannot come back.

- **DOMAIN mode is a different application, not a subset.** The frontend ships a
  separate left bar (`modules/domain-admin/`): no domain list, no global user
  list, and what are sections of a domain in GLOBAL mode are top-level entries.
  Now documented under *DOMAIN mode left bar*, and modelled as its own tree.
- **Twenty-nine components gate on a different pattern than they call** — almost
  always the bare path while the call carries a query string, which the resolver
  treats as an unrelated rule. Grant only what was documented and the button
  never appears. Now listed under *Permission gates that differ from the call*,
  and carried in the tree's `gates=` field.
- **Twenty-four permission gates had no counterpart at all**: domain signature
  templates, domain and user mailbox templates, per-user address books, booking
  links, JMAP settings and its report, user creation, registered-user deletion,
  domain mappings, data tiering. All now documented and modelled.
- **MAIL and CALENDAR mount different components.** The calendar user detail page
  shows calendars, address books and booking links — not mailboxes, quotas,
  aliases or vacation. `validation.md` implied one shared page tree, so calendar
  profiles were granting a dozen sections the app never renders.
- **Five factual errors**: the Extra ACL tab load marked MAY where every other tab
  load is MUST; the "Tasks snackbar *(GLOBAL mode)*" rows marked `Mode=DOMAIN`;
  three common-task patterns carrying two `?` characters; `GET /quota/domains/{domain}`
  declared twice; and the deleted-message vault filed under the domain detail
  when it belongs to the team mailbox detail.

`test_frontend_crosscheck.py` now asserts that a profile granting the whole tree
satisfies **every** gate the frontend evaluates — the list of known gaps is empty,
and a test keeps it that way.

### Domain scoping

In DOMAIN mode the user-address segment of every path becomes `%@{domain}`, which
only restricts anything once `{domain}` is pinned to the caller's own domain:

```json
"url.patterns.restrictions": {
  "domain": { "backing.claim": "email", "operator": "HAS_DOMAIN" }
}
```

This **cannot** live in `<name>.json`: an include target holds rules and nothing
else. It belongs in the client entry, next to the include, and the command prints
it at the end of a DOMAIN-mode run so it does not get forgotten. Without it the
profile grants every domain.

Two patterns cannot be scoped mechanically — mailing-list addresses (the calendar
baseline matches them as `xxx@lists.{domain}`) and the target of a user rename.
Both are emitted unchanged with a warning rather than guessed at.

### Reusing a baseline

Reuse emits an `include`, never a flattened copy, so the profile keeps tracking
the proxy:

```json
"allowed.urls": [
  { "denied": true, "verb": ["DELETE"], "endpoint": "/domains/{domain}" },
  { "verb": ["GET"], "endpoint": "/healthcheck" },
  { "include": "classpath://functional-admin-mail-baseline.json" }
]
```

Deny rules come first so they win the first-match race. One subtlety is handled
explicitly: variable names carry no meaning to the resolver, so
`/address/aliases/{userAddress}/sources/{aliasSource}` and
`/address/aliases/{username}/sources/{alias}` are *the same rule*. Denying one
would take the other down with it. When that happens the deny is skipped and the
situation reported, rather than quietly revoking something the operator granted.

### Checking an existing profile

`--check` walks the same tree with the ported frontend resolver and reports what
each component becomes. Because the resolver is the frontend's own, the answer is
the one the real UI will give.

```console
$ twake-profile-editor --check domain-support.json
+ Users [visible]
  + Rename a user [allowed]
  - Delete all data of a user [forbidden]
      missing: POST /users/{username}?action=deleteData
  + Mailboxes tab [visible]
    ...
- Mailing lists [hidden]
      missing: GET /mailingLists

6/8 pages visible, 37/63 actions allowed
```

It reads bare rule arrays and full client entries alike, and follows `include`
directives the way the proxy does.

---

## Usage

```
twake-profile-editor [--name NAME] [--fr]
                     [--resume-from FILE | --generate-from FILE | --check FILE]
                     [--application {MAIL,CALENDAR}] [--mode {GLOBAL,DOMAIN}]
                     [--out-dir DIR]
```

| Option | Effect |
|---|---|
| `--name NAME` | Names the profile. Drives `<name>.json` and `<name>.questions`; asked for if omitted. |
| `--fr` | Asks the questions — and writes the diagnostics — in French. |
| `--resume-from FILE` | Pre-fills every answer from a previous `<name>.questions` and walks the questions again. This is how a profile is *edited* rather than rewritten. |
| `--generate-from FILE` | Rebuilds the profile from a recorded interview without asking anything. No terminal needed. |
| `--check FILE` | Reports what an existing `allowed.urls` block makes visible. |
| `--application`, `--mode` | Needed by `--check` when they cannot be read from a sibling `.questions`. |
| `--out-dir DIR` | Where the two files are written. Defaults to the working directory. |

Every run prints the rule array on stdout and writes two files:

- **`<name>.json`** — a **bare JSON array of rules**, which is exactly what an
  `include` directive expects. Reference it straight from the client entry rather
  than pasting its contents:

  ```json
  "allowed.urls": [
    { "include": "file://domain-support.json" }
  ]
  ```

  The command prints that line for you when it finishes.
- **`<name>.questions`** — every answer given. This is the real source of truth:
  `<name>.json` is a build product of it. Refresh every profile after an
  inventory change with a loop over `--generate-from`.

`--generate-from` cannot ask anything, so a question missing from the file — a
page added since it was saved — falls back to the closed answer (not visible, not
allowed) and is reported on stderr. A profile is never widened silently.

### Editing an existing profile

```console
$ twake-profile-editor --resume-from domain-support.questions
```

Every answer comes back pre-selected; change what needs changing and the rest
stays. Questions the file never covered are asked normally and counted at the end.

---

## Building, running, testing

Python 3.10 or later, and nothing else. There is no required dependency, at
runtime or for the tests — the CI agent has neither `pip` nor `ensurepip`, so
needing either was not an option.

[questionary](https://github.com/tmbo/questionary) is optional and only affects
the interview: with it you get arrow keys and checkboxes, without it numbered
prompts on stdin. The same fallback covers running without a terminal at all.

Two equivalent ways to invoke it:

```console
$ python3 -m twake_profile_editor --name support   # always works
$ twake-profile-editor --name support              # after pip install -e .
```

### The image

```console
$ docker build -t twake-mail-admin-profile-editor:dev profile-editor
```

Built from `profile-editor/` alone: the package, and questionary for the
interview. It does **not** carry `validation.md` or `src/` — the inventory is
Python code inside the package, which is what makes the tag a version pin. The
tests are excluded for the same reason: they read the repository, so they run in
CI before the image is built, not inside it.

CI builds and pushes it next to the frontend image, on `main` and on tags, in the
*Deploy docker image* stage of the `Jenkinsfile`. `org.opencontainers.image.version`
and `.revision` record the tag and the commit.

### Tests

```console
$ python3 -m unittest discover -s tests -t .
```

169 tests, under a second, no network, no fixtures to regenerate and nothing
installed. The suite is written against `unittest` for exactly that reason;
`pytest` collects `unittest.TestCase` natively, so `python3 -m pytest` also works
wherever it happens to be available and gives nicer failure output.

They are worth reading as documentation:

| File | What it pins down |
|---|---|
| `test_resolver.py` | The frontend's own suite, transcribed. The port cannot drift. |
| `test_inventory.py` | The inventory is exactly `validation.md`, plus structural invariants. |
| `test_frontend_crosscheck.py` | A fully-granting profile satisfies every gate the frontend evaluates. |
| `test_upstream.py` | The resolver files the port mirrors have not moved unreviewed. |
| `test_generator.py` | Closure, domain scoping, verb merging, include emission, deny carving. |
| `test_check.py` | Grant everything → everything visible, in all four scopes. Grant nothing → nothing visible. |
| `test_interview.py` | Short-circuiting, all/none/detail, resuming. |
| `test_answers.py` | The `.questions` format round-trips and rejects malformed input. |
| `test_profiles.py` | Include resolution: classpath, relative and absolute files, cycles. |

The suite reads `validation.md` and `src/` from this checkout, so it must be run
from the repository — which is also how CI runs it, in the *Profile editor* stage
of the `Jenkinsfile`, with the same single command.

---
