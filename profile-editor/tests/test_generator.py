"""Generation: closure, domain scoping, and baseline reuse."""

from __future__ import annotations

import unittest

from twake_profile_editor.generator import (
    Generated,
    Scope,
    domain_scope,
    generate,
)
from twake_profile_editor.inventory import INVENTORY
from twake_profile_editor.model import Application, Mode
from twake_profile_editor.profiles import IncludeDirective, find_profile
from twake_profile_editor.resolver import Resolver, Rule

MAIL_GLOBAL = Scope(Application.MAIL, Mode.GLOBAL)
MAIL_DOMAIN = Scope(Application.MAIL, Mode.DOMAIN)


def grant_all(scope: Scope) -> dict[str, bool]:
    scoped = INVENTORY.for_scope(scope.application, scope.mode)
    return {node.id: True for node in scoped.nodes}


def endpoints_of(generated: Generated) -> set[tuple[str, str]]:
    return {
        (verb, rule.endpoint)
        for rule in generated.rules
        if isinstance(rule, Rule)
        for verb in (rule.verb or ())
    }


# ---------------------------------------------------------------------------
# Downward closure
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Emission shape
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Domain scoping
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Baseline reuse
# ---------------------------------------------------------------------------


class GeneratorTest(unittest.TestCase):
    def test_an_action_inside_a_refused_page_is_dropped(self):
        answers = grant_all(MAIL_GLOBAL)
        answers["domains"] = False
        generated = generate(INVENTORY, MAIL_GLOBAL, answers)
        assert ("GET", "/domains") not in endpoints_of(generated)
        assert ("PUT", "/domains/{domain}") not in endpoints_of(generated)



    def test_overruled_answers_are_reported_rather_than_silently_applied(self):
        answers = grant_all(MAIL_GLOBAL)
        answers["domains"] = False  # but everything below stayed true
        generated = generate(INVENTORY, MAIL_GLOBAL, answers)
        overruled = {correction.node_id for correction in generated.corrections}
        assert "domains.aliases" in overruled
        assert "domains.aliases.add" in overruled
        assert all("domains" in node_id for node_id in overruled)



    def test_corrections_are_reported_in_both_languages(self):
        answers = grant_all(MAIL_GLOBAL)
        answers["domains"] = False
        correction = generate(INVENTORY, MAIL_GLOBAL, answers).corrections[0]
        assert correction.reason.en != correction.reason.fr
        assert correction.reason.fr



    def test_granting_nothing_produces_an_empty_profile(self):
        generated = generate(INVENTORY, MAIL_GLOBAL, {})
        assert generated.rules == []



    def test_verbs_on_one_endpoint_are_merged_into_a_single_rule(self):
        generated = generate(INVENTORY, MAIL_GLOBAL, grant_all(MAIL_GLOBAL))
        domain_rules = [
            rule
            for rule in generated.rules
            if isinstance(rule, Rule) and rule.endpoint == "/domains/{domain}"
        ]
        assert len(domain_rules) == 1
        assert set(domain_rules[0].verb) == {"PUT", "DELETE"}



    def test_an_endpoint_shared_by_two_components_is_emitted_once(self):
        generated = generate(INVENTORY, MAIL_GLOBAL, grant_all(MAIL_GLOBAL))
        endpoints = [rule.endpoint for rule in generated.rules if isinstance(rule, Rule)]
        assert len(endpoints) == len(set(endpoints))



    def test_the_frontend_gate_is_emitted_next_to_the_call_it_guards(self):
        """Without the gate the reindex button would never be rendered."""
        generated = generate(INVENTORY, MAIL_GLOBAL, grant_all(MAIL_GLOBAL))
        emitted = endpoints_of(generated)
        assert ("POST", "/users/{username}/mailboxes?task=reIndex") in emitted
        assert ("POST", "/users/{username}/mailboxes") in emitted



    def test_output_is_deterministic(self):
        answers = grant_all(MAIL_DOMAIN)
        first = generate(INVENTORY, MAIL_DOMAIN, answers).to_json()
        second = generate(INVENTORY, MAIL_DOMAIN, answers).to_json()
        assert first == second



    def test_global_mode_leaves_patterns_alone(self):
        generated = generate(INVENTORY, MAIL_GLOBAL, grant_all(MAIL_GLOBAL))
        assert ("GET", "/users") in endpoints_of(generated)
        assert not any("%@" in rule.endpoint for rule in generated.rules if isinstance(rule, Rule))



    def test_domain_mode_emits_the_matching_claim_restriction(self):
        generated = generate(INVENTORY, MAIL_DOMAIN, grant_all(MAIL_DOMAIN))
        assert generated.restrictions == {
            "domain": {"backing.claim": "email", "operator": "HAS_DOMAIN"}
        }



    def test_global_mode_emits_no_restriction(self):
        generated = generate(INVENTORY, MAIL_GLOBAL, grant_all(MAIL_GLOBAL))
        assert generated.restrictions == {}



    def test_the_output_is_a_bare_rule_array_an_include_can_point_at(self):
        """A client entry references the file directly, so no wrapper object."""
        emitted = generate(INVENTORY, MAIL_DOMAIN, grant_all(MAIL_DOMAIN)).to_json()
        assert isinstance(emitted, list)
        assert all(isinstance(entry, dict) and "endpoint" in entry for entry in emitted)



    def test_the_restrictions_stay_out_of_the_include_target(self):
        """An include target holds rules only; the restrictions belong to the client."""
        generated = generate(INVENTORY, MAIL_DOMAIN, grant_all(MAIL_DOMAIN))
        assert generated.restrictions
        assert not any("url.patterns.restrictions" in entry for entry in generated.to_json())



    def test_patterns_that_cannot_be_scoped_mechanically_are_flagged(self):
        generated = generate(INVENTORY, MAIL_DOMAIN, grant_all(MAIL_DOMAIN))
        warnings = " ".join(warning.en for warning in generated.warnings)
        assert "/mailingLists/{address}" in warnings
        assert "rename" in warnings



    def test_reusing_a_baseline_emits_an_include_rather_than_a_copy(self):
        baseline = find_profile("classpath://functional-admin-mail-baseline.json")
        generated = generate(INVENTORY, MAIL_DOMAIN, grant_all(MAIL_DOMAIN), baseline)
        includes = [rule for rule in generated.rules if isinstance(rule, IncludeDirective)]
        assert [include.to_json() for include in includes] == [
            {"include": "classpath://functional-admin-mail-baseline.json"}
        ]



    def test_the_include_comes_last_so_earlier_rules_win(self):
        baseline = find_profile("classpath://functional-admin-mail-baseline.json")
        answers = grant_all(MAIL_DOMAIN)
        answers["domains.aliases.delete"] = False
        generated = generate(INVENTORY, MAIL_DOMAIN, answers, baseline)
        assert isinstance(generated.rules[-1], IncludeDirective)



    def test_a_refusal_the_baseline_would_grant_becomes_a_deny_rule(self):
        baseline = find_profile("classpath://functional-admin-mail-baseline.json")
        answers = grant_all(MAIL_DOMAIN)
        answers["domains.aliases.delete"] = False
        generated = generate(INVENTORY, MAIL_DOMAIN, answers, baseline)

        denies = [rule for rule in generated.rules if isinstance(rule, Rule) and rule.denied]
        assert any(
            rule.endpoint == "/domains/{domain}/aliases/{source}" and rule.verb == ("DELETE",)
            for rule in denies
        ), denies



    def test_the_deny_rules_actually_close_the_hole(self):
        """The whole point: resolve the emitted list and the refusal must hold."""
        baseline = find_profile("classpath://functional-admin-mail-baseline.json")
        answers = grant_all(MAIL_DOMAIN)
        answers["domains.aliases.delete"] = False
        generated = generate(INVENTORY, MAIL_DOMAIN, answers, baseline)

        expanded = []
        for rule in generated.rules:
            expanded.extend(baseline.rules if isinstance(rule, IncludeDirective) else [rule])
        resolver = Resolver(expanded)
        assert resolver.is_allowed("DELETE", "/domains/{domain}/aliases/{source}") is False
        assert resolver.is_allowed("PUT", "/domains/{domain}/aliases/{source}") is True



    def test_a_deny_that_would_shadow_a_granted_endpoint_is_skipped_and_reported(self):
        """Variable names carry no meaning, so two spellings can be the same rule.

        Refusing the mappings page's "remove alias mapping" must not take the users
        page's "remove alias" down with it.
        """
        scope = MAIL_GLOBAL
        baseline = find_profile("classpath://linagora-mail-admin-profile.json")
        answers = grant_all(scope)
        answers["mappings.remove-alias"] = False
        generated = generate(INVENTORY, scope, answers, baseline)

        denied_endpoints = {
            rule.endpoint for rule in generated.rules if isinstance(rule, Rule) and rule.denied
        }
        assert "/address/aliases/{userAddress}/sources/{aliasSource}" not in denied_endpoints
        assert any("shadow" in warning.en or "block" in warning.en for warning in generated.warnings)



    def test_an_endpoint_the_baseline_misses_is_emitted_explicitly(self):
        """The mail baseline grants /mappings/sources/%@{domain} with no query string."""
        baseline = find_profile("classpath://functional-admin-mail-baseline.json")
        generated = generate(INVENTORY, MAIL_DOMAIN, grant_all(MAIL_DOMAIN), baseline)
        assert ("GET", "/mappings/sources/%@{domain}?type={type}") in endpoints_of(generated)

    def test_domain_scope_rewrites_only_user_address_segments(self):
        cases = [
            ("/users/{username}/mailboxes", "/users/%@{domain}/mailboxes"),
            ("/quota/users/{username}/size", "/quota/users/%@{domain}/size"),
            (
                "/deletedMessages/users/{mailbox@domain}/messages?force=true",
                "/deletedMessages/users/%@{domain}/messages?force=true",
            ),
            # A {mailbox} in a query string is a parameter value, not an address.
            (
                "/messages?mailbox={mailbox}&olderThan={date}&useSavedDate",
                "/messages?mailbox={mailbox}&olderThan={date}&useSavedDate",
            ),
            ("/domains/{domain}/aliases", "/domains/{domain}/aliases"),
        ]
        for pattern, expected in cases:
            with self.subTest(pattern=pattern):
                assert domain_scope(pattern) == expected
