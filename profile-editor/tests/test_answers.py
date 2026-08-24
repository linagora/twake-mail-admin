"""The .questions file is the source of truth for a profile; it must be strict."""

from __future__ import annotations

import json

import unittest

from tests.support import TempDirMixin
from twake_profile_editor import answers as answers_io
from twake_profile_editor.answers import Answers, AnswersError, FORMAT_VERSION
from twake_profile_editor.model import Application, Mode


def make(**overrides) -> Answers:
    base = dict(
        name="support",
        application=Application.MAIL,
        mode=Mode.DOMAIN,
        baseline="classpath://functional-admin-mail-baseline.json",
        language="fr",
        values={"users": True, "users.mailboxes": False},
    )
    base.update(overrides)
    return Answers(**base)


class AnswersTest(TempDirMixin, unittest.TestCase):
    def test_round_trips_through_json(self):
        original = make()
        assert Answers.from_json(original.to_json(), source="<mem>") == original



    def test_round_trips_through_a_file(self):
        original = make()
        path = self.tmp_path / "support.questions"
        answers_io.save(path, original)
        assert answers_io.load(path) == original



    def test_answers_are_written_sorted_for_reviewable_diffs(self):
        written = make(values={"zulu": True, "alpha": False}).to_json()
        assert list(written["answers"]) == ["alpha", "zulu"]



    def test_a_future_format_version_is_refused(self):
        path = self.tmp_path / "x.questions"
        path.write_text(json.dumps({**make().to_json(), "version": FORMAT_VERSION + 1}))
        with self.assertRaisesRegex(AnswersError, "unsupported format version"):
            answers_io.load(path)



    def test_a_non_boolean_answer_is_refused(self):
        raw = {**make().to_json(), "answers": {"users": "yes"}}
        with self.assertRaisesRegex(AnswersError, "expected true or false"):
            Answers.from_json(raw, source="<mem>")



    def test_an_unknown_application_is_refused(self):
        raw = {**make().to_json(), "application": "CHAT"}
        with self.assertRaisesRegex(AnswersError, "expected one of MAIL, CALENDAR"):
            Answers.from_json(raw, source="<mem>")



    def test_a_missing_name_is_refused(self):
        raw = {**make().to_json(), "name": ""}
        with self.assertRaisesRegex(AnswersError, "missing or empty"):
            Answers.from_json(raw, source="<mem>")



    def test_unreadable_json_is_reported_with_the_path(self):
        path = self.tmp_path / "broken.questions"
        path.write_text("{not json")
        with self.assertRaisesRegex(AnswersError, "not valid JSON"):
            answers_io.load(path)
