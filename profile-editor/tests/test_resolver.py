"""Conformance suite for the resolver port.

Transcribed one-for-one from twake-mail-admin's ``src/lib/proxy-resolver.test.ts``.
Section numbering and test names follow the upstream file so the two can be
diffed by eye when it changes.
"""

from __future__ import annotations

import unittest

from twake_profile_editor.resolver import Resolver, Rule


def resolve(rules: list[Rule], verb: str, pattern: str) -> bool:
    return Resolver(rules).is_allowed(verb, pattern)


# ---------------------------------------------------------------------------
# 1. Bootstrap: no restriction mode
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# 2. Basic allow / deny / no-match
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# 3. First-match-wins ordering
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# 4. Verb matching
# ---------------------------------------------------------------------------

VERB_RULES = [
    Rule("/domains/{domain}/users", verb=("GET",)),
    Rule("/domains/{domain}/aliases/*"),
]


# ---------------------------------------------------------------------------
# 5. Path variable matching ({var} and %@{var})
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# 6. Wildcard * matching
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# 7. Query string matching
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# 8. Spec example rule set
# ---------------------------------------------------------------------------

SPEC_RULES = [
    Rule("/domains/{domain}/quota", denied=True),
    Rule("/domains/{domain}/users", verb=("GET",)),
    Rule("/domains/{domain}/aliases/*"),
]


SPEC_EXAMPLE_CASES = [
    ("GET", "/domains/{domain}/quota", False),  # rule 1 denies
    ("PUT", "/domains/{domain}/quota", False),  # rule 1 denies, any verb
    ("GET", "/domains/{domain}/users", True),  # rule 2
    ("POST", "/domains/{domain}/users", False),  # rule 2 verb mismatch
    ("PUT", "/domains/{domain}/aliases/{source}", True),  # rule 3 wildcard
    ("DELETE", "/domains/{domain}/aliases/{source}", True),  # rule 3, any verb
    ("GET", "/something/else", False),  # no match
]


# ---------------------------------------------------------------------------
# 9. Real patterns from validation.md
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# 10. Edge cases
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Port-specific: JSON round-trip
# ---------------------------------------------------------------------------


class ResolverTest(unittest.TestCase):
    def test_empty_rules_return_false_for_every_call(self):
        # Per spec: when GET /.proxy/allowed/urls returns 204 the caller should infer
        # NO RESTRICTIONS -- that logic lives outside the resolver. The resolver
        # itself with zero rules simply returns false (no match).
        assert resolve([], "GET", "/domains") is False



    def test_allows_when_matching_rule_has_no_denied_flag(self):
        assert resolve([Rule("/domains")], "GET", "/domains") is True



    def test_allows_when_matching_rule_has_denied_false(self):
        assert resolve([Rule("/domains", denied=False)], "GET", "/domains") is True



    def test_denies_when_matching_rule_has_denied_true(self):
        assert resolve([Rule("/domains", denied=True)], "GET", "/domains") is False



    def test_forbids_when_no_rule_matches(self):
        assert resolve([Rule("/other")], "GET", "/domains") is False



    def test_deny_rule_before_allow_rule_is_denied(self):
        rules = [Rule("/domains/{domain}/quota", denied=True), Rule("/domains/{domain}/quota")]
        assert resolve(rules, "GET", "/domains/{domain}/quota") is False



    def test_allow_rule_before_deny_rule_is_allowed(self):
        rules = [Rule("/domains/{domain}/quota"), Rule("/domains/{domain}/quota", denied=True)]
        assert resolve(rules, "GET", "/domains/{domain}/quota") is True



    def test_specific_deny_then_broad_wildcard_allow_is_denied(self):
        rules = [Rule("/domains/{domain}/quota", denied=True), Rule("/domains/*")]
        assert resolve(rules, "GET", "/domains/{domain}/quota") is False



    def test_broad_wildcard_allow_then_specific_deny_is_allowed(self):
        rules = [Rule("/domains/*"), Rule("/domains/{domain}/quota", denied=True)]
        assert resolve(rules, "GET", "/domains/{domain}/quota") is True



    def test_matches_when_verb_is_in_the_allowed_list(self):
        assert resolve(VERB_RULES, "GET", "/domains/{domain}/users") is True



    def test_does_not_match_when_verb_is_absent_from_the_allowed_list(self):
        assert resolve(VERB_RULES, "POST", "/domains/{domain}/users") is False



    def test_matches_any_verb_when_rule_has_no_verb_restriction(self):
        assert resolve(VERB_RULES, "PUT", "/domains/{domain}/aliases/foo") is True
        assert resolve(VERB_RULES, "DELETE", "/domains/{domain}/aliases/foo") is True



    def test_verb_comparison_is_case_insensitive(self):
        assert resolve([Rule("/domains", verb=("get",))], "GET", "/domains") is True



    def test_var_in_rule_matches_any_single_segment_in_component(self):
        rules = [Rule("/domains/{domain}/users")]
        assert resolve(rules, "GET", "/domains/{domain}/users") is True
        assert resolve(rules, "GET", "/domains/{d}/users") is True



    def test_var_in_component_matches_any_single_segment_in_rule(self):
        rules = [Rule("/domains/example.com/users")]
        assert resolve(rules, "GET", "/domains/{domain}/users") is True



    def test_var_matches_only_a_single_segment_not_multiple(self):
        rules = [Rule("/domains/{domain}")]
        assert resolve(rules, "GET", "/domains/{domain}/users") is False



    def test_email_var_in_rule_is_treated_as_a_single_segment_variable(self):
        rules = [Rule("/deletedMessages/users/%@{domain}/messages")]
        assert resolve(rules, "POST", "/deletedMessages/users/{mailbox}/messages") is True



    def test_email_var_in_component_matches_literal_in_rule(self):
        rules = [Rule("/deletedMessages/users/{user}/messages")]
        assert resolve(rules, "POST", "/deletedMessages/users/%@{domain}/messages") is True



    def test_variable_names_are_irrelevant(self):
        assert resolve([Rule("/abc/{ghi}")], "GET", "/abc/{def}") is True



    def test_different_path_lengths_do_not_match(self):
        rules = [Rule("/a/{b}")]
        assert resolve(rules, "GET", "/a/{b}/c") is False
        assert resolve(rules, "GET", "/a") is False



    def test_trailing_wildcard_matches_one_remaining_segment(self):
        rules = [Rule("/domains/{domain}/aliases/*")]
        assert resolve(rules, "PUT", "/domains/{domain}/aliases/{source}") is True



    def test_trailing_wildcard_matches_multiple_remaining_segments(self):
        rules = [Rule("/mailRepositories/*")]
        assert resolve(rules, "GET", "/mailRepositories/{encodedPath}/mails/{mailKey}") is True



    def test_trailing_wildcard_matches_zero_remaining_segments(self):
        # The trailing slash itself counts as one (empty) segment.
        assert resolve([Rule("/domains/*")], "GET", "/domains/") is True



    def test_trailing_wildcard_does_not_match_a_path_with_a_query_string(self):
        rules = [Rule("/domains/*")]
        assert resolve(rules, "POST", "/domains/{domain}?action=deleteData") is False



    def test_wildcard_must_match_the_path_segment_position_exactly(self):
        rules = [Rule("/a/*/b")]
        assert resolve(rules, "GET", "/a/x/b") is True
        assert resolve(rules, "GET", "/a/b") is False



    def test_both_no_query_match(self):
        rules = [Rule("/users/{username}/mailboxes")]
        assert resolve(rules, "GET", "/users/{username}/mailboxes") is True



    def test_rule_has_no_query_component_has_query_no_match(self):
        rules = [Rule("/users/{username}/mailboxes")]
        assert resolve(rules, "POST", "/users/{username}/mailboxes?task=reIndex") is False



    def test_rule_has_query_component_has_no_query_no_match(self):
        rules = [Rule("/users/{username}/mailboxes?task=reIndex")]
        assert resolve(rules, "POST", "/users/{username}/mailboxes") is False



    def test_same_literal_query_values_match(self):
        rules = [Rule("/users/{username}/mailboxes?task=reIndex")]
        assert resolve(rules, "POST", "/users/{username}/mailboxes?task=reIndex") is True



    def test_different_literal_query_values_no_match(self):
        rules = [Rule("/users/{username}/mailboxes?task=reIndex")]
        assert resolve(rules, "POST", "/users/{username}/mailboxes?task=subscribeAll") is False



    def test_var_in_rule_query_value_matches_any_component_query_value(self):
        rules = [Rule("/tasks?olderThan={value}")]
        assert resolve(rules, "DELETE", "/tasks?olderThan=5day") is True
        assert resolve(rules, "DELETE", "/tasks?olderThan=30day") is True



    def test_var_in_component_query_value_matches_any_rule_query_value(self):
        rules = [Rule("/tasks?olderThan=5day")]
        assert resolve(rules, "DELETE", "/tasks?olderThan={days}day") is True



    def test_partial_template_in_query_value_is_treated_as_a_variable(self):
        rules = [Rule("/tasks?olderThan={value}")]
        assert resolve(rules, "DELETE", "/tasks?olderThan={days}day") is True



    def test_multi_param_query_is_order_independent(self):
        rules = [
            Rule(
                "/quota/users?minOccupationRatio={min}&maxOccupationRatio={max}"
                "&limit={limit}&offset={offset}"
            )
        ]
        assert (
            resolve(
                rules,
                "GET",
                "/quota/users?offset={offset}&limit={limit}"
                "&maxOccupationRatio={max}&minOccupationRatio={min}",
            )
            is True
        )



    def test_different_number_of_query_params_no_match(self):
        rules = [Rule("/foo?a=1&b=2")]
        assert resolve(rules, "GET", "/foo?a=1") is False
        assert resolve(rules, "GET", "/foo?a=1&b=2&c=3") is False



    def test_different_query_keys_no_match(self):
        rules = [Rule("/foo?task=reIndex")]
        assert resolve(rules, "POST", "/foo?action=reIndex") is False



    def test_query_flag_param_matches_flag_param(self):
        rules = [Rule("/reports/quota/users?hasSpecificQuota")]
        assert resolve(rules, "GET", "/reports/quota/users?hasSpecificQuota") is True



    def test_query_flag_param_does_not_match_keyed_param_with_same_name(self):
        rules = [Rule("/reports/quota/users?hasSpecificQuota")]
        assert resolve(rules, "GET", "/reports/quota/users?hasSpecificQuota=true") is False



    def test_tasks_older_than_is_distinct_from_plain_tasks(self):
        rules = [Rule("/tasks?olderThan={value}", verb=("DELETE",)), Rule("/tasks")]
        assert resolve(rules, "DELETE", "/tasks?olderThan={days}day") is True
        assert resolve(rules, "GET", "/tasks") is True
        # verb mismatch on rule 1, rule 2 carries no query
        assert resolve(rules, "GET", "/tasks?olderThan={days}day") is False



    def test_delete_data_action_is_distinct_from_plain_user_endpoint(self):
        rules = [Rule("/users/{username}?action=deleteData")]
        assert resolve(rules, "POST", "/users/{username}?action=deleteData") is True
        assert resolve(rules, "POST", "/users/{username}") is False



    def test_mailbox_task_variants_are_distinct_query_patterns(self):
        rules = [
            Rule("/users/{username}/mailboxes?task=reIndex"),
            Rule("/users/{username}/mailboxes?task=subscribeAll"),
        ]
        assert resolve(rules, "POST", "/users/{username}/mailboxes?task=reIndex") is True
        assert resolve(rules, "POST", "/users/{username}/mailboxes?task=subscribeAll") is True
        assert (
            resolve(
                rules,
                "POST",
                "/users/{username}/mailboxes?task=recomputeFastViewProjectionItems",
            )
            is False
        )
        assert resolve(rules, "GET", "/users/{username}/mailboxes") is False



    def test_domain_mode_only_evaluates_domain_scoped_tasks(self):
        rules = [Rule("/domains/{domain}/tasks/{id}")]
        assert resolve(rules, "GET", "/domains/{domain}/tasks/{id}") is True
        assert resolve(rules, "GET", "/tasks/{id}") is False



    def test_team_mailbox_folder_subaddressing_path(self):
        rules = [
            Rule(
                "/domains/{domain}/team-mailboxes/{mailbox}/mailboxes"
                "/{folderName}/subaddressing"
            )
        ]
        assert (
            resolve(
                rules,
                "GET",
                "/domains/{domain}/team-mailboxes/{mailbox}/mailboxes"
                "/{folderName}/subaddressing",
            )
            is True
        )
        assert (
            resolve(
                rules,
                "GET",
                "/domains/{domain}/team-mailboxes/{mailbox}/mailboxes/{folderName}",
            )
            is False
        )



    def test_mail_repositories_wildcard_covers_all_nested_paths(self):
        rules = [Rule("/mailRepositories/*")]
        assert resolve(rules, "GET", "/mailRepositories") is False  # * needs a segment
        assert resolve(rules, "GET", "/mailRepositories/") is True  # trailing slash counts
        assert resolve(rules, "GET", "/mailRepositories/{encodedPath}/mails") is True
        assert (
            resolve(rules, "PATCH", "/mailRepositories/{encodedPath}/mails/{mailKey}") is True
        )
        # Query strings are not covered by the wildcard alone
        assert (
            resolve(rules, "PATCH", "/mailRepositories/{encodedPath}/mails?action=reprocess")
            is False
        )



    def test_event_dead_letter_action_query(self):
        rules = [
            Rule("/events/deadLetter?action=reDeliver"),
            Rule("/events/deadLetter/groups/{group}?action=reDeliver"),
        ]
        assert resolve(rules, "POST", "/events/deadLetter?action=reDeliver") is True
        assert (
            resolve(rules, "POST", "/events/deadLetter/groups/{group}?action=reDeliver")
            is True
        )
        assert resolve(rules, "GET", "/events/deadLetter") is False



    def test_calendar_archive_has_distinct_query_from_other_calendar_ops(self):
        rules = [Rule("/calendars?task=archive"), Rule("/calendars?task=reindex")]
        assert resolve(rules, "POST", "/calendars?task=archive") is True
        assert resolve(rules, "POST", "/calendars?task=reindex") is True
        assert resolve(rules, "POST", "/calendars?task=scheduleAlarms") is False



    def test_domain_scoped_resources_with_reposition_write_rights_query(self):
        rules = [
            Rule("/domains/{domain}/resources?task=repositionWriteRights"),
            Rule("/domains/{domain}/resources/{resourceId}"),
            Rule("/domains/{domain}/resources"),
        ]
        assert (
            resolve(rules, "POST", "/domains/{domain}/resources?task=repositionWriteRights")
            is True
        )
        assert resolve(rules, "GET", "/domains/{domain}/resources/{resourceId}") is True
        assert resolve(rules, "GET", "/domains/{domain}/resources") is True
        # Legacy /resources routes are not declared -> forbidden
        assert resolve(rules, "GET", "/resources/{resourceId}") is False



    def test_quota_users_multi_param_explorer(self):
        rules = [
            Rule(
                "/quota/users?minOccupationRatio={min}&maxOccupationRatio={max}"
                "&limit={limit}&offset={offset}"
            )
        ]
        assert (
            resolve(
                rules,
                "GET",
                "/quota/users?minOccupationRatio={min}&maxOccupationRatio={max}"
                "&limit={limit}&offset={offset}",
            )
            is True
        )
        assert (
            resolve(
                rules,
                "GET",
                "/quota/users?minOccupationRatio={min}&maxOccupationRatio={max}&limit={limit}",
            )
            is False
        )



    def test_blobs_garbage_collection_with_scope_query(self):
        rules = [Rule("/blobs?scope=unreferenced")]
        assert resolve(rules, "DELETE", "/blobs?scope=unreferenced") is True
        assert resolve(rules, "DELETE", "/blobs?scope=other") is False
        assert resolve(rules, "DELETE", "/blobs") is False



    def test_search_deleted_messages_with_force_query_flag(self):
        rules = [Rule("/deletedMessages/users/{mailbox}/messages?force=true")]
        assert (
            resolve(rules, "POST", "/deletedMessages/users/{mailbox}/messages?force=true")
            is True
        )
        assert resolve(rules, "POST", "/deletedMessages/users/{mailbox}/messages") is False



    def test_rename_user_endpoint_with_action_query(self):
        rules = [Rule("/users/{username}/rename/{newUsername}?action=rename")]
        assert (
            resolve(rules, "POST", "/users/{username}/rename/{newUsername}?action=rename")
            is True
        )
        assert resolve(rules, "POST", "/users/{username}/rename/{newUsername}") is False



    def test_root_path_matches_root_path(self):
        assert resolve([Rule("/")], "GET", "/") is True



    def test_empty_verb_array_never_matches(self):
        assert resolve([Rule("/domains", verb=())], "GET", "/domains") is False



    def test_multiple_var_segments_in_a_row_all_match(self):
        rules = [Rule("/{a}/{b}/{c}")]
        assert resolve(rules, "GET", "/{x}/{y}/{z}") is True
        assert resolve(rules, "GET", "/{x}/{y}") is False



    def test_patch_verb_is_supported(self):
        rules = [Rule("/resources/{id}", verb=("PATCH",))]
        assert resolve(rules, "PATCH", "/resources/{id}") is True
        assert resolve(rules, "GET", "/resources/{id}") is False



    def test_multiple_rules_correct_one_matched_in_sequence(self):
        rules = [Rule("/a"), Rule("/b"), Rule("/c")]
        assert resolve(rules, "GET", "/a") is True
        assert resolve(rules, "GET", "/b") is True
        assert resolve(rules, "GET", "/c") is True
        assert resolve(rules, "GET", "/d") is False



    def test_deny_before_a_general_allow_stops_the_search_at_the_deny(self):
        rules = [Rule("/domains/{d}/quota", denied=True), Rule("/*")]
        assert resolve(rules, "GET", "/domains/{d}/quota") is False
        assert resolve(rules, "GET", "/domains/{d}/users") is True



    def test_rule_round_trips_through_json(self):
        raw = {"denied": True, "verb": ["GET", "PUT"], "endpoint": "/domains/{domain}"}
        assert Rule.from_json(raw).to_json() == raw



    def test_the_verbs_misspelling_applies_to_every_verb_as_the_proxy_reads_it(self):
        """docs/02-configuration.md shows `verbs` once; the proxy only reads `verb`."""
        rule = Rule.from_json({"verbs": ["DELETE"], "endpoint": "/x"})
        assert rule.verb is None
        assert resolve([rule], "GET", "/x") is True

    def test_spec_example_rule_set(self):
        for verb, pattern, expected in SPEC_EXAMPLE_CASES:
            with self.subTest(verb=verb, pattern=pattern):
                assert resolve(SPEC_RULES, verb, pattern) is expected
