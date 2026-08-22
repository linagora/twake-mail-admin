"""The interview must stay short: short-circuit, all/none/detail, checkboxes."""

from __future__ import annotations

import unittest

from tests.support import RecordingPrompter, ScriptedPrompter
from twake_profile_editor.answers import Answers
from twake_profile_editor.interview import ALL, DETAIL, NONE, NO_BASELINE, run
from twake_profile_editor.inventory import INVENTORY
from twake_profile_editor.model import Application, Mode


def base_script(**extra) -> dict[str, object]:
    script: dict[str, object] = {
        "Name of the profile": "support",
        "Which application": Application.MAIL.value,
        "Which mode": Mode.GLOBAL.value,
        "Reuse an existing": NO_BASELINE,
        "Which pages": [],
    }
    script.update(extra)
    return script


def previous_answers(**values) -> Answers:
    return Answers(
        name="support",
        application=Application.MAIL,
        mode=Mode.GLOBAL,
        baseline=None,
        language="en",
        values=values,
    )


class InterviewTest(unittest.TestCase):
    def interview(self, prompter, **kwargs):
        return run(INVENTORY, prompter, **kwargs)

    def test_refusing_every_page_asks_nothing_else(self):
        prompter = ScriptedPrompter(script=base_script())
        result = self.interview(prompter, lang="en")

        assert all(value is False for value in result.answers.values.values())
        assert not any("tick what may be seen" in q for q in prompter.asked)

    def test_refusing_a_page_never_asks_about_its_sections(self):
        prompter = ScriptedPrompter(script=base_script(**{"Which pages": ["health-check"]}))
        self.interview(prompter, lang="en")

        assert not any("Domains" in question for question in prompter.asked)

    def test_everything_settles_a_whole_subtree_in_one_answer(self):
        prompter = ScriptedPrompter(
            script=base_script(**{"Which pages": ["domains"], "Domains — what may be seen": ALL})
        )
        result = self.interview(prompter, lang="en")

        domains = [
            node_id
            for node_id in result.answers.values
            if node_id == "domains" or node_id.startswith("domains.")
        ]
        assert domains
        assert all(result.answers.values[node_id] for node_id in domains)
        # One three-way question for the page, and nothing below it.
        assert sum("what may be seen" in q for q in prompter.asked) == 1

    def test_nothing_settles_a_whole_subtree_in_one_answer(self):
        prompter = ScriptedPrompter(
            script=base_script(**{"Which pages": ["domains"], "Domains — what may be seen": NONE})
        )
        result = self.interview(prompter, lang="en")

        assert result.answers.values["domains"] is True
        assert result.answers.values["domains.aliases"] is False
        assert result.answers.values["domains.aliases.add"] is False

    def test_detail_descends_only_into_what_was_ticked(self):
        prompter = ScriptedPrompter(
            script=base_script(
                **{
                    "Which pages": ["domains"],
                    "Domains — what may be seen": DETAIL,
                    "Domains — tick what": ["domains.aliases"],
                    "Aliases tab — what may be seen": ALL,
                }
            )
        )
        result = self.interview(prompter, lang="en")

        assert result.answers.values["domains.aliases"] is True
        assert result.answers.values["domains.aliases.add"] is True
        assert result.answers.values["domains.quota"] is False
        assert result.answers.values["domains.quota.save"] is False
        # The quota tab was never opened, so its contents were never asked about.
        assert not any("Quota tab —" in question for question in prompter.asked)

    def test_every_node_of_the_scope_gets_an_answer(self):
        prompter = ScriptedPrompter(script=base_script(**{"Which pages": []}))
        result = self.interview(prompter, lang="en")

        scoped = INVENTORY.for_scope(Application.MAIL, Mode.GLOBAL)
        assert set(result.answers.values) == {node.id for node in scoped.nodes}

    def test_the_scope_drives_which_pages_are_offered(self):
        prompter = ScriptedPrompter(
            script=base_script(
                **{"Which application": Application.CALENDAR.value, "Which pages": []}
            )
        )
        result = self.interview(prompter, lang="en")
        assert "mail-repositories" not in result.answers.values
        assert "registered-users" in result.answers.values

    def test_french_is_used_throughout(self):
        prompter = ScriptedPrompter(
            script={
                "Nom du profil": "support",
                "Pour quelle application": Application.MAIL.value,
                "Quel mode": Mode.GLOBAL.value,
                "Réutiliser un profil": NO_BASELINE,
                "Quelles pages": ["domains"],
                "Domaines — que peut-on": NONE,
            }
        )
        result = self.interview(prompter, lang="fr")
        assert result.answers.language == "fr"
        assert result.answers.values["domains"] is True

    def test_name_given_on_the_command_line_is_not_asked(self):
        prompter = ScriptedPrompter(script=base_script(**{"Which pages": []}))
        self.interview(prompter, lang="en", name="from-cli")
        assert not any("Name of the profile" in q for q in prompter.asked)


class ResumingTest(unittest.TestCase):
    def test_resuming_preselects_the_pages_of_the_previous_run(self):
        prefill = previous_answers(**{"domains": True, "users": False})
        prompter = RecordingPrompter(
            script=base_script(
                **{"Which pages": ["domains"], "Domains — what may be seen": NONE}
            )
        )
        run(INVENTORY, prompter, lang="en", prefill=prefill)

        pages_question = next(k for k in prompter.preselections if "Which pages" in k)
        assert prompter.preselections[pages_question] == ["domains"]

    def test_resuming_suggests_the_verdict_the_previous_run_implies(self):
        scoped = INVENTORY.for_scope(Application.MAIL, Mode.GLOBAL)
        all_domains = {
            node.id: True
            for node in scoped.nodes
            if node.id == "domains" or node.id.startswith("domains.")
        }
        prefill = previous_answers(**all_domains)

        # No scripted answer for the three-way question: the default is taken,
        # and it must be "everything" since that is what was recorded.
        prompter = ScriptedPrompter(script=base_script(**{"Which pages": ["domains"]}))
        result = run(INVENTORY, prompter, lang="en", prefill=prefill)
        assert result.answers.values["domains.aliases.add"] is True

    def test_questions_the_previous_file_never_answered_are_reported(self):
        prefill = previous_answers(**{"domains": True})
        prompter = ScriptedPrompter(
            script=base_script(
                **{"Which pages": ["domains"], "Domains — what may be seen": NONE}
            )
        )
        result = run(INVENTORY, prompter, lang="en", prefill=prefill)

        assert "users" in result.not_prefilled
        assert "domains" not in result.not_prefilled

    def test_a_fresh_interview_reports_nothing_as_missing(self):
        prompter = ScriptedPrompter(script=base_script(**{"Which pages": []}))
        assert run(INVENTORY, prompter, lang="en").not_prefilled == []
