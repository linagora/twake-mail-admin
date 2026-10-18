# Twake Mail Admin — end to end tests

A regression net for the admin app: a real browser driving the real production image of the
app, built from this checkout with the release `Dockerfile`, against real backends. No mock, no
stub. Both flavours of the app are under test:

| Flavour | Backend | Test plan |
|---|---|---|
| Twake Mail Admin (`APPLICATION=MAIL`) | distributed tmail-backend (Cassandra, OpenSearch, RabbitMQ, S3, Redis, Tika) | [twake-qa/twake-mail-admin/TEST_PLAN.md](https://github.com/linagora/twake-qa) |
| Twake Calendar Admin (`APPLICATION=CALENDAR`) | twake-calendar side service (esn-sabre, MongoDB, OpenLDAP, OpenSearch, RabbitMQ, Redis, mock SMTP) | twake-qa/twake-calendar-admin/TEST_PLAN.md |

Java + JUnit 5 + [Playwright](https://playwright.dev/java/), docker compose. Every test quotes the
identifier of the test plan case it automates in its `@DisplayName` (`DOM-01 Create a domain`):
that is what keeps the plan and the code connected.

---

## Running it

```bash
cd e2e
./pre-build.sh      # the admin app image from the working tree, the backend images, chromium
mvn clean test
```

Re-run `./pre-build.sh` whenever the code under test changes: the suite tests the image, not the
sources. `./pre-build.sh --skip-admin` only refreshes the backend images.

Run one class, one test, or one area:

```bash
mvn test -Dtest=DomainsTest
mvn test -Dtest=DomainsTest#createDomain
mvn test -Dtest='com/linagora/admin/e2e/calendar/**'
```

| Variable / property | Effect |
|---|---|
| `E2E_REUSE_STACK=true` | Keeps the docker stacks between runs (see below): a run then starts in seconds |
| `E2E_HEADLESS=false` | Shows the browser |
| `E2E_SLOWMO=300` | Slows every action down by 300 ms |
| `E2E_TRACE=always` | Records a Playwright trace for every test, not only failures |
| `TMAIL_BACKEND_IMAGE=...` | The tmail-backend image to test against (default `linagora/tmail-backend:distributed-1.0.22`) |
| `-De2e.parallelism=4` | Test classes running at the same time |
| `-De2e.build.dir=target-x` | Another build directory, to run two checkouts side by side |
| `-De2e.excludedGroups=` | Also runs the `known-bug` tests, see below |

A failing test leaves a full page screenshot and a trace under
`target/e2e-artifacts/<Class>/<method>/`. Replay one with
`npx playwright show-trace target/e2e-artifacts/<Class>/<method>/trace.zip`.

### The stacks

Both stacks are started with `docker compose` once per run, lazily: a run of Mail tests only
never boots the Calendar stack. They boot in parallel in about two minutes, and are dropped at
the end of the run.

With `E2E_REUSE_STACK=true` they are kept, under the fixed project names
`twake-admin-e2e-mail` and `twake-admin-e2e-calendar`, and the next run attaches to them. That is
the way to iterate on a test. Tests do not depend on a fresh stack (see Isolation), so a reused
one is as good as a new one. Drop them with
`docker compose -p twake-admin-e2e-mail down -v` (resp. `-calendar`).

### What it costs

The budget of the whole suite is **30 minutes** on CI, stack boot included. What keeps it there:

- the stacks boot once per run, in parallel;
- four test classes run at a time (`junit-platform.properties`, `-De2e.parallelism`);
- fixtures are seeded through WebAdmin, in Java, not through the UI: only the step under test
  goes through the browser;
- no fixed wait anywhere: Playwright assertions and Awaitility poll.

---

## Writing a test

```java
class DomainAliasesTest extends MailAdminE2ETest {

    @Test
    @DisplayName("DOM-09 Domain aliases: add and remove")
    void addAlias(AdminApp app, MailFixtures fixtures, WebAdmin webAdmin) {
        String domain = fixtures.domain();
        String alias = fixtures.newDomain("alias");

        app.open("/domains/domain/" + domain);
        ...

        assertThat(webAdmin.get("/domains/" + domain + "/aliases").body()).contains(alias);
    }
}
```

Extend `MailAdminE2ETest` or `CalendarAdminE2ETest`, and declare what the test needs as method
parameters:

| Parameter | What it is |
|---|---|
| `AdminApp` | The shell of the app: `open(path)`, sidebar, dialogs, toasts |
| `Page`, `BrowserContext` | Playwright, on a fresh browser context |
| `MailFixtures` | Mail: the test's own domain (`domain()`), users, SMTP delivery |
| `CalendarFixtures` | Calendar: fresh registered / unregistered / LDAP-only users |
| `WebAdmin` | The WebAdmin of the stack, to seed data and to assert outcomes server side |
| `MailStack`, `CalendarStack` | The docker stacks, for their URLs |
| `BrowserLog` | Console errors, page errors and failed requests of the test |

Page objects live under `pages/`, one package per area. **Locate by role and accessible name**
(`getByRole`, `getByLabel`, visible text), never by tailwind class: classes are styling, not
identity. **Prefer `PlaywrightAssertions.assertThat(locator)`**: it retries until the timeout,
it does not race the rendering. Back a UI assertion with a WebAdmin one when it matters: the
screen can lie, the backend cannot.

### Known bugs

A test that reproduces a product bug not fixed yet stays in the suite, asserting the correct
behaviour, tagged `@Tag("known-bug")` with a comment saying what is wrong. Those tests are
excluded by default, so the suite stays green; run them with `-De2e.excludedGroups=`. Fixing the
bug means removing the tag.

---

## Isolation

The stacks are shared by every test, four classes at a time, so a test never relies on data it
did not create, and never modifies it:

- **Mail**: the **domain** is the unit of isolation. `fixtures.domain()` is a brand new domain of
  the running test, created on first use; its users, aliases, quotas, team mailboxes live there.
- **Calendar**: the side service only serves `open-paas.org`, so the **user** is the unit of
  isolation: every account a test asks for is brand new. Resources, team calendars and domains
  get unique names (`Ids.unique`).

Nothing has to be cleaned up afterwards. Searches filter on the unique names, assertions never
count a whole server wide list.

State a backend holds globally (global quota, the task list, event dead letters, mail
repositories, server wide maintenance tasks, the settings of `open-paas.org`) cannot be isolated
that way: the classes driving it take a `@ResourceLock` (`docker/Locks.java`), so that no other
class touching the same state runs at the same time, and restore what they change.

---

## How the addressing works

The admin app reads the URL of WebAdmin from `env.js`, mounted into the container before docker
has picked any host port. So the URLs are fixed (`src/test/resources/{mail,calendar}/env.js`) and
the **browser** is taught to resolve them, through Chromium's `--host-resolver-rules`:

| The browser talks to | Which really is |
|---|---|
| `http://localhost:8098` | the Mail admin app (nginx serving the production bundle) |
| `http://webadmin-mail` | WebAdmin of tmail-backend |
| `http://localhost:8097` | the Calendar admin app |
| `http://webadmin-calendar` | WebAdmin of the side service |

Nothing listens on 8097 / 8098: the ports are made up, the resolver rewrites them onto the ports
docker published on `127.0.0.1`. No fixed host port, no clash between two concurrent runs, and
the cross origin topology of a real deployment is kept, which is how CORS regressions get caught.
The admin app keeps a `localhost` origin so that it runs in a secure context, as in production
behind https.

---

## Layout

```
e2e/
├── pre-build.sh                    builds the images and installs chromium
├── docker/                         Dockerfiles of the calendar backend images, configuration baked in
└── src/test/
    ├── java/com/linagora/admin/e2e/
    │   ├── MailAdminE2ETest, CalendarAdminE2ETest   base classes
    │   ├── docker/                 the compose stacks and the JUnit / Playwright wiring
    │   ├── backend/                WebAdmin client, fixtures
    │   ├── pages/                  page objects, per area
    │   ├── mail/                   the Mail tests, per area
    │   └── calendar/               the Calendar tests, per area
    └── resources/
        ├── docker-mail-e2e.yml, docker-calendar-e2e.yml
        ├── webadmin.properties     CORS open, no authentication
        ├── mail/                   env.js, tmail-backend configuration
        └── calendar/               env.js, side service configuration (a copy of twake-calendar-frontend's e2e)
```

`scripts/qa-environment/` starts the same backends for manual / agent driven exploratory QA; this
suite is the automated counterpart of the test plans written there.

---

## CI

The `End to end tests` stage of the root `Jenkinsfile` runs `./pre-build.sh` then `mvn clean test`
on every build. Surefire reports are published, failure artifacts archived.

## Coverage

[`COVERAGE.md`](COVERAGE.md) maps every case of both test plans to the test automating it, or
says why it is not automated.
