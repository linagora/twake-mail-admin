"""``--check`` must agree with the frontend, and with what the tool just generated."""

from __future__ import annotations

import unittest

from twake_profile_editor.check import check, render
from twake_profile_editor.generator import Scope, generate
from twake_profile_editor.inventory import INVENTORY
from twake_profile_editor.model import Application, Kind, Mode
from twake_profile_editor.profiles import IncludeDirective, find_profile
from twake_profile_editor.resolver import Rule

SCOPES = [
    Scope(application, mode)
    for application in Application
    for mode in Mode
]


def expand(rules) -> list[Rule]:
    """Flatten include directives the way the proxy does before evaluating."""
    expanded: list[Rule] = []
    for rule in rules:
        if isinstance(rule, IncludeDirective):
            expanded.extend(find_profile(rule.uri).rules)
        else:
            expanded.append(rule)
    return expanded


def statuses_by_id(statuses):
    return {status.node.id: status for page in statuses for status in page.walk()}


# ---------------------------------------------------------------------------
# The round trip: what was granted is what is reported visible
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Derived visibility
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Reporting on the shipped profiles
# ---------------------------------------------------------------------------


class CheckTest(unittest.TestCase):
    def test_a_refused_action_is_reported_forbidden_and_its_page_still_visible(self):
        scope = Scope(Application.MAIL, Mode.GLOBAL)
        scoped = INVENTORY.for_scope(scope.application, scope.mode)
        answers = {node.id: True for node in scoped.nodes}
        answers["domains.delete"] = False
        generated = generate(INVENTORY, scope, answers)

        report = statuses_by_id(check(scoped, expand(generated.rules)))
        assert report["domains"].available is True
        assert report["domains.delete"].available is False
        assert report["domains.delete"].reason_key == "check.forbidden"



    def test_a_hidden_page_reports_its_children_as_unreachable(self):
        scope = Scope(Application.MAIL, Mode.GLOBAL)
        scoped = INVENTORY.for_scope(scope.application, scope.mode)
        answers = {node.id: True for node in scoped.nodes}
        answers["domains"] = False
        generated = generate(INVENTORY, scope, answers)

        report = statuses_by_id(check(scoped, expand(generated.rules)))
        assert report["domains"].reason_key == "check.hidden"
        assert report["domains.aliases"].reason_key == "check.parent-hidden"



    def test_a_container_with_no_load_call_follows_its_actions(self):
        """"If both are missing hide the page" -- validation.md, Resource locator."""
        scope = Scope(Application.MAIL, Mode.GLOBAL)
        scoped = INVENTORY.for_scope(scope.application, scope.mode)

        answers = {node.id: False for node in scoped.nodes}
        answers["resource-locator"] = True
        answers["resource-locator.search-mailbox"] = True
        granted = generate(INVENTORY, scope, answers)
        report = statuses_by_id(check(scoped, expand(granted.rules)))
        assert report["resource-locator"].available is True
        assert report["resource-locator"].reason_key == "check.derived"

        answers["resource-locator.search-mailbox"] = False
        refused = generate(INVENTORY, scope, answers)
        report = statuses_by_id(check(scoped, expand(refused.rules)))
        assert report["resource-locator"].available is False
        assert report["resource-locator"].reason_key == "check.derived-hidden"



    def test_an_action_needs_every_call_it_makes(self):
        """The reindex button needs both its gate and its actual call."""
        scope = Scope(Application.MAIL, Mode.GLOBAL)
        scoped = INVENTORY.for_scope(scope.application, scope.mode)
        only_the_call = [
            Rule(endpoint="/users", verb=("GET",)),
            Rule(endpoint="/users/{username}/mailboxes", verb=("GET",)),
            Rule(endpoint="/users/{username}/mailboxes?task=reIndex", verb=("POST",)),
        ]
        report = statuses_by_id(check(scoped, only_the_call))
        assert report["users.mailboxes"].available is True
        assert report["users.mailboxes.reindex"].available is False



    def test_the_report_names_the_missing_endpoint(self):
        scoped = INVENTORY.for_scope(Application.MAIL, Mode.GLOBAL)
        text = render(check(scoped, [Rule(endpoint="/healthcheck", verb=("GET",))]), lang="en")
        assert "+ Health check [visible]" in text
        assert "missing: GET /domains" in text



    def test_the_report_is_translated(self):
        scoped = INVENTORY.for_scope(Application.MAIL, Mode.GLOBAL)
        text = render(check(scoped, [Rule(endpoint="/healthcheck", verb=("GET",))]), lang="fr")
        assert "Contrôle de santé [visible]" in text
        assert "Domaines [masqué]" in text



    def test_the_summary_counts_pages_and_actions(self):
        scoped = INVENTORY.for_scope(Application.MAIL, Mode.DOMAIN)
        statuses = check(scoped, find_profile("classpath://linagora-mail-support-profile.json").rules)
        total_actions = sum(
            1 for page in statuses for status in page.walk() if status.node.kind is Kind.ACTION
        )
        assert f"/{len(statuses)} pages visible" in render(statuses, lang="en")
        assert f"/{total_actions} actions allowed" in render(statuses, lang="en")

    def test_granting_everything_makes_everything_visible(self):
        """The round trip that matters, in all four scopes."""
        for scope in SCOPES:
            with self.subTest(application=scope.application.value, mode=scope.mode.value):
                scoped = INVENTORY.for_scope(scope.application, scope.mode)
                answers = {node.id: True for node in scoped.nodes}
                generated = generate(INVENTORY, scope, answers)

                report = statuses_by_id(check(scoped, expand(generated.rules)))
                hidden = sorted(
                    node_id for node_id, status in report.items() if not status.available
                )
                assert not hidden, hidden

    def test_granting_nothing_makes_everything_hidden(self):
        for scope in SCOPES:
            with self.subTest(application=scope.application.value, mode=scope.mode.value):
                scoped = INVENTORY.for_scope(scope.application, scope.mode)
                generated = generate(INVENTORY, scope, {})
                report = statuses_by_id(check(scoped, expand(generated.rules)))
                assert not any(status.available for status in report.values())

    def test_every_shipped_mail_profile_can_be_reported_on(self):
        scoped = INVENTORY.for_scope(Application.MAIL, Mode.DOMAIN)
        for uri in [
            "classpath://functional-admin-mail-baseline.json",
            "classpath://linagora-mail-admin-profile.json",
            "classpath://linagora-mail-support-profile.json",
        ]:
            with self.subTest(profile=uri):
                text = render(check(scoped, find_profile(uri).rules), lang="en")
                assert "pages visible" in text
