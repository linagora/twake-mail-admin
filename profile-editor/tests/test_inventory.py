"""The inventory must stay in lock-step with validation.md.

This is the drift detector. It re-parses ``validation.md`` -- the real one, two
directories up, not a copy -- on every run and compares the declared
``(verb, pattern)`` pairs against the tree. Documenting a new page without
teaching the generator about it fails here, with the exact rows that are missing.
"""

from __future__ import annotations

import functools
import re
import unittest

from twake_profile_editor import repo
from twake_profile_editor.inventory import FRONTEND_ONLY, INVENTORY, NEVER_BLOCKED
from twake_profile_editor.model import Application, Kind, Mode, Requirement

VERBS = {"GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"}


def parse_validation_md(text: str) -> set[tuple[str, str]]:
    """Extract every (verb, pattern) declared in the markdown tables.

    Rows are recognised by shape rather than by the table header, because a few
    tables upstream carry a single row and no header at all.
    """
    declared: set[tuple[str, str]] = set()
    for line in text.splitlines():
        line = line.strip()
        if not line.startswith("|"):
            continue
        cells = [cell.strip() for cell in line.strip("|").split("|")]
        if len(cells) < 3 or cells[1] not in VERBS:
            continue
        match = re.search(r"`([^`]+)`", cells[2])
        if not match:
            continue
        declared.add((cells[1], match.group(1)))
    return declared


@functools.lru_cache(maxsize=1)
def declared() -> frozenset[tuple[str, str]]:
    """What validation.md declares, parsed once per run."""
    parsed = parse_validation_md(repo.VALIDATION_MD.read_text(encoding="utf-8"))
    return frozenset(parsed - set(NEVER_BLOCKED))


class ValidationMdConformanceTest(unittest.TestCase):
    def test_validation_md_parses_to_a_plausible_number_of_endpoints(self):
        # Guards against a parser that silently matches nothing after a format change.
        assert len(declared()) > 150

    def test_inventory_declares_every_endpoint_of_validation_md(self):
        covered = {endpoint.key for endpoint in INVENTORY.endpoints()}
        missing = sorted(declared() - covered)
        assert not missing, (
            "endpoints declared upstream but absent from the inventory:\n"
            + "\n".join(f"  {verb} {pattern}" for verb, pattern in missing)
        )

    def test_inventory_invents_no_endpoint_beyond_the_documented_exceptions(self):
        covered = {endpoint.key for endpoint in INVENTORY.endpoints()}
        extra = sorted(covered - declared() - set(FRONTEND_ONLY))
        assert not extra, (
            "endpoints in the inventory with no counterpart upstream:\n"
            + "\n".join(f"  {verb} {pattern}" for verb, pattern in extra)
        )


class StructuralInvariantsTest(unittest.TestCase):
    def test_node_ids_are_unique(self):
        ids = [node.id for node in INVENTORY.nodes]
        assert len(ids) == len(set(ids))

    def test_child_ids_are_exactly_their_parent_plus_one_segment(self):
        """Catches a subtree prefixed twice, e.g. domains.aliases.aliases.add."""
        parents = INVENTORY.parents
        for node in INVENTORY.nodes:
            parent = parents[node.id]
            if parent is None:
                assert "." not in node.id, node.id
            else:
                assert node.id.startswith(f"{parent}."), node.id
                assert "." not in node.id[len(parent) + 1 :], node.id

    def test_every_node_carries_a_french_label(self):
        for node in INVENTORY.nodes:
            assert node.label.fr, node.id
            assert node.label.en, node.id

    def test_actions_only_declare_may_endpoints(self):
        """MUST on an action would be a contradiction: an action never gates a view."""
        for node in INVENTORY.nodes:
            if node.kind is Kind.ACTION:
                for endpoint in node.endpoints:
                    assert endpoint.requirement is Requirement.MAY, node.id

    def test_every_leaf_declares_at_least_one_endpoint(self):
        for node in INVENTORY.nodes:
            if not node.children:
                assert node.endpoints, node.id

    def test_containers_without_a_must_endpoint_derive_their_visibility(self):
        for node in INVENTORY.nodes:
            if node.kind is not Kind.ACTION and not node.must_endpoints:
                assert node.children, node.id
                assert node.derives_visibility, node.id


class ScopingTest(unittest.TestCase):
    def test_every_scope_yields_a_non_empty_tree(self):
        for application in Application:
            for mode in Mode:
                with self.subTest(application=application.value, mode=mode.value):
                    scoped = INVENTORY.for_scope(application, mode)
                    assert scoped.pages
                    for node in scoped.nodes:
                        assert node.applies_to(application, mode)

    def test_domain_mode_uses_its_own_left_bar(self):
        """DOMAIN mode is a different app, not GLOBAL minus a few pages."""
        page_ids = [
            page.id for page in INVENTORY.for_scope(Application.MAIL, Mode.DOMAIN).pages
        ]
        assert page_ids == [
            "users",
            "domains.aliases",
            "domains.team-mailboxes",
            "domains.quota",
            "domains.ratelimits",
            "mailing-lists",
            "tasks",
            "tasks-snackbar",
        ]
        calendar_ids = [
            page.id
            for page in INVENTORY.for_scope(Application.CALENDAR, Mode.DOMAIN).pages
        ]
        assert calendar_ids == [
            "domains.admins",
            "domains.resources",
            "users",
            "registered-users",
            "domains.settings",
            "tasks",
            "tasks-snackbar",
        ]

    def test_domain_mode_drops_the_global_only_pages(self):
        page_ids = {
            page.id for page in INVENTORY.for_scope(Application.MAIL, Mode.DOMAIN).pages
        }
        assert "mail-repositories" not in page_ids
        assert "cassandra" not in page_ids
        assert "domains" not in page_ids

    def test_mail_scope_drops_the_calendar_only_components(self):
        scoped = INVENTORY.for_scope(Application.MAIL, Mode.GLOBAL)
        ids = {node.id for node in scoped.nodes}
        assert "registered-users" not in ids
        assert "domains.resources" not in ids
        assert "users.calendars" not in ids

    def test_tasks_snackbar_switches_pattern_with_the_mode(self):
        global_snackbar = {
            endpoint.pattern
            for node in INVENTORY.for_scope(Application.MAIL, Mode.GLOBAL).nodes
            if node.id == "tasks-snackbar"
            for endpoint in node.endpoints
        }
        domain_snackbar = {
            endpoint.pattern
            for node in INVENTORY.for_scope(Application.MAIL, Mode.DOMAIN).nodes
            if node.id == "tasks-snackbar"
            for endpoint in node.endpoints
        }
        assert global_snackbar == {"/tasks/{id}"}
        assert domain_snackbar == {"/domains/{domain}/tasks/{id}"}
