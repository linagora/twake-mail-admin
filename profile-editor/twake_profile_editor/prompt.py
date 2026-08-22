"""Prompt back-ends.

The interview is written against :class:`Prompter`, so it can run over
questionary in a terminal, over plain stdin when there is none, or over a
scripted stub in tests. None of the interview logic knows which.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, Sequence


@dataclass(frozen=True)
class Choice:
    """One option, carrying the value the interview cares about."""

    value: str
    label: str


class Prompter(Protocol):
    def text(self, message: str, default: str = "") -> str: ...

    def select(
        self, message: str, choices: Sequence[Choice], default: str | None = None
    ) -> str: ...

    def checkbox(
        self,
        message: str,
        choices: Sequence[Choice],
        preselected: Sequence[str] = (),
    ) -> list[str]: ...


class PrompterError(RuntimeError):
    """The user cannot be asked (no terminal, or input ran out)."""


# ---------------------------------------------------------------------------
# questionary
# ---------------------------------------------------------------------------


class QuestionaryPrompter:
    """Arrow keys, checkboxes and defaults -- the interview this tool is built for."""

    def __init__(self) -> None:
        import questionary  # imported lazily so the package stays optional

        self._q = questionary

    def text(self, message: str, default: str = "") -> str:
        return self._answer(self._q.text(message, default=default))

    def select(
        self, message: str, choices: Sequence[Choice], default: str | None = None
    ) -> str:
        options = [self._q.Choice(title=c.label, value=c.value) for c in choices]
        return self._answer(
            self._q.select(message, choices=options, default=_default_of(choices, default))
        )

    def checkbox(
        self,
        message: str,
        choices: Sequence[Choice],
        preselected: Sequence[str] = (),
    ) -> list[str]:
        chosen = set(preselected)
        options = [
            self._q.Choice(title=c.label, value=c.value, checked=c.value in chosen)
            for c in choices
        ]
        return self._answer(self._q.checkbox(message, choices=options))

    @staticmethod
    def _answer(question):
        answer = question.ask()
        if answer is None:  # Ctrl-C / Ctrl-D
            raise PrompterError("interview interrupted")
        return answer


def _default_of(choices: Sequence[Choice], default: str | None):
    """questionary matches its default against the Choice value."""
    if default is None:
        return None
    for choice in choices:
        if choice.value == default:
            return choice.value
    return None


# ---------------------------------------------------------------------------
# plain stdin
# ---------------------------------------------------------------------------


class PlainPrompter:
    """Fallback for a pipe or a terminal questionary cannot drive.

    Deliberately terse: it exists so the tool still runs, not so the interview is
    pleasant. Install questionary for that.
    """

    def __init__(self, stream=None, output=None) -> None:
        import sys

        self._in = stream or sys.stdin
        self._out = output or sys.stderr

    def text(self, message: str, default: str = "") -> str:
        suffix = f" [{default}]" if default else ""
        answer = self._read(f"{message}{suffix}: ")
        return answer or default

    def select(
        self, message: str, choices: Sequence[Choice], default: str | None = None
    ) -> str:
        self._write(f"\n{message}\n")
        for index, choice in enumerate(choices, start=1):
            marker = "*" if choice.value == default else " "
            self._write(f" {marker}{index}. {choice.label}\n")
        while True:
            raw = self._read("Number: ")
            if not raw and default is not None:
                return default
            if raw.isdigit() and 1 <= int(raw) <= len(choices):
                return choices[int(raw) - 1].value
            self._write("Please enter one of the listed numbers.\n")

    def checkbox(
        self,
        message: str,
        choices: Sequence[Choice],
        preselected: Sequence[str] = (),
    ) -> list[str]:
        chosen = set(preselected)
        self._write(f"\n{message}\n")
        for index, choice in enumerate(choices, start=1):
            marker = "x" if choice.value in chosen else " "
            self._write(f" [{marker}] {index}. {choice.label}\n")
        self._write("Numbers to select, comma separated. Empty keeps the marked ones.\n")
        while True:
            raw = self._read("Numbers: ").strip()
            if not raw:
                return [c.value for c in choices if c.value in chosen]
            try:
                picked = [int(part) for part in raw.replace(" ", "").split(",") if part]
            except ValueError:
                self._write("Please enter numbers separated by commas.\n")
                continue
            if all(1 <= number <= len(choices) for number in picked):
                return [choices[number - 1].value for number in picked]
            self._write("Please enter numbers from the list.\n")

    def _read(self, prompt: str) -> str:
        self._write(prompt)
        line = self._in.readline()
        if line == "":
            raise PrompterError("input ended before the interview finished")
        return line.strip()

    def _write(self, text: str) -> None:
        self._out.write(text)
        self._out.flush()


def default_prompter() -> Prompter:
    """questionary when it can drive the terminal, plain stdin otherwise."""
    import sys

    if sys.stdin.isatty() and sys.stdout.isatty():
        try:
            return QuestionaryPrompter()
        except ImportError:
            pass
    return PlainPrompter()
