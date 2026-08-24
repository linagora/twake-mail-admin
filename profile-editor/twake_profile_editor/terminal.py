"""An interactive prompter built on the standard library alone.

The interview is a hundred-odd questions; walking it through numbered prompts is
miserable. Arrow keys and checkboxes are therefore not a nice-to-have, and making
them depend on a package that the CI agent -- and any operator without ``pip`` --
cannot install would put the good experience out of reach exactly where it is
needed.

So it is written here: raw terminal mode via ``termios``, ANSI escapes for
redrawing. Roughly the subset of questionary this tool actually uses.

Falls back to :class:`~twake_profile_editor.prompt.PlainPrompter` when there is no
terminal to drive, or on a platform without ``termios`` (Windows).
"""

from __future__ import annotations

import os
import select
import sys
from dataclasses import dataclass
from typing import Sequence

from .prompt import Choice, PrompterError

try:  # pragma: no cover - platform dependent
    import termios
    import tty

    TERMIOS_AVAILABLE = True
except ImportError:  # pragma: no cover - Windows
    TERMIOS_AVAILABLE = False

# ANSI
HIDE_CURSOR = "\x1b[?25l"
SHOW_CURSOR = "\x1b[?25h"
CLEAR_LINE = "\x1b[2K"
UP = "\x1b[A"

# Keys, as this module names them
UP_KEY = "up"
DOWN_KEY = "down"
ENTER = "enter"
SPACE = "space"
INTERRUPT = "interrupt"
TOGGLE_ALL = "toggle-all"

#: Leave room for the question line and the hint line.
CHROME_LINES = 4


@dataclass(frozen=True)
class Symbols:
    """Kept ASCII: these land in terminals, logs and screenshots alike."""

    pointer: str = ">"
    checked: str = "[x]"
    unchecked: str = "[ ]"
    question: str = "?"


SYMBOLS = Symbols()


def is_usable() -> bool:
    return TERMIOS_AVAILABLE and sys.stdin.isatty() and sys.stdout.isatty()


class TerminalPrompter:
    """Arrow keys, space to tick, enter to confirm."""

    def __init__(self, lang: str = "en") -> None:
        if not is_usable():  # pragma: no cover - guarded by the caller
            raise PrompterError("no terminal to drive")
        self._lang = lang

    # -- public API ------------------------------------------------------

    def text(self, message: str, default: str = "") -> str:
        suffix = f" ({default})" if default else ""
        self._write(f"{SYMBOLS.question} {message}{suffix}: ")
        answer = sys.stdin.readline()
        if answer == "":
            raise PrompterError("input ended before the interview finished")
        return answer.strip() or default

    def select(
        self, message: str, choices: Sequence[Choice], default: str | None = None
    ) -> str:
        if not choices:
            raise PrompterError(f"nothing to choose from for {message!r}")
        cursor = _index_of(choices, default)

        def render() -> list[str]:
            return [
                f" {SYMBOLS.pointer if i == cursor else ' '} {choice.label}"
                for i, choice in enumerate(choices)
            ]

        with self._menu(message, _hint("select", self._lang)) as draw:
            while True:
                draw(render(), cursor)
                key = self._read_key()
                if key == UP_KEY:
                    cursor = (cursor - 1) % len(choices)
                elif key == DOWN_KEY:
                    cursor = (cursor + 1) % len(choices)
                elif key == ENTER:
                    self._answered(message, choices[cursor].label)
                    return choices[cursor].value
                elif key == INTERRUPT:
                    raise PrompterError("interview interrupted")

    def checkbox(
        self,
        message: str,
        choices: Sequence[Choice],
        preselected: Sequence[str] = (),
    ) -> list[str]:
        if not choices:
            return []
        ticked = {choice.value for choice in choices if choice.value in set(preselected)}
        cursor = 0

        def render() -> list[str]:
            lines = []
            for i, choice in enumerate(choices):
                mark = SYMBOLS.checked if choice.value in ticked else SYMBOLS.unchecked
                pointer = SYMBOLS.pointer if i == cursor else " "
                lines.append(f" {pointer} {mark} {choice.label}")
            return lines

        with self._menu(message, _hint("checkbox", self._lang)) as draw:
            while True:
                draw(render(), cursor)
                key = self._read_key()
                if key == UP_KEY:
                    cursor = (cursor - 1) % len(choices)
                elif key == DOWN_KEY:
                    cursor = (cursor + 1) % len(choices)
                elif key == SPACE:
                    value = choices[cursor].value
                    ticked.symmetric_difference_update({value})
                elif key == TOGGLE_ALL:
                    ticked = set() if len(ticked) == len(choices) else {
                        choice.value for choice in choices
                    }
                elif key == ENTER:
                    picked = [c.value for c in choices if c.value in ticked]
                    self._answered(message, _summarise(choices, picked, self._lang))
                    return picked
                elif key == INTERRUPT:
                    raise PrompterError("interview interrupted")

    # -- drawing ---------------------------------------------------------

    class _Menu:
        """Redraws a block of lines in place, and tidies up on the way out."""

        def __init__(self, prompter: "TerminalPrompter", header: str) -> None:
            self._prompter = prompter
            self._header = header
            self._drawn = 0

        def __enter__(self):
            self._prompter._write(HIDE_CURSOR + self._header)
            return self.draw

        def draw(self, lines: Sequence[str], cursor: int) -> None:
            visible, offset = _window(lines, cursor, _rows())
            self._erase()
            self._prompter._write("".join(f"\n{CLEAR_LINE}{line}" for line in visible))
            if offset:
                self._prompter._write(f"\n{CLEAR_LINE}   ...")
                self._drawn = len(visible) + 1
            else:
                self._drawn = len(visible)

        def _erase(self) -> None:
            if self._drawn:
                self._prompter._write(f"\r{CLEAR_LINE}" + (UP + CLEAR_LINE) * self._drawn)

        def __exit__(self, *exc) -> None:
            self._erase()
            self._prompter._write(f"\r{CLEAR_LINE}{SHOW_CURSOR}")

    def _menu(self, message: str, hint: str) -> "TerminalPrompter._Menu":
        return TerminalPrompter._Menu(self, f"{SYMBOLS.question} {message} {hint}")

    def _answered(self, message: str, answer: str) -> None:
        """Leave one line of scrollback per question, as a record of the run."""
        self._write(f"{SYMBOLS.question} {message} {answer}\n")

    def _write(self, text: str) -> None:
        sys.stdout.write(text)
        sys.stdout.flush()

    # -- input -----------------------------------------------------------

    def _read_key(self) -> str:
        fd = sys.stdin.fileno()
        saved = termios.tcgetattr(fd)
        try:
            tty.setcbreak(fd)
            char = os.read(fd, 1)
            if char == b"\x1b":
                # An escape sequence, or a lone Escape: only the former has more
                # bytes waiting, so a short poll tells the two apart.
                if select.select([fd], [], [], 0.05)[0]:
                    rest = os.read(fd, 2)
                    if rest in (b"[A", b"OA"):
                        return UP_KEY
                    if rest in (b"[B", b"OB"):
                        return DOWN_KEY
                return INTERRUPT
            if char in (b"\r", b"\n"):
                return ENTER
            if char == b" ":
                return SPACE
            if char in (b"\x03", b"\x04"):  # Ctrl-C, Ctrl-D
                return INTERRUPT
            if char in (b"a", b"A"):
                return TOGGLE_ALL
            if char in (b"k", b"K"):
                return UP_KEY
            if char in (b"j", b"J"):
                return DOWN_KEY
            return ""
        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, saved)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _index_of(choices: Sequence[Choice], default: str | None) -> int:
    for index, choice in enumerate(choices):
        if choice.value == default:
            return index
    return 0


DEFAULT_HEIGHT = 24


def _rows() -> int:
    """How many option lines fit, leaving room for the question and hint.

    A terminal that reports no height at all (some pseudo-terminals do) is
    assumed to be an ordinary one rather than a three-line window.
    """
    try:
        height = os.get_terminal_size().lines
    except OSError:  # pragma: no cover - no terminal size to be had
        height = 0
    if height <= 0:
        height = DEFAULT_HEIGHT
    return max(3, height - CHROME_LINES)


def _window(lines: Sequence[str], cursor: int, rows: int) -> tuple[Sequence[str], int]:
    """Scroll the list so the cursor stays visible on a short terminal."""
    if len(lines) <= rows:
        return lines, 0
    offset = min(max(0, cursor - rows // 2), len(lines) - rows)
    return lines[offset : offset + rows], offset


def _summarise(choices: Sequence[Choice], picked: Sequence[str], lang: str) -> str:
    if not picked:
        return _hint("none-picked", lang)
    labels = [choice.label for choice in choices if choice.value in set(picked)]
    if len(labels) <= 3:
        return ", ".join(labels)
    return _hint("n-picked", lang).format(count=len(labels))


HINTS = {
    "select": {
        "en": "(arrows, enter)",
        "fr": "(flèches, entrée)",
    },
    "checkbox": {
        "en": "(arrows, space to tick, a for all, enter)",
        "fr": "(flèches, espace pour cocher, a pour tout, entrée)",
    },
    "none-picked": {"en": "nothing", "fr": "rien"},
    "n-picked": {"en": "{count} selected", "fr": "{count} sélectionnés"},
}


def _hint(key: str, lang: str) -> str:
    entry = HINTS[key]
    return entry.get(lang, entry["en"])
