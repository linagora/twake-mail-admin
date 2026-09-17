/**
 * Resolver for /.proxy/allowed/urls rules.
 *
 * Rules are evaluated in order — first match wins.
 * If no rule matches, the URL is forbidden.
 *
 * The matcher mirrors webadmin-proxy's (AllowedUrl.java, documented in its
 * docs/02-configuration.md, "Endpoint pattern syntax"). When the two disagree the UI
 * shows a button that answers 403 or hides one that works, and the profile editor
 * (profile-editor/, which ports this file) leaves holes in the deny rules it emits.
 *
 * Matching rules (from the proxy):
 *   - {var}     one or more characters other than '/'
 *   - %         an email local part: one or more characters other than '@' and '/'.
 *               `%@lists.{domain}` is a variable segment, not a literal
 *   - *         any characters, '/' included, possibly none — anywhere, including
 *               inside a segment or a query value. `/tasks/*` does not match `/tasks`
 *   - a variable repeated in a rule (twice in the path, or in path and query) matches
 *     only when all its occurrences are equal
 *   - path and query are matched separately. A rule without a query imposes no query
 *     constraint. Every parameter the rule lists must be present, the others are
 *     ignored, order is irrelevant
 *   - ?p={var}, ?p=value, ?p=*   the value is matched like a path fragment
 *   - ?p=       present and valueless
 *   - ?p        present, with any value or none (same as ?p=*)
 *   - ?{params} a whole {…} chunk stands for "any other parameters": no constraint
 *
 * The component side is a pattern too (`/users/{username}?action=deleteData`): its
 * {var} stands for any value without '/', its % for any local part, and a `{params}`
 * query chunk for parameters it may add. The question answered is "can a call made by
 * this component be matched by the rule", and the two kinds of rules answer it
 * differently when a rule repeats a variable:
 *   - an allow rule matches when SOME call matches: occurrences only conflict when
 *     the component pins them to different literals;
 *   - a deny rule matches only when the occurrences are PROVABLY equal — the same
 *     literal, or the same whole component variable. A deny on
 *     `…/members/%@{domain}` does not stop `…/members/{username}` (eve@other.com goes
 *     through), so evaluation falls through to the next rules, like the proxy does
 *     for that call. For the same reason a component `{params}` chunk is assumed to
 *     supply a parameter an allow rule requires, never one a deny rule requires.
 * Everything else matches when some call could: a rule literal meets a component
 * variable (`/domains/a.com` vs `/domains/{domain}`), for allow and deny rules alike.
 */

export interface ProxyRule {
  endpoint: string;
  verb?: string[];
  denied?: boolean;
}

export type HttpVerb = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export class ProxyResolver {
  private readonly compiled: CompiledRule[];
  private readonly cache = new Map<string, boolean>();

  constructor(rules: ProxyRule[]) {
    this.compiled = rules.map(compileRule);
  }

  isAllowed(verb: HttpVerb, urlPattern: string): boolean {
    const key = `${verb} ${urlPattern}`;
    let allowed = this.cache.get(key);
    if (allowed === undefined) {
      allowed = this.resolve(verb, urlPattern);
      this.cache.set(key, allowed);
    }
    return allowed;
  }

  private resolve(verb: HttpVerb, urlPattern: string): boolean {
    const component = compileComponent(urlPattern);
    for (const rule of this.compiled) {
      if (ruleMatches(rule, verb, component)) {
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
  rule: CompiledRule,
  verb: HttpVerb,
  component: CompiledComponent
): boolean {
  if (rule.verb) {
    const upper = rule.verb.map((v) => v.toUpperCase());
    if (!upper.includes(verb.toUpperCase())) return false;
  }
  return endpointMatches(rule, component);
}

function endpointMatches(rule: CompiledRule, component: CompiledComponent): boolean {
  const denied = rule.denied === true;
  let candidates = matchAtoms(rule.path, component.path);
  for (const [name, value] of rule.query) {
    const compValue = component.query.get(name);
    if (compValue === undefined) {
      // The component may add it through a {params} chunk, with any value
      if (component.otherParams && !denied) continue;
      return false;
    }
    const valueCaptures = matchAtoms(value, compValue);
    candidates = dedupe(
      candidates.flatMap((a) => valueCaptures.map((b) => mergeCaptures(a, b)))
    );
    if (candidates.length === 0) return false;
  }
  return candidates.some((captures) => consistent(captures, denied));
}

// ---------------------------------------------------------------------------
// Pattern compilation
// ---------------------------------------------------------------------------

/** One character, or any character but the listed ones ("" = any character). */
type CharClass = { char: string } | { except: string };

const ANY: CharClass = { except: "" };
const NOT_SLASH: CharClass = { except: "/" };
const LOCAL_PART: CharClass = { except: "@/" };

interface Atom {
  cls: CharClass;
  /** Zero or more occurrences rather than exactly one. */
  repeat: boolean;
  /** Rule: the variable captured. Component: the variable (or wildcard) standing here. */
  variable?: string;
  /** First atom of that variable. */
  first?: boolean;
}

interface CompiledRule {
  verb?: string[];
  denied?: boolean;
  path: Atom[];
  query: Map<string, Atom[]>;
}

interface CompiledComponent {
  path: Atom[];
  query: Map<string, Atom[]>;
  otherParams: boolean;
}

function compileRule(rule: ProxyRule): CompiledRule {
  const [path, query] = splitOnQuery(rule.endpoint);
  const params = new Map<string, Atom[]>();
  for (const chunk of queryChunks(query)) {
    if (isOtherParamsPlaceholder(chunk)) continue;
    const eq = chunk.indexOf("=");
    if (eq === -1) {
      // Valueless flag: present, with any value or none
      params.set(chunk, [{ cls: ANY, repeat: true }]);
    } else {
      params.set(chunk.slice(0, eq), compile(chunk.slice(eq + 1)));
    }
  }
  return { verb: rule.verb, denied: rule.denied, path: compile(path), query: params };
}

function compileComponent(pattern: string): CompiledComponent {
  const [path, query] = splitOnQuery(pattern);
  const params = new Map<string, Atom[]>();
  let otherParams = false;
  for (const chunk of queryChunks(query)) {
    if (isOtherParamsPlaceholder(chunk)) {
      otherParams = true;
      continue;
    }
    const eq = chunk.indexOf("=");
    if (eq === -1) {
      params.set(chunk, []); // sent valueless
    } else {
      const name = chunk.slice(0, eq);
      params.set(name, compile(chunk.slice(eq + 1), `?${name}:`));
    }
  }
  return { path: compile(path, "path:"), query: params, otherParams };
}

function splitOnQuery(pattern: string): [string, string] {
  const idx = pattern.indexOf("?");
  return idx === -1 ? [pattern, ""] : [pattern.slice(0, idx), pattern.slice(idx + 1)];
}

function queryChunks(query: string): string[] {
  return query.split("&").filter(Boolean);
}

function isOtherParamsPlaceholder(chunk: string): boolean {
  return (
    chunk.length > 2 &&
    chunk.startsWith("{") &&
    chunk.endsWith("}") &&
    chunk.indexOf("{", 1) === -1 &&
    !chunk.includes("=")
  );
}

/**
 * Compiles a path or a query value. On the component side (`anonymous` given), `%`
 * and `*` get a variable name of their own, unique within the component, so that no
 * two of them are ever taken for the same value.
 */
function compile(pattern: string, anonymous?: string): Atom[] {
  const atoms: Atom[] = [];
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    const end = c === "{" ? pattern.indexOf("}", i) : -1;
    if (end !== -1) {
      atoms.push(...oneOrMore(NOT_SLASH, pattern.slice(i + 1, end)));
      i = end + 1;
    } else if (c === "%") {
      atoms.push(...oneOrMore(LOCAL_PART, anonymous && `${anonymous}%${i}`));
      i++;
    } else if (c === "*") {
      atoms.push({ cls: ANY, repeat: true, variable: anonymous && `${anonymous}*${i}`, first: true });
      i++;
    } else {
      atoms.push({ cls: { char: c }, repeat: false });
      i++;
    }
  }
  return atoms;
}

function oneOrMore(cls: CharClass, variable: string | undefined): Atom[] {
  return [
    { cls, repeat: false, variable, first: true },
    { cls, repeat: true, variable },
  ];
}

// ---------------------------------------------------------------------------
// Atom matching
// ---------------------------------------------------------------------------

/**
 * What a rule variable captured, as a sequence of literal characters and of markers
 * naming the component variables it spans. PARTIAL flags a capture that starts or
 * ends inside a component variable, whose value is therefore unknown.
 */
type Capture = string[];
type Captures = Record<string, Capture[]>;

const MARKER = "\u0000";
const PARTIAL = `${MARKER}partial`;

interface State {
  i: number;
  j: number;
  open: Capture | null;
  captures: Captures;
}

/**
 * Explores every way the rule atoms and the component atoms can consume a common
 * string, and returns the captures of each one that consumes both entirely.
 */
function matchAtoms(rule: Atom[], comp: Atom[]): Captures[] {
  const results = new Map<string, Captures>();
  const seen = new Set<string>();
  const stack: State[] = [{ i: 0, j: 0, open: null, captures: {} }];
  while (stack.length > 0) {
    const s = stack.pop()!;
    const key = JSON.stringify(s);
    if (seen.has(key)) continue;
    seen.add(key);

    const r = rule[s.i];
    const c = comp[s.j];
    if (!r && !c) {
      results.set(JSON.stringify(s.captures), s.captures);
      continue;
    }
    if (r?.repeat) stack.push(leaveRule(s, r, c));
    if (c?.repeat) {
      stack.push({ ...s, j: s.j + 1, open: s.open && note(s.open, c) });
    }
    if (r && c && overlaps(r.cls, c.cls)) {
      let open = s.open;
      if (r.variable) {
        if (r.first) open = insideVariable(c) ? [PARTIAL] : [];
        open = note(open!, c);
      }
      stack.push({
        i: r.repeat ? s.i : s.i + 1,
        j: c.repeat ? s.j : s.j + 1,
        open,
        captures: s.captures,
      });
    }
  }
  return [...results.values()];
}

/** Stops repeating a rule atom; leaving a variable closes its capture. */
function leaveRule(s: State, r: Atom, c: Atom | undefined): State {
  if (!r.variable) return { ...s, i: s.i + 1 };
  const capture = c && insideVariable(c) ? [...s.open!, PARTIAL] : s.open!;
  return {
    i: s.i + 1,
    j: s.j,
    open: null,
    captures: { ...s.captures, [r.variable]: [...(s.captures[r.variable] ?? []), capture] },
  };
}

function insideVariable(c: Atom): boolean {
  return c.repeat && c.variable !== undefined;
}

/** Records what the component atom contributes to an open capture. */
function note(open: Capture, c: Atom): Capture {
  if (c.variable === undefined) return [...open, (c.cls as { char: string }).char];
  const marker = `${MARKER}${c.first ? "start" : "rest"}:${c.variable}`;
  return open[open.length - 1] === marker ? open : [...open, marker];
}

function overlaps(a: CharClass, b: CharClass): boolean {
  if ("char" in a && "char" in b) return a.char === b.char;
  if ("char" in a) return !(b as { except: string }).except.includes(a.char);
  if ("char" in b) return !a.except.includes(b.char);
  return true;
}

// ---------------------------------------------------------------------------
// Repeated variables
// ---------------------------------------------------------------------------

function mergeCaptures(a: Captures, b: Captures): Captures {
  const merged: Captures = { ...a };
  for (const [name, values] of Object.entries(b)) {
    merged[name] = [...(merged[name] ?? []), ...values];
  }
  return merged;
}

function dedupe(candidates: Captures[]): Captures[] {
  return [...new Map(candidates.map((c) => [JSON.stringify(c), c])).values()];
}

function consistent(captures: Captures, denied: boolean): boolean {
  return Object.values(captures).every((values) =>
    denied ? provablyEqual(values) : possiblyEqual(values)
  );
}

/** Deny rules: every call gives all occurrences the same value. */
function provablyEqual(values: Capture[]): boolean {
  if (values.length === 1) return true;
  const first = values[0].join("\n");
  return values.every((v) => !v.includes(PARTIAL) && v.join("\n") === first);
}

/** Allow rules: some call gives all occurrences the same value. */
function possiblyEqual(values: Capture[]): boolean {
  const literals = values
    .filter((v) => v.every((item) => !item.startsWith(MARKER)))
    .map((v) => v.join(""));
  return literals.every((literal) => literal === literals[0]);
}
