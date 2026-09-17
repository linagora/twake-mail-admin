"""Rule resolver for ``allowed.urls``.

Line-by-line port of ``src/lib/proxy-resolver.ts`` from twake-mail-admin, read in
place and guarded by a checksum test (see ``UPSTREAM.md``).

The frontend resolver is what decides whether a component is rendered, so it is
the reference for :mod:`twake_profile_editor.check`. It mirrors webadmin-proxy's
matcher (``AllowedUrl.java``): a rule without query matches any query, parameters
a rule does not list are ignored, ``*`` matches anywhere, ``%`` is an email local
part, and a variable repeated in a rule must take a single value. Keep this module
a faithful translation: behaviour changes belong upstream first.

Both sides of a comparison are *patterns* rather than concrete URLs. The question
answered is "can a call made by this component be matched by this rule": an allow
rule matches when some call does; a deny rule only when its repeated variables are
provably equal for every call, so that a deny on ``…/members/%@{domain}`` is not
mistaken for one covering ``…/members/{username}``.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Sequence

VERBS = ("GET", "POST", "PUT", "DELETE", "PATCH", "HEAD")


@dataclass(frozen=True)
class Rule:
    """One entry of an ``allowed.urls`` list."""

    endpoint: str
    verb: tuple[str, ...] | None = None
    denied: bool = False

    #: The spelling the proxy reads. Its documentation shows ``verbs`` in one
    #: example; the Java configuration parser looks only at ``verb``, so a rule
    #: written that way silently applies to every verb. Mirrored here rather than
    #: tolerated, so --check reports what the proxy will really do.
    VERB_KEY = "verb"

    @classmethod
    def from_json(cls, raw: dict) -> "Rule":
        verb = raw.get(cls.VERB_KEY)
        return cls(
            endpoint=raw["endpoint"],
            verb=tuple(verb) if verb is not None else None,
            denied=bool(raw.get("denied", False)),
        )

    def to_json(self) -> dict:
        out: dict = {}
        if self.denied:
            out["denied"] = True
        if self.verb is not None:
            out["verb"] = list(self.verb)
        out["endpoint"] = self.endpoint
        return out


@dataclass(frozen=True)
class Resolver:
    """Evaluates rules in order — first match wins, no match means forbidden."""

    rules: Sequence[Rule] = field(default_factory=tuple)
    _compiled: tuple["_CompiledRule", ...] = field(init=False, repr=False, compare=False)
    _cache: dict = field(init=False, repr=False, compare=False)

    def __post_init__(self) -> None:
        object.__setattr__(self, "_compiled", tuple(_compile_rule(r) for r in self.rules))
        object.__setattr__(self, "_cache", {})

    def is_allowed(self, verb: str, url_pattern: str) -> bool:
        key = (verb, url_pattern)
        if key not in self._cache:
            self._cache[key] = self._resolve(verb, url_pattern)
        return self._cache[key]

    def _resolve(self, verb: str, url_pattern: str) -> bool:
        component = _compile_component(url_pattern)
        for rule in self._compiled:
            if _rule_matches(rule, verb, component):
                return not rule.denied
        return False  # no match -> forbidden


# ---------------------------------------------------------------------------
# Matching helpers
# ---------------------------------------------------------------------------


def _rule_matches(rule: "_CompiledRule", verb: str, component: "_CompiledComponent") -> bool:
    if rule.verb is not None:
        if verb.upper() not in [v.upper() for v in rule.verb]:
            return False
    return _endpoint_matches(rule, component)


def _endpoint_matches(rule: "_CompiledRule", component: "_CompiledComponent") -> bool:
    denied = rule.denied
    candidates = _match_atoms(rule.path, component.path)
    for name, value in rule.query.items():
        comp_value = component.query.get(name)
        if comp_value is None:
            # The component may add it through a {params} chunk, with any value
            if component.other_params and not denied:
                continue
            return False
        value_captures = _match_atoms(value, comp_value)
        candidates = _dedupe(
            [_merge_captures(a, b) for a in candidates for b in value_captures]
        )
        if not candidates:
            return False
    return any(_consistent(captures, denied) for captures in candidates)


# ---------------------------------------------------------------------------
# Pattern compilation
# ---------------------------------------------------------------------------

#: One character ``("char", c)``, or any character but the listed ones
#: ``("except", chars)`` -- ``("except", "")`` being any character.
CharClass = tuple[str, str]

_ANY: CharClass = ("except", "")
_NOT_SLASH: CharClass = ("except", "/")
_LOCAL_PART: CharClass = ("except", "@/")


@dataclass(frozen=True)
class _Atom:
    cls: CharClass
    #: Zero or more occurrences rather than exactly one.
    repeat: bool
    #: Rule: the variable captured. Component: the variable (or wildcard) standing here.
    variable: str | None = None
    #: First atom of that variable.
    first: bool = False


@dataclass(frozen=True)
class _CompiledRule:
    verb: tuple[str, ...] | None
    denied: bool
    path: tuple[_Atom, ...]
    query: dict[str, tuple[_Atom, ...]]


@dataclass(frozen=True)
class _CompiledComponent:
    path: tuple[_Atom, ...]
    query: dict[str, tuple[_Atom, ...]]
    other_params: bool


def _compile_rule(rule: Rule) -> _CompiledRule:
    path, query = _split_on_query(rule.endpoint)
    params: dict[str, tuple[_Atom, ...]] = {}
    for chunk in _query_chunks(query):
        if _is_other_params_placeholder(chunk):
            continue
        name, sep, value = chunk.partition("=")
        if not sep:
            # Valueless flag: present, with any value or none
            params[chunk] = (_Atom(_ANY, True),)
        else:
            params[name] = _compile(value)
    return _CompiledRule(rule.verb, rule.denied, _compile(path), params)


def _compile_component(pattern: str) -> _CompiledComponent:
    path, query = _split_on_query(pattern)
    params: dict[str, tuple[_Atom, ...]] = {}
    other_params = False
    for chunk in _query_chunks(query):
        if _is_other_params_placeholder(chunk):
            other_params = True
            continue
        name, sep, value = chunk.partition("=")
        if not sep:
            params[chunk] = ()  # sent valueless
        else:
            params[name] = _compile(value, f"?{name}:")
    return _CompiledComponent(_compile(path, "path:"), params, other_params)


def _split_on_query(pattern: str) -> tuple[str, str]:
    head, sep, tail = pattern.partition("?")
    return (head, tail) if sep else (pattern, "")


def _query_chunks(query: str) -> list[str]:
    return [chunk for chunk in query.split("&") if chunk]


def _is_other_params_placeholder(chunk: str) -> bool:
    return (
        len(chunk) > 2
        and chunk.startswith("{")
        and chunk.endswith("}")
        and chunk.find("{", 1) == -1
        and "=" not in chunk
    )


def _compile(pattern: str, anonymous: str | None = None) -> tuple[_Atom, ...]:
    """Compiles a path or a query value.

    On the component side (``anonymous`` given), ``%`` and ``*`` get a variable
    name of their own, unique within the component, so that no two of them are
    ever taken for the same value.
    """
    atoms: list[_Atom] = []
    i = 0
    while i < len(pattern):
        c = pattern[i]
        end = pattern.find("}", i) if c == "{" else -1
        if end != -1:
            atoms.extend(_one_or_more(_NOT_SLASH, pattern[i + 1 : end]))
            i = end + 1
        elif c == "%":
            atoms.extend(_one_or_more(_LOCAL_PART, anonymous and f"{anonymous}%{i}"))
            i += 1
        elif c == "*":
            atoms.append(_Atom(_ANY, True, anonymous and f"{anonymous}*{i}", True))
            i += 1
        else:
            atoms.append(_Atom(("char", c), False))
            i += 1
    return tuple(atoms)


def _one_or_more(cls: CharClass, variable: str | None) -> list[_Atom]:
    return [_Atom(cls, False, variable, True), _Atom(cls, True, variable)]


# ---------------------------------------------------------------------------
# Atom matching
# ---------------------------------------------------------------------------

#: What a rule variable captured, as a sequence of literal characters and of
#: markers naming the component variables it spans. PARTIAL flags a capture that
#: starts or ends inside a component variable, whose value is therefore unknown.
Capture = tuple[str, ...]
#: Rule variable -> its captures, kept sorted by name so equal maps compare equal.
Captures = tuple[tuple[str, tuple[Capture, ...]], ...]

_MARKER = "\u0000"
_PARTIAL = f"{_MARKER}partial"


def _match_atoms(rule: Sequence[_Atom], comp: Sequence[_Atom]) -> list[Captures]:
    """Explores every way the rule atoms and the component atoms can consume a
    common string, and returns the captures of each one that consumes both entirely."""
    results: dict[Captures, None] = {}
    seen: set = set()
    stack: list[tuple[int, int, Capture | None, Captures]] = [(0, 0, None, ())]
    while stack:
        state = stack.pop()
        if state in seen:
            continue
        seen.add(state)
        i, j, open_, captures = state

        r = rule[i] if i < len(rule) else None
        c = comp[j] if j < len(comp) else None
        if r is None and c is None:
            results[captures] = None
            continue
        if r is not None and r.repeat:
            stack.append(_leave_rule(state, r, c))
        if c is not None and c.repeat:
            stack.append((i, j + 1, open_ and _note(open_, c), captures))
        if r is not None and c is not None and _overlaps(r.cls, c.cls):
            opened = open_
            if r.variable is not None:
                if r.first:
                    opened = (_PARTIAL,) if _inside_variable(c) else ()
                opened = _note(opened, c)
            stack.append(
                (i if r.repeat else i + 1, j if c.repeat else j + 1, opened, captures)
            )
    return list(results)


def _leave_rule(state, r: _Atom, c: _Atom | None):
    """Stops repeating a rule atom; leaving a variable closes its capture."""
    i, j, open_, captures = state
    if r.variable is None:
        return (i + 1, j, open_, captures)
    capture = open_ + (_PARTIAL,) if c is not None and _inside_variable(c) else open_
    return (i + 1, j, None, _add_captures(captures, r.variable, (capture,)))


def _inside_variable(c: _Atom) -> bool:
    return c.repeat and c.variable is not None


def _note(open_: Capture, c: _Atom) -> Capture:
    """Records what the component atom contributes to an open capture."""
    if c.variable is None:
        return open_ + (c.cls[1],)
    marker = f"{_MARKER}{'start' if c.first else 'rest'}:{c.variable}"
    return open_ if open_ and open_[-1] == marker else open_ + (marker,)


def _overlaps(a: CharClass, b: CharClass) -> bool:
    if a[0] == "char" and b[0] == "char":
        return a[1] == b[1]
    if a[0] == "char":
        return a[1] not in b[1]
    if b[0] == "char":
        return b[1] not in a[1]
    return True


# ---------------------------------------------------------------------------
# Repeated variables
# ---------------------------------------------------------------------------


def _add_captures(captures: Captures, name: str, values: tuple[Capture, ...]) -> Captures:
    merged = dict(captures)
    merged[name] = merged.get(name, ()) + values
    return tuple(sorted(merged.items()))


def _merge_captures(a: Captures, b: Captures) -> Captures:
    merged = a
    for name, values in b:
        merged = _add_captures(merged, name, values)
    return merged


def _dedupe(candidates: list[Captures]) -> list[Captures]:
    return list(dict.fromkeys(candidates))


def _consistent(captures: Captures, denied: bool) -> bool:
    return all(
        _provably_equal(values) if denied else _possibly_equal(values)
        for _, values in captures
    )


def _provably_equal(values: tuple[Capture, ...]) -> bool:
    """Deny rules: every call gives all occurrences the same value."""
    if len(values) == 1:
        return True
    return all(_PARTIAL not in v and v == values[0] for v in values)


def _possibly_equal(values: tuple[Capture, ...]) -> bool:
    """Allow rules: some call gives all occurrences the same value."""
    literals = ["".join(v) for v in values if not any(item.startswith(_MARKER) for item in v)]
    return all(literal == literals[0] for literal in literals)
