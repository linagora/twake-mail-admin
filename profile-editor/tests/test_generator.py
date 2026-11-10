"""Generation: closure, domain scoping, and baseline reuse."""

from __future__ import annotations

import unittest

from twake_profile_editor.generator import (
    DOMAIN_SCOPING_CAVEATS,
    Generated,
    Scope,
    UnscopedDomainRule,
    domain_scope,
    generate,
)
from twake_profile_editor.inventory import INVENTORY
from twake_profile_editor.model import Application, Inventory, Mode, must, page
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



    def test_granting_nothing_produces_a_profile_denying_every_call(self):
        """An empty list would allow every call: webadmin-proxy skips the check."""
        for scope in (MAIL_GLOBAL, MAIL_DOMAIN):
            generated = generate(INVENTORY, scope, {})
            assert generated.to_json() == [{"denied": True, "endpoint": "/*"}]
            assert generated.warnings
            resolver = Resolver(generated.rules)
            for verb in ("GET", "POST", "PUT", "DELETE", "PATCH"):
                assert not resolver.is_allowed(verb, "/users/a@a.org")
                assert not resolver.is_allowed(verb, "/")



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
        assert "rename" not in warnings

    def test_a_domain_admin_cannot_copy_the_directory_of_another_domain(self):
        for application in Application:
            scope = Scope(application, Mode.DOMAIN)
            generated = generate(INVENTORY, scope, grant_all(scope))
            resolver = Resolver([rule for rule in generated.rules if isinstance(rule, Rule)])
            assert not resolver.is_allowed(
                "POST", "/domains/a.org/addressbooks/dab?action=copyFrom&sourceDomain=b.org"
            ), application

    def test_a_platform_operator_may_copy_the_directory_of_another_domain(self):
        scope = Scope(Application.CALENDAR, Mode.GLOBAL)
        generated = generate(INVENTORY, scope, grant_all(scope))
        assert Resolver(generated.rules).is_allowed(
            "POST", "/domains/a.org/addressbooks/dab?action=copyFrom&sourceDomain=b.org"
        )

    def test_a_domain_admin_cannot_rename_a_user_into_another_domain(self):
        generated = generate(INVENTORY, MAIL_DOMAIN, grant_all(MAIL_DOMAIN))
        rules = [rule for rule in generated.rules if "/rename/" in rule.endpoint]
        assert [rule.endpoint for rule in rules] == [
            "/users/%@{domain}/rename/%@{domain}?action=rename",
            "/users/%@{domain}/rename/%@{domain}",
        ]
        resolver = Resolver(rules)
        assert resolver.is_allowed("POST", "/users/a@a.org/rename/b@a.org?action=rename")
        assert not resolver.is_allowed("POST", "/users/a@a.org/rename/b@b.org?action=rename")



    def test_a_fully_granting_domain_profile_is_pinned_to_the_domain(self):
        """Every DOMAIN rule names the caller's domain, so the proxy can pin it.

        A rule without ``{domain}`` is granted on every tenant: the restriction
        only constrains captured variables. The only exceptions are the patterns
        the operator is explicitly warned about.
        """
        for application in Application:
            scope = Scope(application, Mode.DOMAIN)
            with self.subTest(application=application.value):
                generated = generate(INVENTORY, scope, grant_all(scope))
                unscoped = {
                    (verb, pattern)
                    for verb, pattern in endpoints_of(generated)
                    if "{domain}" not in pattern and pattern not in DOMAIN_SCOPING_CAVEATS
                }
                assert not unscoped, sorted(unscoped)

    def test_a_domain_profile_grants_no_cross_tenant_listing(self):
        """Regression: global routes reached DOMAIN profiles through the frontend gates."""
        for application in Application:
            scope = Scope(application, Mode.DOMAIN)
            with self.subTest(application=application.value):
                granted = endpoints_of(generate(INVENTORY, scope, grant_all(scope)))
                for key in [
                    ("GET", "/registeredUsers"),
                    ("POST", "/registeredUsers"),
                    ("PATCH", "/registeredUsers"),
                    ("DELETE", "/registeredUsers"),
                    ("GET", "/tasks"),
                    ("GET", "/tasks?{query_params}"),
                    ("GET", "/mailingLists"),
                ]:
                    assert key not in granted, key

    def test_a_domain_admin_still_gets_its_registered_users_and_tasks(self):
        scope = Scope(Application.CALENDAR, Mode.DOMAIN)
        granted = endpoints_of(generate(INVENTORY, scope, grant_all(scope)))
        assert ("GET", "/domains/{domain}/registeredUsers") in granted
        assert ("DELETE", "/domains/{domain}/registeredUsers") in granted
        assert ("POST", "/domains/{domain}?action=deleteData") in granted
        assert ("GET", "/domains/{domain}/tasks/{id}") in granted

    def test_an_unscoped_domain_rule_is_refused(self):
        inventory = Inventory(
            pages=(page("p", "P", "P", endpoints=[must("GET", "/registeredUsers")]),)
        )
        scope = Scope(Application.CALENDAR, Mode.DOMAIN)
        with self.assertRaises(UnscopedDomainRule) as raised:
            generate(inventory, scope, {"p": False})
        assert "GET /registeredUsers" in str(raised.exception)

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
        answers["users.aliases.remove"] = False
        generated = generate(INVENTORY, MAIL_DOMAIN, answers, baseline)

        denies = [rule for rule in generated.rules if isinstance(rule, Rule) and rule.denied]
        assert any(
            rule.endpoint == "/address/aliases/%@{domain}/sources/{alias}" and rule.verb == ("DELETE",)
            for rule in denies
        ), denies



    def test_a_refused_rename_is_hidden_from_the_frontend_too(self):
        """Both users are in {domain}: the deny must not need them to be equal."""
        baseline = find_profile("classpath://functional-admin-mail-baseline.json")
        answers = grant_all(MAIL_DOMAIN)
        answers["users.rename"] = False
        generated = generate(INVENTORY, MAIL_DOMAIN, answers, baseline)

        denies = [rule.endpoint for rule in generated.rules if isinstance(rule, Rule) and rule.denied]
        assert "/users/%@{domain}/rename/%@{otherDomain}" in denies
        expanded = []
        for rule in generated.rules:
            expanded.extend(baseline.rules if isinstance(rule, IncludeDirective) else [rule])
        resolver = Resolver(expanded)
        assert resolver.is_allowed("POST", "/users/{username}/rename/{newUser}") is False
        assert resolver.is_allowed("POST", "/users/a@a.org/rename/b@a.org?action=rename") is False

    def test_the_deny_rules_actually_close_the_hole(self):
        """The whole point: resolve the emitted list and the refusal must hold."""
        baseline = find_profile("classpath://functional-admin-mail-baseline.json")
        answers = grant_all(MAIL_DOMAIN)
        answers["users.aliases.remove"] = False
        generated = generate(INVENTORY, MAIL_DOMAIN, answers, baseline)

        expanded = []
        for rule in generated.rules:
            expanded.extend(baseline.rules if isinstance(rule, IncludeDirective) else [rule])
        resolver = Resolver(expanded)
        assert resolver.is_allowed("DELETE", "/address/aliases/{username}/sources/{alias}") is False
        assert resolver.is_allowed("PUT", "/address/aliases/{username}/sources/{alias}") is True



    def test_a_domain_admin_profile_never_grants_domain_alias_writes(self):
        """{domain} only binds the destination of a domain alias, whatever the answers."""
        baseline = find_profile("classpath://functional-admin-mail-baseline.json")
        answers = grant_all(MAIL_DOMAIN)
        answers["domains.aliases.add"] = True
        answers["domains.aliases.delete"] = True
        generated = generate(INVENTORY, MAIL_DOMAIN, answers, baseline)

        expanded = []
        for rule in generated.rules:
            expanded.extend(baseline.rules if isinstance(rule, IncludeDirective) else [rule])
        resolver = Resolver(expanded)
        assert resolver.is_allowed("GET", "/domains/{domain}/aliases") is True
        assert resolver.is_allowed("PUT", "/domains/{domain}/aliases/{source}") is False
        assert resolver.is_allowed("DELETE", "/domains/{domain}/aliases/{source}") is False



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
        """The mail baseline has no rule for /mappings/user/{username}.

        It grants /mappings/sources/%@{domain} with no query string, which the proxy
        applies to every query: the ?type= variant is covered, not repeated.
        """
        baseline = find_profile("classpath://functional-admin-mail-baseline.json")
        generated = generate(INVENTORY, MAIL_DOMAIN, grant_all(MAIL_DOMAIN), baseline)
        assert ("GET", "/mappings/user/%@{domain}") in endpoints_of(generated)
        assert ("GET", "/mappings/sources/%@{domain}?type={type}") not in endpoints_of(generated)

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
            # ...but the value of a user parameter is.
            (
                "/messages?user={username}&mailbox={mailbox}&olderThan={date}&useSavedDate",
                "/messages?user=%@{domain}&mailbox={mailbox}&olderThan={date}&useSavedDate",
            ),
            ("/messages?user={username}&mailbox=Trash", "/messages?user=%@{domain}&mailbox=Trash"),
        ]
        for pattern, expected in cases:
            with self.subTest(pattern=pattern):
                assert domain_scope(pattern) == expected
