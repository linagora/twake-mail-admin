"""Prompt back-ends.

The interview is written against :class:`Prompter`, so it can run over a real
terminal, over plain stdin when there is none, or over a scripted stub in tests.
None of the interview logic knows which.

The terminal implementation lives in :mod:`twake_profile_editor.terminal` and uses
nothing but the standard library, so arrow keys and checkboxes are available
wherever python is -- no install, no virtualenv, no pip.
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
# plain stdin
# ---------------------------------------------------------------------------


class PlainPrompter:
    """Fallback for a pipe, a log, or a platform without ``termios``.

    Deliberately terse: it exists so the tool still runs unattended, not so the
    interview is pleasant. On a real terminal you get the other one.
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


def default_prompter(lang: str = "en") -> Prompter:
    """The real thing on a terminal, numbered prompts when piped.

    Imported here rather than at module scope: ``terminal`` imports this module
    for :class:`Choice`, and it is the only platform-dependent part of the tool.
    """
    from .terminal import TerminalPrompter, is_usable

    return TerminalPrompter(lang) if is_usable() else PlainPrompter()
