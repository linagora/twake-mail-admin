"""Rule resolver for ``allowed.urls``.

Line-by-line port of ``src/lib/proxy-resolver.ts`` from twake-mail-admin (a
vendored copy lives in ``vendor/proxy-resolver.ts``, guarded by a checksum test).

The frontend resolver — not the proxy's Java one — is what decides whether a
component is rendered, so it is the reference for :mod:`twake_profile_editor.check`.
Keep this module a faithful translation: behaviour changes belong upstream first.

Both sides of a comparison are *component patterns* rather than concrete URLs, so
a variable may appear on either side and matches anything on the other.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Sequence

VERBS = ("GET", "POST", "PUT", "DELETE", "PATCH", "HEAD")

_PATH_VAR_RE = re.compile(r"^\{[^}]+\}$")
_EMAIL_PATH_VAR_RE = re.compile(r"^%@\{[^}]+\}$")
_QUERY_VAR_RE = re.compile(r"\{[^}]+\}")


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

    def is_allowed(self, verb: str, url_pattern: str) -> bool:
        for rule in self.rules:
            if _rule_matches(rule, verb, url_pattern):
                return not rule.denied
        return False  # no match -> forbidden


# ---------------------------------------------------------------------------
# Matching helpers
# ---------------------------------------------------------------------------


def _rule_matches(rule: Rule, verb: str, url_pattern: str) -> bool:
    if rule.verb is not None:
        if verb.upper() not in [v.upper() for v in rule.verb]:
            return False
    return _endpoint_matches(rule.endpoint, url_pattern)


def _endpoint_matches(rule_endpoint: str, component_pattern: str) -> bool:
    rule_path, rule_query = _split_on_query(rule_endpoint)
    comp_path, comp_query = _split_on_query(component_pattern)
    return _path_matches(rule_path, comp_path) and _query_matches(rule_query, comp_query)


def _split_on_query(pattern: str) -> tuple[str, str]:
    head, sep, tail = pattern.partition("?")
    return (head, tail) if sep else (pattern, "")


# ---------------------------------------------------------------------------
# Path matching
# ---------------------------------------------------------------------------


def _path_matches(rule_pattern: str, comp_pattern: str) -> bool:
    return _segments_match(rule_pattern.split("/"), 0, comp_pattern.split("/"), 0)


def _segments_match(
    r_segs: Sequence[str], ri: int, c_segs: Sequence[str], ci: int
) -> bool:
    # Both exhausted -> match
    if ri == len(r_segs) and ci == len(c_segs):
        return True

    # Rule exhausted but component still has segments -> no match
    if ri == len(r_segs):
        return False

    r_seg = r_segs[ri]

    if r_seg == "*":
        # Trailing *: matches one or more remaining component segments
        if ri == len(r_segs) - 1:
            return ci < len(c_segs)
        # Non-trailing *: consume exactly one component segment and continue
        if ci >= len(c_segs):
            return False
        return _segments_match(r_segs, ri + 1, c_segs, ci + 1)

    # Component exhausted but rule still has segments -> no match
    if ci == len(c_segs):
        return False

    c_seg = c_segs[ci]

    # {var} or %@{var} on either side matches any single segment
    if _is_path_var(r_seg) or _is_path_var(c_seg):
        return _segments_match(r_segs, ri + 1, c_segs, ci + 1)

    if r_seg != c_seg:
        return False
    return _segments_match(r_segs, ri + 1, c_segs, ci + 1)


def _is_path_var(segment: str) -> bool:
    return bool(_PATH_VAR_RE.match(segment) or _EMAIL_PATH_VAR_RE.match(segment))


# ---------------------------------------------------------------------------
# Query string matching
# ---------------------------------------------------------------------------


def _query_matches(rule_query: str, comp_query: str) -> bool:
    if not rule_query and not comp_query:
        return True
    # One side carries a query and the other does not -> distinct endpoints
    if not rule_query or not comp_query:
        return False

    r_params = _parse_query_params(rule_query)
    c_params = _parse_query_params(comp_query)

    if len(r_params) != len(c_params):
        return False

    # Sorted by key so the comparison is order-independent, mirroring the
    # upstream `localeCompare` sort. Keys are unique within a query in practice,
    # so the exact collation cannot change the pairing.
    r_params.sort(key=_collation_key)
    c_params.sort(key=_collation_key)

    for r, c in zip(r_params, c_params):
        if r[0] != c[0]:
            return False
        # A {…} template on either side matches any value on the other
        if _is_query_var_value(r[1]) or _is_query_var_value(c[1]):
            continue
        if r[1] != c[1]:
            return False

    return True


def _collation_key(param: tuple[str, str]) -> tuple[str, str]:
    return (param[0].lower(), param[0])


def _parse_query_params(query: str) -> list[tuple[str, str]]:
    params: list[tuple[str, str]] = []
    for chunk in query.split("&"):
        if not chunk:
            continue
        key, sep, value = chunk.partition("=")
        params.append((key, value) if sep else (chunk, ""))
    return params


def _is_query_var_value(value: str) -> bool:
    """A query value is a placeholder as soon as it contains any ``{…}``."""
    return bool(_QUERY_VAR_RE.search(value))
