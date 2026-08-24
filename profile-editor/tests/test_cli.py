"""End-to-end behaviour of the command line, including the safety fallbacks."""

from __future__ import annotations

import io
import json
import unittest
from pathlib import Path
from unittest.mock import patch

from tests.support import ScriptedPrompter, TempDirMixin, captured
from twake_profile_editor import answers as answers_io
from twake_profile_editor.answers import Answers
from twake_profile_editor.cli import main
from twake_profile_editor.interview import ALL, NO_BASELINE
from twake_profile_editor.inventory import INVENTORY
from twake_profile_editor.model import Application, Mode


class CliTestCase(TempDirMixin, unittest.TestCase):
    """Shared plumbing: a temp workspace and a recorded interview to feed it."""

    def run_cli(self, argv: list[str]):
        """Run the CLI, returning (exit code, stdout, stderr)."""
        with captured() as output:
            code = main(argv)
        result = output[0]
        return code, result.out, result.err

    def record_domains_only(self) -> Path:
        """A complete answer set granting the Domains page and nothing else."""
        scoped = INVENTORY.for_scope(Application.MAIL, Mode.GLOBAL)
        values = {
            node.id: node.id == "domains" or node.id.startswith("domains.")
            for node in scoped.nodes
        }
        answers = Answers(
            name="support",
            application=Application.MAIL,
            mode=Mode.GLOBAL,
            baseline=None,
            language="en",
            values=values,
        )
        path = self.tmp_path / "support.questions"
        answers_io.save(path, answers)
        return path


class GenerateFromTest(CliTestCase):
    def test_writes_both_files_and_prints_the_block(self):
        recorded = self.record_domains_only()
        out_dir = self.tmp_path / "out"
        code, out, _ = self.run_cli(["--generate-from", str(recorded), "--out-dir", str(out_dir)])

        assert code == 0
        rules = json.loads(out)
        assert isinstance(rules, list), "the file must be includable as-is"
        assert any(rule["endpoint"] == "/domains" for rule in rules)
        assert (out_dir / "support.json").exists()
        assert (out_dir / "support.questions").exists()

    def test_is_reproducible(self):
        recorded = self.record_domains_only()
        _, first, _ = self.run_cli(
            ["--generate-from", str(recorded), "--out-dir", str(self.tmp_path / "a")]
        )
        _, second, _ = self.run_cli(
            ["--generate-from", str(recorded), "--out-dir", str(self.tmp_path / "b")]
        )
        assert first == second

    def test_needs_no_terminal(self):
        """No prompt may be reached: this has to work from cron."""
        recorded = self.record_domains_only()

        def refuse(lang="en"):
            raise AssertionError("--generate-from must not prompt")

        with patch("twake_profile_editor.cli.default_prompter", refuse):
            code, _, _ = self.run_cli(
                ["--generate-from", str(recorded), "--out-dir", str(self.tmp_path)]
            )
        assert code == 0

    def test_name_overrides_the_recorded_one(self):
        recorded = self.record_domains_only()
        self.run_cli(
            ["--generate-from", str(recorded), "--name", "renamed", "--out-dir", str(self.tmp_path)]
        )
        assert (self.tmp_path / "renamed.json").exists()
        assert (self.tmp_path / "renamed.questions").exists()

    def test_a_stale_answer_file_falls_back_closed_and_says_so(self):
        """A question added since the file was saved must never widen the profile."""
        recorded = self.record_domains_only()
        stale = answers_io.load(recorded)
        del stale.values["domains.aliases.add"]
        del stale.values["domains.quota"]
        answers_io.save(recorded, stale)

        code, out, err = self.run_cli(
            ["--generate-from", str(recorded), "--out-dir", str(self.tmp_path)]
        )
        assert code == 0
        assert "fell back to the closed answer" in err
        assert "domains.aliases.add" in err
        assert "domains.quota" in err

        rules = json.loads(out)
        endpoints = {rule["endpoint"] for rule in rules}
        assert "/quota/domains/{domain}" not in endpoints
        # The "delete alias" action still grants the same path, so only the verb
        # of the dropped "add alias" action may disappear.
        alias_verbs = {
            verb
            for rule in rules
            if rule["endpoint"] == "/domains/{domain}/aliases/{source}"
            for verb in rule["verb"]
        }
        assert alias_verbs == {"DELETE"}

    def test_a_broken_answer_file_fails_cleanly(self):
        path = self.tmp_path / "broken.questions"
        path.write_text("{")
        code, _, err = self.run_cli(["--generate-from", str(path)])
        assert code == 1
        assert "not valid JSON" in err

    def test_an_unknown_baseline_fails_cleanly(self):
        recorded = self.record_domains_only()
        stale = answers_io.load(recorded)
        stale.baseline = "classpath://does-not-exist.json"
        answers_io.save(recorded, stale)

        code, _, err = self.run_cli(
            ["--generate-from", str(recorded), "--out-dir", str(self.tmp_path)]
        )
        assert code == 1
        assert "unknown profile" in err

    def test_domain_mode_prints_the_restrictions_that_cannot_live_in_the_include(self):
        recorded = self.record_domains_only()
        answers = answers_io.load(recorded)
        answers.mode = Mode.DOMAIN
        answers_io.save(recorded, answers)

        code, _, err = self.run_cli(
            ["--generate-from", str(recorded), "--out-dir", str(self.tmp_path)]
        )
        assert code == 0
        assert "url.patterns.restrictions" in err
        assert "HAS_DOMAIN" in err
        assert '"include": "file://' in err


class CheckTest(CliTestCase):
    def generated_profile(self) -> Path:
        recorded = self.record_domains_only()
        self.run_cli(["--generate-from", str(recorded), "--out-dir", str(self.tmp_path)])
        return self.tmp_path / "support.json"

    def test_reads_the_scope_from_the_sibling_answer_file(self):
        profile = self.generated_profile()
        code, out, _ = self.run_cli(["--check", str(profile)])
        assert code == 0
        assert "MAIL, GLOBAL mode" in out
        assert "+ Domains [visible]" in out
        assert "- Users [hidden]" in out

    def test_accepts_explicit_scope_flags(self):
        profile = self.generated_profile()
        (self.tmp_path / "support.questions").unlink()
        code, out, _ = self.run_cli(
            ["--check", str(profile), "--application", "MAIL", "--mode", "GLOBAL"]
        )
        assert code == 0
        assert "+ Domains [visible]" in out

    def test_without_a_scope_and_without_a_terminal_fails_cleanly(self):
        profile = self.generated_profile()
        (self.tmp_path / "support.questions").unlink()
        with patch("sys.stdin", io.StringIO()):  # StringIO.isatty() is False
            code, _, err = self.run_cli(["--check", str(profile)])
        assert code == 1
        assert "needs --application and --mode" in err

    def test_accepts_a_bare_rule_array(self):
        path = self.tmp_path / "rules.json"
        path.write_text(json.dumps([{"endpoint": "/healthcheck", "verb": ["GET"]}]))
        code, out, _ = self.run_cli(
            ["--check", str(path), "--application", "MAIL", "--mode", "GLOBAL"]
        )
        assert code == 0
        assert "+ Health check [visible]" in out

    def test_follows_include_directives(self):
        path = self.tmp_path / "rules.json"
        path.write_text(
            json.dumps(
                {"allowed.urls": [{"include": "classpath://functional-admin-mail-baseline.json"}]}
            )
        )
        code, out, _ = self.run_cli(
            ["--check", str(path), "--application", "MAIL", "--mode", "DOMAIN"]
        )
        assert code == 0
        assert "Users [visible]" in out

    def test_reports_a_malformed_profile_cleanly(self):
        path = self.tmp_path / "rules.json"
        path.write_text(json.dumps([{"nonsense": True}]))
        code, _, err = self.run_cli(
            ["--check", str(path), "--application", "MAIL", "--mode", "GLOBAL"]
        )
        assert code == 1
        assert "endpoint" in err

    def test_is_translated(self):
        profile = self.generated_profile()
        code, out, _ = self.run_cli(["--check", str(profile), "--fr"])
        assert code == 0
        assert "Domaines [visible]" in out

    def test_warns_about_the_verbs_misspelling(self):
        path = self.tmp_path / "rules.json"
        path.write_text(json.dumps([{"verbs": ["GET"], "endpoint": "/healthcheck"}]))
        code, out, err = self.run_cli(
            ["--check", str(path), "--application", "MAIL", "--mode", "GLOBAL"]
        )
        assert code == 0
        assert 'spells the field "verbs"' in err
        # Reported the way the proxy reads it: matching every verb, so it shows.
        assert "+ Health check [visible]" in out


class ArgumentHandlingTest(CliTestCase):
    def test_the_three_modes_are_mutually_exclusive(self):
        with self.assertRaises(SystemExit):
            with captured():
                main(["--check", "a.json", "--generate-from", "b.questions"])


class FullCycleTest(CliTestCase):
    def test_interview_then_resume_then_generate_all_agree(self):
        """Editing a profile must not perturb the parts that were not touched."""
        script = {
            "Which application": Application.MAIL.value,
            "Which mode": Mode.DOMAIN.value,
            "Reuse an existing": NO_BASELINE,
            "Which pages": ["users", "domains.quota"],
            "— what may be seen": ALL,
        }
        with patch(
            "twake_profile_editor.cli.default_prompter",
            lambda lang="en": ScriptedPrompter(script=dict(script)),
        ):
            code, _, _ = self.run_cli(["--name", "svc", "--out-dir", str(self.tmp_path)])
        assert code == 0
        interviewed = (self.tmp_path / "svc.json").read_text()

        # Resuming and accepting every suggested answer must change nothing: the
        # scripted prompter falls back to the offered default when a question has
        # no scripted answer, which is exactly "accept what was recorded".
        with patch(
            "twake_profile_editor.cli.default_prompter", lambda lang="en": ScriptedPrompter(script={})
        ):
            code, _, _ = self.run_cli(
                [
                    "--resume-from",
                    str(self.tmp_path / "svc.questions"),
                    "--out-dir",
                    str(self.tmp_path / "resumed"),
                ]
            )
        assert code == 0
        assert (self.tmp_path / "resumed" / "svc.json").read_text() == interviewed

        code, _, _ = self.run_cli(
            [
                "--generate-from",
                str(self.tmp_path / "svc.questions"),
                "--out-dir",
                str(self.tmp_path / "regenerated"),
            ]
        )
        assert code == 0
        assert (self.tmp_path / "regenerated" / "svc.json").read_text() == interviewed

        code, out, _ = self.run_cli(["--check", str(self.tmp_path / "svc.json")])
        assert code == 0
        assert "+ Users [visible]" in out
        assert "+ Quota tab [visible]" in out
        assert "- Mailing lists [hidden]" in out

    def test_the_generated_file_can_be_included_and_checked_back(self):
        """The round trip that matters: generate, include, check the include."""
        scoped = INVENTORY.for_scope(Application.MAIL, Mode.DOMAIN)
        values = {node.id: node.id.startswith("users") for node in scoped.nodes}
        answers = Answers(
            name="svc",
            application=Application.MAIL,
            mode=Mode.DOMAIN,
            language="en",
            values=values,
        )
        questions = self.tmp_path / "svc.questions"
        answers_io.save(questions, answers)
        code, _, _ = self.run_cli(
            ["--generate-from", str(questions), "--out-dir", str(self.tmp_path)]
        )
        assert code == 0

        generated = json.loads((self.tmp_path / "svc.json").read_text())
        assert isinstance(generated, list)

        client_entry = self.tmp_path / "client.json"
        client_entry.write_text(
            json.dumps(
                {"allowed.urls": [{"include": f"file://{self.tmp_path / 'svc.json'}"}]}
            )
        )
        code, out, _ = self.run_cli(
            ["--check", str(client_entry), "--application", "MAIL", "--mode", "DOMAIN"]
        )
        assert code == 0
        assert "+ Users [visible]" in out
