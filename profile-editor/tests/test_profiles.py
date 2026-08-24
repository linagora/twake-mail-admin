"""Loading baseline profiles, including the proxy's `include` directives."""

from __future__ import annotations

import json

import unittest

from tests.support import TempDirMixin
from twake_profile_editor.model import Application
from twake_profile_editor.profiles import (
    ProfileError,
    available_profiles,
    find_profile,
    load_rules,
    profiles_for,
    rules_from_allowed_urls,
)



# ---------------------------------------------------------------------------
# Include resolution
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Accepting what a client entry looks like
# ---------------------------------------------------------------------------


class ProfilesTest(TempDirMixin, unittest.TestCase):
    def test_the_six_classpath_profiles_are_shipped(self):
        uris = {profile.uri for profile in available_profiles()}
        assert uris == {
            "classpath://functional-admin-calendar-baseline.json",
            "classpath://functional-admin-mail-baseline.json",
            "classpath://linagora-calendar-admin-profile.json",
            "classpath://linagora-calendar-support-profile.json",
            "classpath://linagora-mail-admin-profile.json",
            "classpath://linagora-mail-support-profile.json",
        }



    def test_every_profile_holds_at_least_one_rule(self):
        for profile in available_profiles():
            assert profile.rules, profile.uri



    def test_an_unknown_profile_lists_the_known_ones(self):
        with self.assertRaisesRegex(ProfileError, "unknown profile"):
            find_profile("classpath://nope.json")



    def test_the_include_directive_round_trips(self):
        profile = find_profile("classpath://functional-admin-mail-baseline.json")
        assert profile.include_directive == {
            "include": "classpath://functional-admin-mail-baseline.json"
        }



    def test_a_classpath_include_is_expanded_in_place(self):
        path = self.tmp_path / "profile.json"
        path.write_text(
            json.dumps(
                [
                    {"denied": True, "endpoint": "/domains/{domain}"},
                    {"include": "classpath://functional-admin-mail-baseline.json"},
                ]
            )
        )
        rules = load_rules(path)
        baseline = find_profile("classpath://functional-admin-mail-baseline.json")
        assert len(rules) == 1 + len(baseline.rules)
        assert rules[0].denied is True



    def test_a_relative_file_include_resolves_next_to_its_parent(self):
        (self.tmp_path / "shared.json").write_text(json.dumps([{"endpoint": "/healthcheck"}]))
        parent = self.tmp_path / "profile.json"
        parent.write_text(json.dumps([{"include": "file://shared.json"}]))
        assert [rule.endpoint for rule in load_rules(parent)] == ["/healthcheck"]



    def test_an_absolute_file_include_is_honoured(self):
        target = self.tmp_path / "shared.json"
        target.write_text(json.dumps([{"endpoint": "/healthcheck"}]))
        parent = self.tmp_path / "profile.json"
        parent.write_text(json.dumps([{"include": f"file://{target}"}]))
        assert [rule.endpoint for rule in load_rules(parent)] == ["/healthcheck"]



    def test_an_include_cycle_is_stopped(self):
        a = self.tmp_path / "a.json"
        b = self.tmp_path / "b.json"
        a.write_text(json.dumps([{"include": "file://b.json"}]))
        b.write_text(json.dumps([{"include": "file://a.json"}]))
        with self.assertRaisesRegex(ProfileError, "nested too deeply"):
            load_rules(a)



    def test_an_unsupported_include_scheme_is_refused(self):
        path = self.tmp_path / "profile.json"
        path.write_text(json.dumps([{"include": "https://example.com/rules.json"}]))
        with self.assertRaisesRegex(ProfileError, "unsupported include scheme"):
            load_rules(path)



    def test_a_bare_rule_array_is_accepted(self):
        rules = rules_from_allowed_urls([{"endpoint": "/healthcheck"}])
        assert rules[0].endpoint == "/healthcheck"



    def test_a_client_entry_wrapper_is_accepted(self):
        rules = rules_from_allowed_urls(
            {
                "allowed.urls": [{"endpoint": "/healthcheck"}],
                "url.patterns.restrictions": {"domain": {}},
            }
        )
        assert rules[0].endpoint == "/healthcheck"



    def test_an_object_without_allowed_urls_is_refused(self):
        with self.assertRaisesRegex(ProfileError, "allowed.urls"):
            rules_from_allowed_urls({"clients": []})



    def test_a_rule_without_endpoint_or_include_is_refused(self):
        with self.assertRaisesRegex(ProfileError, 'neither "endpoint" nor "include"'):
            rules_from_allowed_urls([{"verb": ["GET"]}])

    def test_profiles_are_offered_per_application(self):
        for application, expected in [
            (Application.MAIL, "mail"),
            (Application.CALENDAR, "calendar"),
        ]:
            with self.subTest(application=application):
                offered = profiles_for(application)
                assert offered
                assert all(expected in profile.uri for profile in offered)
