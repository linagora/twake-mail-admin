"""Turn a set of interview answers into an ``allowed.urls`` block.

Three things happen here that a naive "concatenate the endpoints of every
answered-yes node" would get wrong:

1. **Downward closure** — an action inside a refused page is dropped, whatever
   the answer file says (see :func:`~twake_profile_editor.model.close_downwards`).
2. **Domain scoping** — in DOMAIN mode the user-address segment of a pattern
   becomes ``%@{domain}`` so the proxy can pin it to the caller's own domain,
   and ``url.patterns.restrictions`` is emitted alongside.
3. **Baseline reuse** — when a classpath profile is reused, the output is a
   short deny list plus an ``include``, never a flattened copy: the profile then
   keeps tracking the proxy.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Mapping, Sequence

from .i18n import t
from .model import (
    Application,
    Correction,
    Endpoint,
    Inventory,
    Label,
    Mode,
    close_downwards,
)
from .profiles import IncludeDirective, Profile
from .resolver import Resolver, Rule

#: Path variables that denote the address of a user of the administered domain.
#: In DOMAIN mode these become ``%@{domain}``, which the proxy pins to the caller's
#: domain through ``url.patterns.restrictions``. The rename target is one of them:
#: left free, a domain administrator would move a user's delegations and forwards
#: onto an account of another tenant.
USER_ADDRESS_VARS = ("{username}", "{mailbox@domain}", "{newUsername}", "{newUser}")

DOMAIN_PLACEHOLDER = "%@{domain}"

#: Query parameters whose value is the administered user's address, scoped like
#: a path segment.
USER_QUERY_PARAMS = ("user",)

class UnscopedDomainRule(ValueError):
    """A DOMAIN-mode rule the proxy could not pin to the caller's domain.

    ``url.patterns.restrictions`` only constrains captured variables: a rule with
    no ``{domain}`` (nor ``%@{domain}``) is granted on every tenant. Global routes
    such as ``/registeredUsers``, ``/tasks`` or ``/mailingLists/{address}`` must
    never reach a domain administrator's profile, and there is no exemption: the
    inventory has to model a domain-scoped variant, or make the endpoint GLOBAL only.
    """


@dataclass(frozen=True)
class Scope:
    application: Application
    mode: Mode

    @property
    def is_domain(self) -> bool:
        return self.mode is Mode.DOMAIN


@dataclass
class Generated:
    """The emitted profile plus everything the operator should know about it."""

    rules: list[Rule | IncludeDirective] = field(default_factory=list)
    restrictions: dict = field(default_factory=dict)
    warnings: list[Label] = field(default_factory=list)
    corrections: list[Correction] = field(default_factory=list)
    granted: list[tuple[str, str]] = field(default_factory=list)

    def to_json(self) -> list[dict]:
        """The rule array, exactly as an ``include`` directive expects it.

        Deliberately a bare array rather than a ``{"allowed.urls": [...]}``
        wrapper, so the generated file can be referenced straight from a client
        entry: ``{"include": "file://domain-support.json"}``.

        :attr:`restrictions` is therefore *not* part of it — an include target
        holds rules and nothing else. In DOMAIN mode it has to be copied into the
        client entry by hand, and the CLI prints it for that purpose.
        """
        return [rule.to_json() for rule in self.rules]


def generate(
    inventory: Inventory,
    scope: Scope,
    answers: Mapping[str, bool],
    baseline: Profile | None = None,
) -> Generated:
    scoped = inventory.for_scope(scope.application, scope.mode)
    resolved, corrections = close_downwards(scoped, answers)

    granted_keys: list[tuple[str, str]] = []
    all_keys: list[tuple[str, str]] = []
    warnings: list[Label] = []

    for node in scoped.nodes:
        for endpoint in node.endpoints:
            for key in _scoped_keys(endpoint, scope):
                _append_unique(all_keys, key)
                if resolved.get(node.id, False):
                    _append_unique(granted_keys, key)

    result = Generated(
        corrections=corrections,
        warnings=warnings,
        granted=granted_keys,
        restrictions=_restrictions(granted_keys, scope),
    )

    if baseline is None:
        result.rules = _merge_rules(granted_keys, denied=False) or _deny_all(result)
        return result

    result.rules = _rules_against_baseline(granted_keys, all_keys, baseline, result)
    return result


# ---------------------------------------------------------------------------
# Baseline reuse
# ---------------------------------------------------------------------------


def _rules_against_baseline(
    granted: Sequence[tuple[str, str]],
    candidates: Sequence[tuple[str, str]],
    baseline: Profile,
    result: Generated,
) -> list[Rule | IncludeDirective]:
    resolver = Resolver(baseline.rules)
    granted_set = set(granted)

    to_deny: list[tuple[str, str]] = []
    for key in candidates:
        if key in granted_set or not resolver.is_allowed(*key):
            continue
        shadowed = _granted_shadowed_by(key, granted)
        if shadowed:
            result.warnings.append(
                _label(
                    "warn.baseline-shadow",
                    verb=key[0],
                    pattern=key[1],
                    profile=baseline.uri,
                    shadow_verb=shadowed[0],
                    shadow_pattern=shadowed[1],
                )
            )
            continue
        to_deny.append(key)

    extra = [key for key in granted if not resolver.is_allowed(*key)]

    # Denies first so they win the first-match race, then the endpoints the
    # baseline does not cover, then the baseline itself.
    return [
        *_merge_rules([(verb, _deny_pattern(pattern)) for verb, pattern in to_deny], denied=True),
        *_merge_rules(extra, denied=False),
        IncludeDirective(baseline.uri),
    ]


def _deny_pattern(pattern: str) -> str:
    """Free every ``{domain}`` but the first one of a deny rule.

    A repeated variable must take a single value, and a deny is only known to apply
    when that holds for every call: denying ``/users/%@{domain}/rename/%@{domain}``,
    the frontend cannot tell that ``/users/{username}/rename/{newUser}`` is refused,
    and keeps a button the proxy always answers 403. Freeing the second domain denies
    a little more -- a call the baseline refuses anyway -- and is provable.
    """
    first = pattern.find("{domain}")
    if first < 0:
        return pattern
    head, tail = pattern[: first + len("{domain}")], pattern[first + len("{domain}") :]
    return head + tail.replace("{domain}", "{otherDomain}")


def _granted_shadowed_by(
    deny_key: tuple[str, str], granted: Sequence[tuple[str, str]]
) -> tuple[str, str] | None:
    """Return a granted endpoint that a deny rule for ``deny_key`` would also block.

    Distinct patterns can be indistinguishable to the resolver -- variable names
    carry no meaning -- so ``/address/aliases/{userAddress}/sources/{aliasSource}``
    and ``/address/aliases/{username}/sources/{alias}`` are the same rule. Denying
    one would silently take the other down with it.
    """
    verb, pattern = deny_key
    probe = Resolver([Rule(endpoint=pattern, verb=(verb,))])
    for granted_key in granted:
        if probe.is_allowed(*granted_key):
            return granted_key
    return None


# ---------------------------------------------------------------------------
# Emission
# ---------------------------------------------------------------------------

#: webadmin-proxy reads an empty ``allowed.urls`` -- an include expanding to no
#: rule included -- as "every call is allowed". Granting nothing has to say so.
DENY_ALL = Rule(endpoint="/*", denied=True)


def _deny_all(result: Generated) -> list[Rule]:
    result.warnings.append(_label("warn.deny-all"))
    return [DENY_ALL]


def _merge_rules(keys: Sequence[tuple[str, str]], *, denied: bool) -> list[Rule]:
    """One rule per endpoint, listing every verb granted on it."""
    by_pattern: dict[str, list[str]] = {}
    for verb, pattern in keys:
        verbs = by_pattern.setdefault(pattern, [])
        if verb not in verbs:
            verbs.append(verb)
    return [
        Rule(endpoint=pattern, verb=tuple(verbs), denied=denied)
        for pattern, verbs in by_pattern.items()
    ]


def _scoped_keys(endpoint: Endpoint, scope: Scope) -> list[tuple[str, str]]:
    """The call itself plus every gate the frontend checks for it."""
    if not scope.is_domain:
        return list(endpoint.keys)
    keys = [(verb, domain_scope(pattern)) for verb, pattern in endpoint.keys]
    unscoped = [key for key in keys if not is_domain_scoped(key[1])]
    if unscoped:
        raise UnscopedDomainRule(
            f"{scope.application.value} DOMAIN: "
            + ", ".join(f"{verb} {pattern}" for verb, pattern in unscoped)
            + " would be granted on every domain. Give the endpoint a "
            "domain-scoped DOMAIN variant in the inventory, or make it GLOBAL only."
        )
    return keys


def is_domain_scoped(pattern: str) -> bool:
    """True when the proxy can pin the pattern to the caller's own domain."""
    return "{domain}" in pattern


def _label(key: str, **fmt: object) -> Label:
    """Render one message in every language, so the caller picks later."""
    return Label(en=t(key, "en", **fmt), fr=t(key, "fr", **fmt))


def domain_scope(pattern: str) -> str:
    """Rewrite the user address of a pattern for DOMAIN mode.

    Whole path segments are rewritten, and the value of a ``user`` query
    parameter (``DELETE /messages?user={username}``). Any other query value is
    left alone -- a ``{mailbox}`` there is a folder name, not an address.
    """
    path, sep, query = pattern.partition("?")
    segments = [
        DOMAIN_PLACEHOLDER if segment in USER_ADDRESS_VARS else segment
        for segment in path.split("/")
    ]
    params = [_domain_scope_param(chunk) for chunk in query.split("&")] if sep else []
    return "/".join(segments) + (sep + "&".join(params) if sep else "")


def _domain_scope_param(chunk: str) -> str:
    name, sep, value = chunk.partition("=")
    if sep and name in USER_QUERY_PARAMS and value in USER_ADDRESS_VARS:
        return f"{name}={DOMAIN_PLACEHOLDER}"
    return chunk


def _restrictions(keys: Sequence[tuple[str, str]], scope: Scope) -> dict:
    """Pin ``{domain}`` to the caller's own domain in DOMAIN mode."""
    if not scope.is_domain:
        return {}
    if not any("{domain}" in pattern for _, pattern in keys):
        return {}
    return {"domain": {"backing.claim": "email", "operator": "HAS_DOMAIN"}}


def _append_unique(target: list[tuple[str, str]], key: tuple[str, str]) -> None:
    if key not in target:
        target.append(key)
