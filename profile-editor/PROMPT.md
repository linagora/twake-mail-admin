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
