/**
 * Resolver for /.proxy/allowed/urls rules.
 *
 * Rules are evaluated in order — first match wins.
 * If no rule matches, the URL is forbidden.
 *
 * Matching rules (from spec):
 *   - {var}         matches any single path segment
 *   - %@{var}       equivalent to {var} (email-address wildcard)
 *   - *             matches any remaining path segments (trailing only)
 *   - query strings are included in the comparison
 *   - {var} in query values matches any value
 */

export interface ProxyRule {
  endpoint: string;
  verb?: string[];
  denied?: boolean;
}

export type HttpVerb = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export class ProxyResolver {
  constructor(private readonly rules: ProxyRule[]) {}

  isAllowed(verb: HttpVerb, urlPattern: string): boolean {
    for (const rule of this.rules) {
      if (ruleMatches(rule, verb, urlPattern)) {
        return rule.denied !== true;
      }
    }
    return false; // no match → forbidden
  }
}

// ---------------------------------------------------------------------------
// Matching helpers
// ---------------------------------------------------------------------------

function ruleMatches(
  rule: ProxyRule,
  verb: HttpVerb,
  urlPattern: string
): boolean {
  if (rule.verb) {
    const upper = rule.verb.map((v) => v.toUpperCase());
    if (!upper.includes(verb.toUpperCase())) return false;
  }
  return endpointMatches(rule.endpoint, urlPattern);
}

function endpointMatches(ruleEndpoint: string, componentPattern: string): boolean {
  const [rulePath, ruleQuery] = splitOnQuery(ruleEndpoint);
  const [compPath, compQuery] = splitOnQuery(componentPattern);
  return pathMatches(rulePath, compPath) && queryMatches(ruleQuery, compQuery);
}

function splitOnQuery(pattern: string): [string, string] {
  const idx = pattern.indexOf("?");
  return idx === -1 ? [pattern, ""] : [pattern.slice(0, idx), pattern.slice(idx + 1)];
}

// ---------------------------------------------------------------------------
// Path matching
// ---------------------------------------------------------------------------

function pathMatches(rulePattern: string, compPattern: string): boolean {
  const rSegs = rulePattern.split("/");
  const cSegs = compPattern.split("/");
  return segmentsMatch(rSegs, 0, cSegs, 0);
}

function segmentsMatch(
  rSegs: string[],
  ri: number,
  cSegs: string[],
  ci: number
): boolean {
  // Both exhausted → match
  if (ri === rSegs.length && ci === cSegs.length) return true;

  // Rule exhausted but component still has segments → no match
  if (ri === rSegs.length) return false;

  const rSeg = rSegs[ri];

  // Trailing * in rule: matches one or more remaining component segments
  if (rSeg === "*") {
    // * must be the last segment in the rule
    if (ri === rSegs.length - 1) return ci < cSegs.length;
    // * in a non-trailing position: consume one component segment and continue
    if (ci >= cSegs.length) return false;
    return segmentsMatch(rSegs, ri + 1, cSegs, ci + 1);
  }

  // Component exhausted but rule still has segments → no match
  if (ci === cSegs.length) return false;

  const cSeg = cSegs[ci];

  // {var} or %@{var} on either side matches any single segment
  if (isPathVar(rSeg) || isPathVar(cSeg)) {
    return segmentsMatch(rSegs, ri + 1, cSegs, ci + 1);
  }

  // Literal match
  if (rSeg !== cSeg) return false;
  return segmentsMatch(rSegs, ri + 1, cSegs, ci + 1);
}

function isPathVar(segment: string): boolean {
  return /^\{[^}]+\}$/.test(segment) || /^%@\{[^}]+\}$/.test(segment);
}

// ---------------------------------------------------------------------------
// Query string matching
// ---------------------------------------------------------------------------

function queryMatches(ruleQuery: string, compQuery: string): boolean {
  // Both empty → match
  if (!ruleQuery && !compQuery) return true;
  // One has query, other doesn't → no match
  if (!ruleQuery || !compQuery) return false;

  const rParams = parseQueryParams(ruleQuery);
  const cParams = parseQueryParams(compQuery);

  if (rParams.length !== cParams.length) return false;

  // Sort by key for order-independent comparison
  rParams.sort((a, b) => a.key.localeCompare(b.key));
  cParams.sort((a, b) => a.key.localeCompare(b.key));

  for (let i = 0; i < rParams.length; i++) {
    const r = rParams[i];
    const c = cParams[i];

    if (r.key !== c.key) return false;

    // If either value is (or contains) a {var} template, it matches anything
    if (isQueryVarValue(r.value) || isQueryVarValue(c.value)) continue;

    if (r.value !== c.value) return false;
  }

  return true;
}

interface QueryParam {
  key: string;
  value: string;
}

function parseQueryParams(query: string): QueryParam[] {
  return query
    .split("&")
    .filter(Boolean)
    .map((param) => {
      const eq = param.indexOf("=");
      if (eq === -1) return { key: param, value: "" };
      return { key: param.slice(0, eq), value: param.slice(eq + 1) };
    });
}

/** A query value is a variable placeholder if it contains any {…} template. */
function isQueryVarValue(value: string): boolean {
  return /\{[^}]+\}/.test(value);
}
