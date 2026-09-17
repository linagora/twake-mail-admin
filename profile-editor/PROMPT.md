# Why ?

Editing todays webadmin-proxy / twake-mail-admin profiles is an expert task as it requires very good knowledge of the webadmin API.

Expert time being valuable, we wishes to offer a CLI tool asking natural language questions and generates a valid configuration for the given profile.

# How ?

Python. Simply prompt questions then at the end generates the corresponding configuration (allowed.urls block to include in the client id) as a pretty JSON.

Series of question:
 - Which application? Mail or Calendar ?
 - Which mode? Global or per domain ?
 - Do you whissh to be reusing one of the existing webadmin-proxy profiles ?
 - Go for each page (left bar menu entry) and ask if the user shall be able to see it.
 - For each page go through all sections and ask if the user shall be able to see it.
 - Then go through all pages actions and ask if the user shall be able to apply them.
 - And go down recursively through the application.

## Interview ergonomics

There are ~200 endpoints spread over ~60 sections. A flat sequence of yes/no questions
would mean 80 to 150 prompts and nobody would ever reach the end. This is a usability
requirement, not a nice-to-have:

 - **Hierarchical with short-circuit**: answering "no" to a page skips every section and
   action below it. Never ask a question whose answer is already implied.
 - **Three answers at every level**: "all" / "none" / "let me detail". "all" and "none"
   settle the whole subtree in one keystroke; only "let me detail" descends.
 - **Multi-select checkboxes over sequential yes/no**: picking 12 pages on one screen
   beats 12 consecutive questions. Use a real prompt library (questionary / prompt_toolkit
   / rich) — third party dependencies are allowed and expected here.

# Profiles, output and editing

`--name <profile-name>` names the profile being edited. It drives the output files and
defaults to a prompt if absent.

At the end of the interview the tool:
 - prints the resulting `allowed.urls` block on stdout as pretty JSON;
 - writes the same block to `<name>.json`;
 - writes every answer given during the interview to `<name>.questions`.

`--resume-from <name>.questions` reloads a previous interview and pre-fills each answer
with the recorded one. The user walks the same questions again, changing only what needs
changing. This is how an existing profile gets edited rather than rewritten from scratch.
Questions absent from the file (new pages, new sections since it was saved) are asked
normally, and the tool reports what it could not pre-fill.

`--generate-from <name>.questions` regenerates the profile from a recorded interview
without asking anything. No prompts, no terminal needed — usable from a script or CI, and
the way to refresh every profile after the endpoint inventory changes. The `.questions`
file is therefore the real source of truth for a profile: `<name>.json` is a build product
of it.

Since nothing can be asked in that mode, a question missing from the file (a page or
section added since it was saved) falls back to the closed answer — not visible, not
allowed — and is reported loudly on stderr. Never widen a profile silently.

# Checking an existing profile

`--check <file.json>` does the reverse of the interview: given an existing `allowed.urls`
block, it lists page by page, section by section, what will be visible and what will be
hidden. This is the only way to review a profile without being an API expert.

`--check` must agree with the frontend. Do not invent a matcher: port
`~/Documents/twake-mail-admin/src/lib/proxy-resolver.ts` (168 lines, no imports) to Python
and transcribe `src/lib/proxy-resolver.test.ts` (651 lines) as the conformance suite. Keep
a vendored copy of the upstream `.ts` plus a checksum test so upstream drift is detected.

# References

VALIDATION.md in ~/Documents/twake-mail-admin holds component rights definitions.

Validate (and look for missing stuff) against ~/Documents/twake-mail-admin code.

Also cross check ~/Documents/webadmin-proxy

Reusing an existing profile emits `{"include": "classpath://<profile>.json"}` preceded by
any `denied` rules, rather than flattening the profile into individual rules. The proxy
supports it natively and the profile stays up to date with the proxy.

# i18n

If --fr option is present question are asked in french.

Labels are structured as `key -> {en, fr}` from the start, not retrofitted.

# Documentation

Generate a README with:
 - Motivation
 - Cross project reference check on github.com/linagora
 - What this project actually does
 - Building, running, testing

# Deny rules must hold against the proxy, not only the frontend

The first generated profiles (`linagora-mail-functional-{admin,baseline,support}.json`) had holes
found by running them through webadmin-proxy's real matcher. `--check` is right to follow the
frontend resolver, but **deciding what to deny** must follow the proxy
(`~/Documents/webadmin-proxy/docs/02-configuration.md`, *Endpoint pattern syntax*), because the proxy
is what lets a request through:

 - **A rule without query matches every query.** The baseline's `/users/%@{domain}` allows
   `POST /users/{username}?action=deleteData`, and `/users/%@{domain}/*` allows
   `POST /users/{username}/data?tiering=…`. The frontend resolver calls these unrelated, so no deny
   was emitted. When reusing a baseline, a candidate endpoint is "already allowed" if **either**
   resolver allows it; emit the deny in both cases. Parameters the rule does not list are ignored by
   the proxy too.
 - **Never domain-scope a deny rule.** `%@{domain}` narrows what a rule matches, so on a deny it
   narrows what is refused: a deny on `…/team-mailboxes/{mailbox}/members/%@{domain}` does not stop
   adding `eve@other.com`, and the baseline's `/domains/{domain}/*` then allows it. Apply
   `domain_scope` to allow rules only; deny rules keep free variables (`{username}`, `{user}`).
 - **Mailing lists: authorise both `lists.{domain}` and `{domain}`.** Lists usually live under
   `lists.<domain>` (`sales@lists.linagora.com`), but some tenants address them under the domain
   itself; `%@{domain}` alone captures `lists.linagora.com` and the `HAS_DOMAIN` restriction refuses
   it. In DOMAIN mode every mailing-list rule is therefore emitted twice:
   `GET /mailingLists?domain=lists.{domain}` **and** `?domain={domain}`;
   `/mailingLists/%@lists.{domain}…` **and** `/mailingLists/%@{domain}…` (list itself, `/members/{member}`,
   `/owners/{owner}`), with the same verbs — as in `functional-admin-calendar-baseline.json`. Never emit
   bare `/mailingLists` or `/mailingLists/{address}` in DOMAIN mode; that grants every tenant's lists.
 - **Message cleanup must name the user.** `DELETE /messages` without `user` expires messages of
   **every user of the platform** (James `ExpireMailboxTask`). The user page call already sends
   `user={username}`: in the inventory, `users.cleanup-mailbox` is
   `DELETE /messages?user={username}&mailbox={mailbox}&olderThan={date}&useSavedDate` with gates
   `/messages?user={username}&mailbox=Trash` and `…&mailbox=Spam`. `domain_scope` must rewrite a
   `user={username}` query value into `user=%@{domain}`, not only path segments. In DOMAIN mode never
   emit `/messages`, `/messages?mailbox=…` or any `/messages` rule without `user=%@{domain}`. The
   shipped `functional-admin-mail-baseline.json` already grants `/messages?user=%@{domain}`. The
   frontend gates are being changed accordingly (see
   `~/Documents/webadmin-proxy/prompt-twake-mail-admin-messages-cleanup.md`).
 - **Unscoped endpoints in DOMAIN mode are cross-tenant.** A rule capturing no `{domain}` escapes
   `url.patterns.restrictions`. Warn loudly for each one emitted (`GET /tasks`,
   `GET /quota/users` without `domain`). When the same call exists with and without a `domain`
   parameter, emit only the scoped one — otherwise the unscoped rule, listed first, matches
   `?domain=other.com` too.
 - **In DOMAIN mode, the call is the scoped variant — never also the unscoped one.** The quota
   explorer is the example: `inventory.py` declares `users.quota-explorer` in DOMAIN mode as the
   unscoped call `GET /quota/users?minOccupationRatio={min}&maxOccupationRatio={max}&limit={limit}&offset={offset}`
   plus a gate `…&domain={domain}`, so both rules were emitted, unscoped first. Since the proxy
   ignores parameters a rule does not list, the unscoped rule matched `…&domain=other.com` (and no
   `domain` at all), captured nothing and escaped the restriction: every tenant's quotas were
   readable. Yet the frontend (`explore-user-quota.tsx`) in DOMAIN mode only gates on, and only
   calls, the `&domain={domain}` form. Declare the DOMAIN endpoint as
   `must("GET", f"{_QUOTA_EXPLORER}&domain={{domain}}", modes=DOMAIN)` with no gate, and generalise:
   in DOMAIN mode, a call that has a `{domain}`-carrying variant (path or query) is emitted **only** in
   that variant. Add a generator check that fails when a DOMAIN profile contains an allow rule
   capturing no `{domain}` whose path is also granted by a rule that does — the unscoped one always
   shadows the scoped one.
 - **Write query flags explicitly.** The proxy now accepts `?useSavedDate` (present, any value) and
   `&{params}` (no constraint), but emit `useSavedDate=` / drop `{params}` when that is what you mean.

Add a conformance test: port the proxy matcher (or shell out to it) and, for every node of every
`.questions` file in this directory, assert that the concrete calls of refused nodes are refused and
those of granted nodes allowed, for a caller of `example.com` — and that the same calls on
`other.com` are refused in DOMAIN mode.
