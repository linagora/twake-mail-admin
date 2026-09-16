import { describe, it, expect } from "vitest";
import { ProxyResolver, type ProxyRule, type HttpVerb } from "./proxy-resolver";

// Helper: build a resolver and call isAllowed
function resolve(
  rules: ProxyRule[],
  verb: HttpVerb,
  pattern: string
): boolean {
  return new ProxyResolver(rules).isAllowed(verb, pattern);
}

// ---------------------------------------------------------------------------
// 1. Bootstrap: no restriction mode
// ---------------------------------------------------------------------------

describe("no restrictions (empty rules / 204)", () => {
  it("returns false for every call when rules are empty", () => {
    // Per spec: when GET /.proxy/allowed/urls returns 204 the caller
    // should infer NO RESTRICTIONS — that logic lives outside the resolver.
    // The resolver itself with zero rules simply returns false (no match).
    expect(resolve([], "GET", "/domains")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Basic allow / deny / no-match
// ---------------------------------------------------------------------------

describe("basic allow / deny / no-match", () => {
  it("allows when a matching rule has no denied flag", () => {
    const rules: ProxyRule[] = [{ endpoint: "/domains" }];
    expect(resolve(rules, "GET", "/domains")).toBe(true);
  });

  it("allows when a matching rule has denied: false", () => {
    const rules: ProxyRule[] = [{ endpoint: "/domains", denied: false }];
    expect(resolve(rules, "GET", "/domains")).toBe(true);
  });

  it("denies when the matching rule has denied: true", () => {
    const rules: ProxyRule[] = [{ endpoint: "/domains", denied: true }];
    expect(resolve(rules, "GET", "/domains")).toBe(false);
  });

  it("forbids when no rule matches (falls off the end)", () => {
    const rules: ProxyRule[] = [{ endpoint: "/other" }];
    expect(resolve(rules, "GET", "/domains")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. First-match-wins ordering
// ---------------------------------------------------------------------------

describe("first-match-wins", () => {
  it("deny rule before allow rule → denied", () => {
    const rules: ProxyRule[] = [
      { endpoint: "/domains/{domain}/quota", denied: true },
      { endpoint: "/domains/{domain}/quota" },
    ];
    expect(resolve(rules, "GET", "/domains/{domain}/quota")).toBe(false);
  });

  it("allow rule before deny rule → allowed", () => {
    const rules: ProxyRule[] = [
      { endpoint: "/domains/{domain}/quota" },
      { endpoint: "/domains/{domain}/quota", denied: true },
    ];
    expect(resolve(rules, "GET", "/domains/{domain}/quota")).toBe(true);
  });

  it("specific deny + broad wildcard allow → denied", () => {
    const rules: ProxyRule[] = [
      { endpoint: "/domains/{domain}/quota", denied: true },
      { endpoint: "/domains/*" },
    ];
    expect(resolve(rules, "GET", "/domains/{domain}/quota")).toBe(false);
  });

  it("broad wildcard allow + specific deny → allowed (wildcard matched first)", () => {
    const rules: ProxyRule[] = [
      { endpoint: "/domains/*" },
      { endpoint: "/domains/{domain}/quota", denied: true },
    ];
    expect(resolve(rules, "GET", "/domains/{domain}/quota")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Verb matching
// ---------------------------------------------------------------------------

describe("verb matching", () => {
  const rules: ProxyRule[] = [
    { verb: ["GET"], endpoint: "/domains/{domain}/users" },
    { endpoint: "/domains/{domain}/aliases/*" },
  ];

  it("matches when verb is in the allowed list", () => {
    expect(resolve(rules, "GET", "/domains/{domain}/users")).toBe(true);
  });

  it("does not match when verb is absent from the allowed list", () => {
    expect(resolve(rules, "POST", "/domains/{domain}/users")).toBe(false);
  });

  it("matches any verb when rule has no verb restriction", () => {
    expect(resolve(rules, "PUT", "/domains/{domain}/aliases/foo")).toBe(true);
    expect(resolve(rules, "DELETE", "/domains/{domain}/aliases/foo")).toBe(true);
  });

  it("verb comparison is case-insensitive", () => {
    const r: ProxyRule[] = [{ verb: ["get"], endpoint: "/domains" }];
    expect(resolve(r, "GET", "/domains")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Path variable matching  ({var} and %@{var})
// ---------------------------------------------------------------------------

describe("path variable matching", () => {
  it("{var} in rule matches any single segment in component", () => {
    const rules: ProxyRule[] = [{ endpoint: "/domains/{domain}/users" }];
    expect(resolve(rules, "GET", "/domains/{domain}/users")).toBe(true);
    expect(resolve(rules, "GET", "/domains/{d}/users")).toBe(true);
  });

  it("{var} in component matches any single segment in rule", () => {
    const rules: ProxyRule[] = [{ endpoint: "/domains/example.com/users" }];
    expect(resolve(rules, "GET", "/domains/{domain}/users")).toBe(true);
  });

  it("{var} matches only a single segment, not multiple", () => {
    const rules: ProxyRule[] = [{ endpoint: "/domains/{domain}" }];
    expect(resolve(rules, "GET", "/domains/{domain}/users")).toBe(false);
  });

  it("%@{var} in rule is treated as a single-segment variable", () => {
    const rules: ProxyRule[] = [
      { endpoint: "/deletedMessages/users/%@{domain}/messages" },
    ];
    expect(
      resolve(rules, "POST", "/deletedMessages/users/{mailbox}/messages")
    ).toBe(true);
  });

  it("%@{var} in component matches literal in rule", () => {
    const rules: ProxyRule[] = [
      { endpoint: "/deletedMessages/users/{user}/messages" },
    ];
    expect(
      resolve(rules, "POST", "/deletedMessages/users/%@{domain}/messages")
    ).toBe(true);
  });

  it("variable names are irrelevant: {def} ≡ {ghi}", () => {
    const rules: ProxyRule[] = [{ endpoint: "/abc/{ghi}" }];
    expect(resolve(rules, "GET", "/abc/{def}")).toBe(true);
  });

  it("different path lengths don't match", () => {
    const rules: ProxyRule[] = [{ endpoint: "/a/{b}" }];
    expect(resolve(rules, "GET", "/a/{b}/c")).toBe(false);
    expect(resolve(rules, "GET", "/a")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. Wildcard * matching
// ---------------------------------------------------------------------------

describe("wildcard * matching", () => {
  it("trailing * matches one remaining segment", () => {
    const rules: ProxyRule[] = [{ endpoint: "/domains/{domain}/aliases/*" }];
    expect(resolve(rules, "PUT", "/domains/{domain}/aliases/{source}")).toBe(true);
  });

  it("trailing * matches multiple remaining segments", () => {
    const rules: ProxyRule[] = [{ endpoint: "/mailRepositories/*" }];
    expect(
      resolve(rules, "GET", "/mailRepositories/{encodedPath}/mails/{mailKey}")
    ).toBe(true);
  });

  it("trailing * matches zero remaining segments", () => {
    const rules: ProxyRule[] = [{ endpoint: "/domains/*" }];
    // component has nothing after /domains/
    expect(resolve(rules, "GET", "/domains/")).toBe(true);
  });

  it("trailing * matches a path with a query string when rule has no query", () => {
    const rules: ProxyRule[] = [{ endpoint: "/domains/*" }];
    // A rule without query imposes no query constraint
    expect(
      resolve(rules, "POST", "/domains/{domain}?action=deleteData")
    ).toBe(true);
  });

  it("* must match the path segment position exactly", () => {
    const rules: ProxyRule[] = [{ endpoint: "/a/*/b" }];
    // * in non-trailing position consumes one segment
    expect(resolve(rules, "GET", "/a/x/b")).toBe(true);
    expect(resolve(rules, "GET", "/a/b")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7. Query string matching
// ---------------------------------------------------------------------------

describe("query string matching", () => {
  it("both no query → match", () => {
    const rules: ProxyRule[] = [{ endpoint: "/users/{username}/mailboxes" }];
    expect(resolve(rules, "GET", "/users/{username}/mailboxes")).toBe(true);
  });

  it("rule has no query, component has query → match (no query constraint)", () => {
    const rules: ProxyRule[] = [{ endpoint: "/users/{username}/mailboxes" }];
    expect(
      resolve(rules, "POST", "/users/{username}/mailboxes?task=reIndex")
    ).toBe(true);
  });

  it("rule has query, component has no query → no match", () => {
    const rules: ProxyRule[] = [
      { endpoint: "/users/{username}/mailboxes?task=reIndex" },
    ];
    expect(resolve(rules, "POST", "/users/{username}/mailboxes")).toBe(false);
  });

  it("same literal query values → match", () => {
    const rules: ProxyRule[] = [
      { endpoint: "/users/{username}/mailboxes?task=reIndex" },
    ];
    expect(
      resolve(rules, "POST", "/users/{username}/mailboxes?task=reIndex")
    ).toBe(true);
  });

  it("different literal query values → no match", () => {
    const rules: ProxyRule[] = [
      { endpoint: "/users/{username}/mailboxes?task=reIndex" },
    ];
    expect(
      resolve(rules, "POST", "/users/{username}/mailboxes?task=subscribeAll")
    ).toBe(false);
  });

  it("{var} in rule query value matches any component query value", () => {
    const rules: ProxyRule[] = [
      { endpoint: "/tasks?olderThan={value}" },
    ];
    expect(resolve(rules, "DELETE", "/tasks?olderThan=5day")).toBe(true);
    expect(resolve(rules, "DELETE", "/tasks?olderThan=30day")).toBe(true);
  });

  it("{var} in component query value matches any rule query value", () => {
    const rules: ProxyRule[] = [
      { endpoint: "/tasks?olderThan=5day" },
    ];
    expect(resolve(rules, "DELETE", "/tasks?olderThan={days}day")).toBe(true);
  });

  it("partial template in query value (e.g. {days}day) is treated as a variable", () => {
    const rules: ProxyRule[] = [
      { endpoint: "/tasks?olderThan={value}" },
    ];
    expect(resolve(rules, "DELETE", "/tasks?olderThan={days}day")).toBe(true);
  });

  it("multi-param query: order-independent match", () => {
    const rules: ProxyRule[] = [
      {
        endpoint:
          "/quota/users?minOccupationRatio={min}&maxOccupationRatio={max}&limit={limit}&offset={offset}",
      },
    ];
    // Component declares same params in different order
    expect(
      resolve(
        rules,
        "GET",
        "/quota/users?offset={offset}&limit={limit}&maxOccupationRatio={max}&minOccupationRatio={min}"
      )
    ).toBe(true);
  });

  it("missing query param → no match, extra query param → ignored", () => {
    const rules: ProxyRule[] = [{ endpoint: "/foo?a=1&b=2" }];
    expect(resolve(rules, "GET", "/foo?a=1")).toBe(false);
    expect(resolve(rules, "GET", "/foo?a=1&b=2&c=3")).toBe(true);
  });

  it("different query keys → no match", () => {
    const rules: ProxyRule[] = [{ endpoint: "/foo?task=reIndex" }];
    expect(resolve(rules, "POST", "/foo?action=reIndex")).toBe(false);
  });

  it("query with no value (flag param) matches flag param", () => {
    const rules: ProxyRule[] = [
      { endpoint: "/reports/quota/users?hasSpecificQuota" },
    ];
    expect(
      resolve(rules, "GET", "/reports/quota/users?hasSpecificQuota")
    ).toBe(true);
  });

  it("query flag param in rule accepts any value", () => {
    const rules: ProxyRule[] = [
      { endpoint: "/reports/quota/users?hasSpecificQuota" },
    ];
    expect(
      resolve(rules, "GET", "/reports/quota/users?hasSpecificQuota=true")
    ).toBe(true);
    expect(resolve(rules, "GET", "/reports/quota/users")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 8. Spec example rules
// ---------------------------------------------------------------------------

describe("spec example rule set", () => {
  const rules: ProxyRule[] = [
    { denied: true, endpoint: "/domains/{domain}/quota" },
    { verb: ["GET"], endpoint: "/domains/{domain}/users" },
    { endpoint: "/domains/{domain}/aliases/*" },
  ];

  it("GET /domains/{d}/quota → denied (first rule)", () => {
    expect(resolve(rules, "GET", "/domains/{domain}/quota")).toBe(false);
  });

  it("PUT /domains/{d}/quota → forbidden (verb mismatch on rule 2, no rule 3 match)", () => {
    // Rule 1: denied=true, matches → denied
    expect(resolve(rules, "PUT", "/domains/{domain}/quota")).toBe(false);
  });

  it("GET /domains/{d}/users → allowed (rule 2)", () => {
    expect(resolve(rules, "GET", "/domains/{domain}/users")).toBe(true);
  });

  it("POST /domains/{d}/users → forbidden (rule 2 verb mismatch, no other match)", () => {
    expect(resolve(rules, "POST", "/domains/{domain}/users")).toBe(false);
  });

  it("PUT /domains/{d}/aliases/{source} → allowed (rule 3 wildcard)", () => {
    expect(resolve(rules, "PUT", "/domains/{domain}/aliases/{source}")).toBe(true);
  });

  it("DELETE /domains/{d}/aliases/{source} → allowed (rule 3, any verb)", () => {
    expect(
      resolve(rules, "DELETE", "/domains/{domain}/aliases/{source}")
    ).toBe(true);
  });

  it("/something/else → forbidden (no match)", () => {
    expect(resolve(rules, "GET", "/something/else")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 9. Real patterns from validation.md
// ---------------------------------------------------------------------------

describe("real patterns from validation.md", () => {
  // --- Tasks with query strings ---
  it("DELETE /tasks?olderThan={days}day is distinct from DELETE /tasks", () => {
    const rules: ProxyRule[] = [
      { endpoint: "/tasks?olderThan={value}", verb: ["DELETE"] },
      { endpoint: "/tasks" },
    ];
    expect(resolve(rules, "DELETE", "/tasks?olderThan={days}day")).toBe(true);
    expect(resolve(rules, "GET", "/tasks")).toBe(true);
    // verb mismatch on rule 1, rule 2 imposes no query constraint
    expect(resolve(rules, "GET", "/tasks?olderThan={days}day")).toBe(true);
  });

  // --- action= style tasks ---
  it("POST /users/{username}?action=deleteData is distinct from POST /users/{username}", () => {
    const rules: ProxyRule[] = [
      { endpoint: "/users/{username}?action=deleteData" },
    ];
    expect(
      resolve(rules, "POST", "/users/{username}?action=deleteData")
    ).toBe(true);
    expect(resolve(rules, "POST", "/users/{username}")).toBe(false);
  });

  // --- mailboxes task variants ---
  it("mailbox task variants are distinct query patterns", () => {
    const rules: ProxyRule[] = [
      { endpoint: "/users/{username}/mailboxes?task=reIndex" },
      { endpoint: "/users/{username}/mailboxes?task=subscribeAll" },
    ];
    expect(
      resolve(rules, "POST", "/users/{username}/mailboxes?task=reIndex")
    ).toBe(true);
    expect(
      resolve(rules, "POST", "/users/{username}/mailboxes?task=subscribeAll")
    ).toBe(true);
    expect(
      resolve(
        rules,
        "POST",
        "/users/{username}/mailboxes?task=recomputeFastViewProjectionItems"
      )
    ).toBe(false);
    expect(resolve(rules, "GET", "/users/{username}/mailboxes")).toBe(false);
  });

  // --- domain-mode tasks ---
  it("DOMAIN mode: only /domains/{domain}/tasks/{id} is evaluated", () => {
    const rules: ProxyRule[] = [
      { endpoint: "/domains/{domain}/tasks/{id}" },
    ];
    expect(
      resolve(rules, "GET", "/domains/{domain}/tasks/{id}")
    ).toBe(true);
    // global pattern not in rules → forbidden
    expect(resolve(rules, "GET", "/tasks/{id}")).toBe(false);
  });

  // --- deep team-mailbox paths ---
  it("team-mailbox folder subaddressing path", () => {
    const rules: ProxyRule[] = [
      {
        endpoint:
          "/domains/{domain}/team-mailboxes/{mailbox}/mailboxes/{folderName}/subaddressing",
      },
    ];
    expect(
      resolve(
        rules,
        "GET",
        "/domains/{domain}/team-mailboxes/{mailbox}/mailboxes/{folderName}/subaddressing"
      )
    ).toBe(true);
    // Without the final segment → no match
    expect(
      resolve(
        rules,
        "GET",
        "/domains/{domain}/team-mailboxes/{mailbox}/mailboxes/{folderName}"
      )
    ).toBe(false);
  });

  // --- mailRepositories deep wildcard ---
  it("mailRepositories wildcard covers all nested paths", () => {
    const rules: ProxyRule[] = [{ endpoint: "/mailRepositories/*" }];
    expect(resolve(rules, "GET", "/mailRepositories")).toBe(false); // * requires at least one more segment
    expect(resolve(rules, "GET", "/mailRepositories/")).toBe(true);  // trailing slash counts as one segment
    expect(
      resolve(rules, "GET", "/mailRepositories/{encodedPath}/mails")
    ).toBe(true);
    expect(
      resolve(
        rules,
        "PATCH",
        "/mailRepositories/{encodedPath}/mails/{mailKey}"
      )
    ).toBe(true);
    // Query strings are covered too: the rule has no query constraint
    expect(
      resolve(
        rules,
        "PATCH",
        "/mailRepositories/{encodedPath}/mails?action=reprocess"
      )
    ).toBe(true);
  });

  // --- event dead-letter ---
  it("event dead-letter action query", () => {
    const rules: ProxyRule[] = [
      { endpoint: "/events/deadLetter?action=reDeliver" },
      { endpoint: "/events/deadLetter/groups/{group}?action=reDeliver" },
    ];
    expect(
      resolve(rules, "POST", "/events/deadLetter?action=reDeliver")
    ).toBe(true);
    expect(
      resolve(
        rules,
        "POST",
        "/events/deadLetter/groups/{group}?action=reDeliver"
      )
    ).toBe(true);
    // No action on dead-letter root → forbidden
    expect(resolve(rules, "GET", "/events/deadLetter")).toBe(false);
  });

  // --- event dead-letter: search by event ID ---
  it("event dead-letter search by event ID", () => {
    const rules: ProxyRule[] = [
      { endpoint: "/events/deadLetter?action=reDeliver" },
      { endpoint: "/events/deadLetter/groups/{group}?action=reDeliver" },
      { endpoint: "/events/deadLetter?eventId={eventId}" },
    ];
    // eventId query matches its own rule
    expect(
      resolve(rules, "GET", "/events/deadLetter?eventId=abc-123")
    ).toBe(true);
    // Extra parameters are ignored
    expect(
      resolve(
        rules,
        "GET",
        "/events/deadLetter?eventId=abc-123&extra=1"
      )
    ).toBe(true);
    // A reDeliver query matches the reDeliver rule, whatever the verb
    expect(
      resolve(rules, "GET", "/events/deadLetter?action=reDeliver")
    ).toBe(true);
    // eventId rule alone does not cover a different query key
    expect(
      resolve(
        [{ endpoint: "/events/deadLetter?eventId={eventId}" }],
        "GET",
        "/events/deadLetter?action=reDeliver"
      )
    ).toBe(false);
    // reDeliver rule alone does not cover an eventId query
    expect(
      resolve(
        [{ endpoint: "/events/deadLetter?action=reDeliver" }],
        "GET",
        "/events/deadLetter?eventId=abc-123"
      )
    ).toBe(false);
  });

  // --- calendar-only endpoints ---
  it("calendar: archive events has distinct path and query from other calendar ops", () => {
    const rules: ProxyRule[] = [
      { endpoint: "/calendars?task=archive" },
      { endpoint: "/calendars?task=reindex" },
    ];
    expect(resolve(rules, "POST", "/calendars?task=archive")).toBe(true);
    expect(resolve(rules, "POST", "/calendars?task=reindex")).toBe(true);
    expect(resolve(rules, "POST", "/calendars?task=scheduleAlarms")).toBe(false);
  });

  // --- resource endpoints ---
  it("domain-scoped resources with repositionWriteRights query", () => {
    const rules: ProxyRule[] = [
      { endpoint: "/domains/{domain}/resources?task=repositionWriteRights" },
      { endpoint: "/domains/{domain}/resources/{resourceId}" },
      { endpoint: "/domains/{domain}/resources" },
    ];
    expect(
      resolve(
        rules,
        "POST",
        "/domains/{domain}/resources?task=repositionWriteRights"
      )
    ).toBe(true);
    expect(
      resolve(rules, "GET", "/domains/{domain}/resources/{resourceId}")
    ).toBe(true);
    expect(resolve(rules, "GET", "/domains/{domain}/resources")).toBe(true);
    // Legacy /resources routes not present → forbidden
    expect(resolve(rules, "GET", "/resources/{resourceId}")).toBe(false);
  });

  // --- quota users multi-param ---
  it("quota users multi-param explorer", () => {
    const rules: ProxyRule[] = [
      {
        endpoint:
          "/quota/users?minOccupationRatio={min}&maxOccupationRatio={max}&limit={limit}&offset={offset}",
      },
    ];
    expect(
      resolve(
        rules,
        "GET",
        "/quota/users?minOccupationRatio={min}&maxOccupationRatio={max}&limit={limit}&offset={offset}"
      )
    ).toBe(true);
    // Missing one param → no match
    expect(
      resolve(
        rules,
        "GET",
        "/quota/users?minOccupationRatio={min}&maxOccupationRatio={max}&limit={limit}"
      )
    ).toBe(false);
  });

  // --- scope= style endpoints ---
  it("blobs garbage collection with scope query", () => {
    const rules: ProxyRule[] = [
      { endpoint: "/blobs?scope=unreferenced" },
    ];
    expect(resolve(rules, "DELETE", "/blobs?scope=unreferenced")).toBe(true);
    expect(resolve(rules, "DELETE", "/blobs?scope=other")).toBe(false);
    expect(resolve(rules, "DELETE", "/blobs")).toBe(false);
  });

  // --- force= query flag ---
  it("search deleted messages with force=true query flag", () => {
    const rules: ProxyRule[] = [
      {
        endpoint:
          "/deletedMessages/users/{mailbox}/messages?force=true",
      },
    ];
    expect(
      resolve(
        rules,
        "POST",
        "/deletedMessages/users/{mailbox}/messages?force=true"
      )
    ).toBe(true);
    // Without force flag → no match
    expect(
      resolve(rules, "POST", "/deletedMessages/users/{mailbox}/messages")
    ).toBe(false);
  });

  // --- rename with nested path and query ---
  it("rename user endpoint with action query", () => {
    const rules: ProxyRule[] = [
      { endpoint: "/users/{username}/rename/{newUsername}?action=rename" },
    ];
    expect(
      resolve(
        rules,
        "POST",
        "/users/{username}/rename/{newUsername}?action=rename"
      )
    ).toBe(true);
    // Without query → no match
    expect(
      resolve(rules, "POST", "/users/{username}/rename/{newUsername}")
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 10. Edge cases
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  it("root path / matches root path /", () => {
    const rules: ProxyRule[] = [{ endpoint: "/" }];
    expect(resolve(rules, "GET", "/")).toBe(true);
  });

  it("empty verb array in rule never matches", () => {
    const rules: ProxyRule[] = [{ verb: [], endpoint: "/domains" }];
    expect(resolve(rules, "GET", "/domains")).toBe(false);
  });

  it("multiple {var} segments in a row all match", () => {
    const rules: ProxyRule[] = [{ endpoint: "/{a}/{b}/{c}" }];
    expect(resolve(rules, "GET", "/{x}/{y}/{z}")).toBe(true);
    expect(resolve(rules, "GET", "/{x}/{y}")).toBe(false);
  });

  it("PATCH verb is supported", () => {
    const rules: ProxyRule[] = [
      { verb: ["PATCH"], endpoint: "/resources/{id}" },
    ];
    expect(resolve(rules, "PATCH", "/resources/{id}")).toBe(true);
    expect(resolve(rules, "GET", "/resources/{id}")).toBe(false);
  });

  it("multiple rules, correct one matched in sequence", () => {
    const rules: ProxyRule[] = [
      { endpoint: "/a" },
      { endpoint: "/b" },
      { endpoint: "/c" },
    ];
    expect(resolve(rules, "GET", "/a")).toBe(true);
    expect(resolve(rules, "GET", "/b")).toBe(true);
    expect(resolve(rules, "GET", "/c")).toBe(true);
    expect(resolve(rules, "GET", "/d")).toBe(false);
  });

  it("deny before a general allow stops the search at the deny", () => {
    const rules: ProxyRule[] = [
      { denied: true, endpoint: "/domains/{d}/quota" },
      { endpoint: "/*" },
    ];
    expect(resolve(rules, "GET", "/domains/{d}/quota")).toBe(false);
    expect(resolve(rules, "GET", "/domains/{d}/users")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 11. Proxy conformance: rule without query (AllowedUrlTest.java)
// ---------------------------------------------------------------------------

describe("proxy conformance: rule without query", () => {
  it("patternWithoutQueryShouldMatchPathWithQueryParams", () => {
    expect(resolve([{ endpoint: "/users" }], "GET", "/users?limit=10")).toBe(true);
  });

  it("a deny without query denies every query: deleteData is not a distinct endpoint", () => {
    const rules: ProxyRule[] = [
      { endpoint: "/users/%@{domain}", denied: true },
      { endpoint: "/users/*" },
    ];
    expect(resolve(rules, "POST", "/users/{username}?action=deleteData")).toBe(false);
  });

  it("an allow without query allows every query", () => {
    const rules: ProxyRule[] = [{ endpoint: "/users/%@{domain}" }];
    expect(resolve(rules, "POST", "/users/{username}?action=deleteData")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 12. Proxy conformance: parameters the rule does not list (AllowedUrlTest.java)
// ---------------------------------------------------------------------------

describe("proxy conformance: extra query parameters", () => {
  const rule: ProxyRule[] = [{ endpoint: "/users?domain={domain}" }];
  const two: ProxyRule[] = [{ endpoint: "/users?domain={domain}&active=true" }];

  it("shouldMatchWhenRequiredQueryParamPresent", () => {
    expect(resolve(rule, "GET", "/users?domain=example.com")).toBe(true);
  });

  it("shouldNotMatchWhenRequiredQueryParamMissing", () => {
    expect(resolve(rule, "GET", "/users")).toBe(false);
  });

  it("shouldNotMatchWhenRequiredQueryParamHasDifferentName", () => {
    expect(resolve(rule, "GET", "/users?tenant=example.com")).toBe(false);
  });

  it("shouldMatchWithExtraQueryParams", () => {
    expect(resolve(rule, "GET", "/users?domain=example.com&limit=10")).toBe(true);
  });

  it("shouldMatchLiteralQueryParamValue", () => {
    const r: ProxyRule[] = [{ endpoint: "/users?active=true" }];
    expect(resolve(r, "GET", "/users?active=true")).toBe(true);
    expect(resolve(r, "GET", "/users?active=false")).toBe(false);
  });

  it("shouldMatchWhenMultipleRequiredParamsPresentInSameOrder / InReverseOrder", () => {
    expect(resolve(two, "GET", "/users?domain=example.com&active=true")).toBe(true);
    expect(resolve(two, "GET", "/users?active=true&domain=example.com")).toBe(true);
  });

  it("shouldNotMatchWhenOneOfMultipleRequiredParamsIsMissing / AllRequiredParamsMissing", () => {
    expect(resolve(two, "GET", "/users?domain=example.com")).toBe(false);
    expect(resolve(two, "GET", "/users")).toBe(false);
  });

  it("shouldMatchWithExtraParamsAlongsideMultipleRequiredParams", () => {
    expect(resolve(two, "GET", "/users?limit=10&domain=example.com&active=true")).toBe(true);
  });

  it("shouldNotMatchWhenLiteralParamValueWrongAmongMultiple", () => {
    expect(resolve(two, "GET", "/users?domain=example.com&active=false")).toBe(false);
  });

  it("percentAtDomainInQueryParamShouldMatchWithExtraParams", () => {
    const r: ProxyRule[] = [{ endpoint: "/messages?user=%@{domain}" }];
    expect(
      resolve(r, "DELETE", "/messages?olderThan=1d&mailbox=Trash&user=btellier@linagora.com&useSavedDate=")
    ).toBe(true);
    expect(resolve(r, "DELETE", "/messages?user=btellier")).toBe(false);
  });

  it("the unscoped quota explorer rule also matches the domain-filtered call", () => {
    const r: ProxyRule[] = [
      { endpoint: "/quota/users?minOccupationRatio={min}&maxOccupationRatio={max}&limit={limit}&offset={offset}" },
    ];
    expect(
      resolve(
        r,
        "GET",
        "/quota/users?minOccupationRatio={min}&maxOccupationRatio={max}&limit={limit}&offset={offset}&domain={domain}"
      )
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 13. Proxy conformance: flag-style parameters (AllowedUrlTest.java)
// ---------------------------------------------------------------------------

describe("proxy conformance: flag-style parameters", () => {
  it("valuelessQueryParamPatternShouldRequireParamPresentWithAnyValue", () => {
    const r: ProxyRule[] = [{ endpoint: "/quota/users?hasSpecificQuota" }];
    expect(resolve(r, "GET", "/quota/users?hasSpecificQuota")).toBe(true);
    expect(resolve(r, "GET", "/quota/users?hasSpecificQuota=")).toBe(true);
    expect(resolve(r, "GET", "/quota/users?hasSpecificQuota=true")).toBe(true);
    expect(resolve(r, "GET", "/quota/users")).toBe(false);
  });

  it("valuelessQueryParamPatternShouldBeSupportedAmongValuedOnes", () => {
    const r: ProxyRule[] = [{ endpoint: "/messages?user={user}&useSavedDate" }];
    expect(resolve(r, "DELETE", "/messages?user=bob@example.com&useSavedDate")).toBe(true);
    expect(resolve(r, "DELETE", "/messages?user=bob@example.com")).toBe(false);
  });

  it("emptyValuePatternShouldRequireFlagParamPresent", () => {
    const r: ProxyRule[] = [{ endpoint: "/quota/users?hasSpecificQuota=" }];
    expect(resolve(r, "GET", "/quota/users?hasSpecificQuota")).toBe(true);
    expect(resolve(r, "GET", "/quota/users?hasSpecificQuota=")).toBe(true);
    expect(resolve(r, "GET", "/quota/users")).toBe(false);
    expect(resolve(r, "GET", "/quota/users?hasSpecificQuota=true")).toBe(false);
  });

  it("starValuePatternShouldRequireFlagParamPresentWithAnyValue", () => {
    const r: ProxyRule[] = [{ endpoint: "/quota/users?hasSpecificQuota=*" }];
    expect(resolve(r, "GET", "/quota/users?hasSpecificQuota")).toBe(true);
    expect(resolve(r, "GET", "/quota/users?hasSpecificQuota=true")).toBe(true);
    expect(resolve(r, "GET", "/quota/users")).toBe(false);
  });

  it("a ?flag= rule does not match a component that sends a variable value", () => {
    const r: ProxyRule[] = [{ endpoint: "/servers?reload-certificate=" }];
    expect(resolve(r, "POST", "/servers?reload-certificate")).toBe(true);
    expect(resolve(r, "POST", "/servers?reload-certificate={value}")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 14. Proxy conformance: other parameters placeholder (AllowedUrlTest.java)
// ---------------------------------------------------------------------------

describe("proxy conformance: {params} placeholder", () => {
  it("otherParamsPlaceholderShouldImposeNoConstraint", () => {
    const r: ProxyRule[] = [{ endpoint: "/users/%@{domain}/templates?action=provision&{params}" }];
    expect(resolve(r, "POST", "/users/bob@example.com/templates?action=provision")).toBe(true);
    expect(resolve(r, "POST", "/users/bob@example.com/templates?action=provision&from=a&to=b")).toBe(true);
    expect(resolve(r, "POST", "/users/bob@example.com/templates?from=a")).toBe(false);
  });

  it("otherParamsPlaceholderShouldBeTheWholeQuery", () => {
    const r: ProxyRule[] = [{ endpoint: "/tasks?{query_params}" }];
    expect(resolve(r, "GET", "/tasks")).toBe(true);
    expect(resolve(r, "GET", "/tasks?status=failed")).toBe(true);
  });

  it("otherParamsPlaceholderShouldNotCaptureAnyVariable", () => {
    const r: ProxyRule[] = [{ endpoint: "/domains/{domain}/tasks?{domain}" }];
    expect(resolve(r, "GET", "/domains/a.com/tasks?domain=other.com")).toBe(true);
  });

  it("a component {params} chunk may supply what an allow rule requires, never a deny rule", () => {
    const allow: ProxyRule[] = [{ endpoint: "/users?domain={domain}" }];
    expect(resolve(allow, "POST", "/users?{params}")).toBe(true);
    const deny: ProxyRule[] = [
      { endpoint: "/users?force=true", denied: true },
      { endpoint: "/users" },
    ];
    expect(resolve(deny, "POST", "/users?{params}")).toBe(true);
    expect(resolve(deny, "POST", "/users?force=true&{params}")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 15. Proxy conformance: wildcard * (AllowedUrlTest.java)
// ---------------------------------------------------------------------------

describe("proxy conformance: wildcard *", () => {
  it("wildcardShouldMatchAnything / MultipleSegments / EmptySuffix", () => {
    expect(resolve([{ endpoint: "/domains/{domain}/aliases/*" }], "GET", "/domains/example.com/aliases/bob@example.com")).toBe(true);
    const r: ProxyRule[] = [{ endpoint: "/prefix/*" }];
    expect(resolve(r, "GET", "/prefix/a/b/c")).toBe(true);
    expect(resolve(r, "GET", "/prefix/")).toBe(true);
    expect(resolve(r, "GET", "/prefix")).toBe(false);
  });

  it("wildcardShouldNotMatchUnrelatedPrefix", () => {
    expect(resolve([{ endpoint: "/prefix/*" }], "GET", "/other/foo")).toBe(false);
  });

  it("exactPatternShouldNotMatchPrefix / LongerPath", () => {
    expect(resolve([{ endpoint: "/domains" }], "GET", "/domains/example.com")).toBe(false);
    expect(resolve([{ endpoint: "/abc" }], "GET", "/abcdef")).toBe(false);
  });

  it("non-trailing * spans any number of segments", () => {
    const r: ProxyRule[] = [{ endpoint: "/a/*/b" }];
    expect(resolve(r, "GET", "/a/x/y/b")).toBe(true);
    expect(resolve(r, "GET", "/a/{x}/{y}/b")).toBe(true);
  });

  it("* inside a segment is a wildcard", () => {
    const r: ProxyRule[] = [{ endpoint: "/tasks*" }];
    expect(resolve(r, "GET", "/tasks")).toBe(true);
    expect(resolve(r, "GET", "/tasks/{id}")).toBe(true);
    expect(resolve([{ endpoint: "/users/*@linagora.com" }], "GET", "/users/{username}")).toBe(true);
    expect(resolve([{ endpoint: "/users/*@linagora.com" }], "GET", "/users/bob@other.com")).toBe(false);
  });

  it("* in a query value is a wildcard", () => {
    const r: ProxyRule[] = [{ endpoint: "/messages?mailbox=*" }];
    expect(resolve(r, "DELETE", "/messages?mailbox=Trash")).toBe(true);
    expect(resolve(r, "DELETE", "/messages?mailbox={mailbox}")).toBe(true);
    expect(resolve(r, "DELETE", "/messages")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 16. Proxy conformance: % email local part (AllowedUrlTest.java)
// ---------------------------------------------------------------------------

describe("proxy conformance: % email local part", () => {
  const users: ProxyRule[] = [{ endpoint: "/users/%@{domain}/*" }];

  it("percentShouldMatchLocalPartOfEmail / AnyLocalPart", () => {
    expect(resolve(users, "GET", "/users/bob@example.com/mailboxes")).toBe(true);
    expect(resolve(users, "GET", "/users/charlie.d@example.com/mailboxes/INBOX")).toBe(true);
  });

  it("percentShouldNotMatchAcrossAtSign / AcrossSlash / MissingLocalPart", () => {
    expect(resolve(users, "GET", "/users/bob/mailboxes")).toBe(false);
    expect(resolve(users, "GET", "/users/bob/extra@example.com/mailboxes")).toBe(false);
    expect(resolve(users, "GET", "/users/@example.com/mailboxes")).toBe(false);
  });

  it("listsSubDomainPatternShouldCaptureTenantDomain: %@lists.{domain} is a variable segment", () => {
    const r: ProxyRule[] = [{ verb: ["GET"], endpoint: "/mailingLists/%@lists.{domain}" }];
    expect(resolve(r, "GET", "/mailingLists/sales@lists.linagora.com")).toBe(true);
    expect(resolve(r, "GET", "/mailingLists/{address}")).toBe(true);
    expect(resolve(r, "GET", "/mailingLists/sales@linagora.com")).toBe(false);
  });

  it("memberPatternShouldCaptureListDomainRatherThanMemberDomain", () => {
    const r: ProxyRule[] = [{ verb: ["PUT", "DELETE"], endpoint: "/mailingLists/%@lists.{domain}/members/*" }];
    expect(resolve(r, "PUT", "/mailingLists/sales@lists.linagora.com/members/bob@linagora.com")).toBe(true);
    expect(resolve(r, "PUT", "/mailingLists/{address}/members/{member}")).toBe(true);
  });

  it("memberPatternShouldNotMatchOwnerManagement / ListDeletion", () => {
    const r: ProxyRule[] = [{ verb: ["PUT", "DELETE"], endpoint: "/mailingLists/%@lists.{domain}/members/*" }];
    expect(resolve(r, "PUT", "/mailingLists/sales@lists.linagora.com/owners/bob@linagora.com")).toBe(false);
    expect(resolve(r, "DELETE", "/mailingLists/sales@lists.linagora.com")).toBe(false);
  });

  it("domainQueryParamPatternShouldCaptureTenantDomain / ShouldNotMatchUnfilteredListing", () => {
    const r: ProxyRule[] = [{ verb: ["GET"], endpoint: "/mailingLists?domain=lists.{domain}" }];
    expect(resolve(r, "GET", "/mailingLists?domain=lists.linagora.com")).toBe(true);
    expect(resolve(r, "GET", "/mailingLists?domain={domain}")).toBe(true);
    expect(resolve(r, "GET", "/mailingLists?domain=linagora.com")).toBe(false);
    expect(resolve(r, "GET", "/mailingLists")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 17. Proxy conformance: repeated variables (AllowedUrlTest.java)
// ---------------------------------------------------------------------------

describe("proxy conformance: repeated variables", () => {
  const members = "/domains/{domain}/team-mailboxes/{mailbox}/members/%@{domain}";
  const scopedUsers = "/domains/{domain}/users?domain={domain}";

  it("sameVariableTwiceInPathShouldMatchConsistentValues / WithDifferentValuesShouldNotMatch", () => {
    const r: ProxyRule[] = [{ endpoint: members }];
    expect(resolve(r, "PUT", "/domains/example.com/team-mailboxes/sales/members/bob@example.com")).toBe(true);
    expect(resolve(r, "PUT", "/domains/example.com/team-mailboxes/sales/members/bob@other.com")).toBe(false);
  });

  it("sameVariableInPathAndQueryBothConsistentShouldMatch / WithDifferentValuesShouldNotMatch", () => {
    const r: ProxyRule[] = [{ endpoint: scopedUsers }];
    expect(resolve(r, "GET", "/domains/example.com/users?domain=example.com")).toBe(true);
    expect(resolve(r, "GET", "/domains/example.com/users?domain=other.com")).toBe(false);
  });

  it("allow rule: a component variable may satisfy the equality", () => {
    const r: ProxyRule[] = [{ endpoint: members }];
    expect(resolve(r, "PUT", "/domains/{domain}/team-mailboxes/{mailbox}/members/{username}")).toBe(true);
    expect(resolve(r, "PUT", "/domains/example.com/team-mailboxes/{mailbox}/members/{username}")).toBe(true);
    expect(resolve([{ endpoint: scopedUsers }], "GET", "/domains/{domain}/users?domain={other}")).toBe(true);
  });

  it("deny rule: only applies when the equality holds for every call", () => {
    const rules: ProxyRule[] = [
      { endpoint: members, denied: true },
      { endpoint: "/domains/{domain}/*" },
    ];
    // eve@other.com is not denied by the proxy: the deny must not hide the control
    expect(resolve(rules, "PUT", "/domains/{domain}/team-mailboxes/{mailbox}/members/{username}")).toBe(true);
    // Literal occurrences that are equal, or different
    expect(resolve(rules, "PUT", "/domains/a.com/team-mailboxes/{mailbox}/members/bob@a.com")).toBe(false);
    expect(resolve(rules, "PUT", "/domains/a.com/team-mailboxes/{mailbox}/members/bob@b.com")).toBe(true);
  });

  it("deny rule: the same whole component variable proves the equality", () => {
    const rules: ProxyRule[] = [{ endpoint: scopedUsers, denied: true }, { endpoint: "/*" }];
    expect(resolve(rules, "GET", "/domains/{domain}/users?domain={domain}")).toBe(false);
    expect(resolve(rules, "GET", "/domains/{domain}/users?domain={other}")).toBe(true);
    // Part of a component variable proves nothing
    const partial: ProxyRule[] = [{ endpoint: "/a/{d}/b/%@{d}", denied: true }, { endpoint: "/*" }];
    expect(resolve(partial, "GET", "/a/{x}/b/{x}")).toBe(true);
  });

  it("variableNamesWithUnderscoreShouldBeAccepted", () => {
    expect(resolve([{ endpoint: "/tasks/{task_id}" }], "GET", "/tasks/abc")).toBe(true);
  });
});
