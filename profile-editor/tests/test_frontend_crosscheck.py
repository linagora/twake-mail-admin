"""Cross-check the inventory against what the frontend actually gates on.

``validation.md`` is the documented contract; the ``useIsAllowed`` call sites are
what decides, at runtime, whether a control is rendered. The call sites are read
straight out of ``src/`` on every run, so a component that starts gating on a new
pattern shows up here immediately -- and fails, rather than quietly producing
profiles whose buttons never appear.
"""

from __future__ import annotations

import functools
import unittest

from twake_profile_editor import repo
from twake_profile_editor.inventory import (
    FRONTEND_ONLY,
    INVENTORY,
    MISSING_FROM_VALIDATION,
)
from twake_profile_editor.resolver import Resolver, Rule


@functools.lru_cache(maxsize=1)
def gates() -> frozenset[tuple[str, str]]:
    """Read out of src/ on every run, never from a snapshot."""
    return frozenset(repo.frontend_permission_gates())


@functools.lru_cache(maxsize=1)
def granted_by_full_profile() -> tuple[tuple[str, str], ...]:
    """Every (verb, pattern) a profile granting the whole tree would emit."""
    keys: list[tuple[str, str]] = []
    for endpoint in INVENTORY.endpoints():
        keys.extend(endpoint.keys)
    return tuple(keys)


def allows(rule_key: tuple[str, str], component: tuple[str, str]) -> bool:
    return Resolver([Rule(endpoint=rule_key[1], verb=(rule_key[0],))]).is_allowed(
        *component
    )


class FrontendCrossCheckTest(unittest.TestCase):
    def test_the_gates_are_actually_found_in_the_sources(self):
        """Guards against a regex that silently stops matching after a refactor."""
        assert len(gates()) > 150
        # A handful build their arguments at runtime and cannot be read statically.
        assert repo.dynamic_gate_call_sites() < 10

    def test_a_fully_granting_profile_satisfies_every_frontend_gate(self):
        """The point of the `gates` field: grant everything, nothing stays hidden.

        Anything left over is a control the frontend gates on a path
        validation.md never mentions, and must be listed in
        MISSING_FROM_VALIDATION.
        """
        granted = granted_by_full_profile()
        unsatisfied = {
            gate for gate in gates() if not any(allows(key, gate) for key in granted)
        }
        expected = set(MISSING_FROM_VALIDATION)
        assert unsatisfied == expected, (
            "frontend gates a fully-granting profile would not satisfy:\n"
            + "\n".join(f"  {v} {p}" for v, p in sorted(unsatisfied - expected))
            + "\nno longer missing:\n"
            + "\n".join(f"  {v} {p}" for v, p in sorted(expected - unsatisfied))
        )

    def test_the_known_gap_lists_are_empty(self):
        """Both escape hatches are unused, and the point is to keep them that way."""
        assert FRONTEND_ONLY == ()
        assert MISSING_FROM_VALIDATION == ()

    def test_any_declared_gap_would_be_a_real_frontend_gate(self):
        """If a gap is ever recorded, it has to name something the frontend gates."""
        for key in FRONTEND_ONLY + MISSING_FROM_VALIDATION:
            assert key in gates(), f"{key} is listed as a gap but is not gated"

    def test_every_declared_gate_is_a_real_frontend_gate(self):
        """A `gates` entry must quote the frontend verbatim, not a guess."""
        for endpoint in INVENTORY.endpoints():
            for gate in endpoint.gates:
                assert (endpoint.verb, gate) in gates(), f"{endpoint.verb} {gate}"

    def test_gates_differ_from_the_endpoint_they_belong_to(self):
        for endpoint in INVENTORY.endpoints():
            assert endpoint.pattern not in endpoint.gates, endpoint.pattern
