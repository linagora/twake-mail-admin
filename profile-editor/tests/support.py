"""Test doubles and the few helpers that replace pytest's fixtures."""

from __future__ import annotations

import io
import tempfile
from contextlib import contextmanager, redirect_stderr, redirect_stdout
from dataclasses import dataclass, field
from pathlib import Path
from typing import Sequence

from twake_profile_editor.prompt import Choice, PrompterError


@dataclass
class ScriptedPrompter:
    """A prompter driven by a script, recording what it was asked.

    Answers are looked up by the question text so a test reads as a dialogue
    rather than as a list of positional answers, and so an unexpected question
    fails loudly instead of silently consuming someone else's answer. A question
    with no scripted answer falls back to the offered default, which is how
    "accept everything the previous run recorded" is expressed.
    """

    script: dict[str, object] = field(default_factory=dict)
    asked: list[str] = field(default_factory=list)

    def text(self, message: str, default: str = "") -> str:
        return str(self._answer(message, default))

    def select(
        self, message: str, choices: Sequence[Choice], default: str | None = None
    ) -> str:
        answer = self._answer(message, default)
        values = [choice.value for choice in choices]
        assert answer in values, f"{answer!r} is not offered for {message!r}: {values}"
        return str(answer)

    def checkbox(
        self,
        message: str,
        choices: Sequence[Choice],
        preselected: Sequence[str] = (),
    ) -> list[str]:
        answer = self._answer(message, list(preselected))
        values = {choice.value for choice in choices}
        unknown = set(answer) - values
        assert not unknown, f"{unknown} not offered for {message!r}"
        return list(answer)

    def _answer(self, message: str, default):
        self.asked.append(message)
        for pattern, answer in self.script.items():
            if pattern in message:
                return answer
        if default is None:
            raise PrompterError(f"no scripted answer for {message!r}")
        return default


@dataclass
class RecordingPrompter(ScriptedPrompter):
    """Also remembers what each checkbox offered as already ticked."""

    preselections: dict[str, list[str]] = field(default_factory=dict)

    def checkbox(
        self,
        message: str,
        choices: Sequence[Choice],
        preselected: Sequence[str] = (),
    ) -> list[str]:
        self.preselections[message] = list(preselected)
        return super().checkbox(message, choices, preselected)


@dataclass(frozen=True)
class Output:
    """What a command wrote, once it has finished writing it."""

    out: str
    err: str


@contextmanager
def captured():
    """Collect stdout and stderr, in place of pytest's ``capsys``.

    Yields a one-element list; the :class:`Output` lands in it on exit, so the
    assertions read the finished text rather than a stream mid-write.
    """
    holder: list[Output] = []
    out, err = io.StringIO(), io.StringIO()
    with redirect_stdout(out), redirect_stderr(err):
        yield holder
    holder.append(Output(out=out.getvalue(), err=err.getvalue()))


class TempDirMixin:
    """A throwaway directory per test, in place of pytest's ``tmp_path``."""

    def setUp(self) -> None:
        super().setUp()
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.tmp_path = Path(directory.name)
