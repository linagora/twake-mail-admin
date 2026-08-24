"""The stdlib prompter: the parts that can be tested without a terminal.

Key handling and redrawing need a pseudo-terminal to exercise; what is covered
here is the logic that decides *what* to draw, which is where the bugs live.
"""

from __future__ import annotations

import unittest

from twake_profile_editor.prompt import Choice, PlainPrompter
from twake_profile_editor.terminal import (
    DEFAULT_HEIGHT,
    SYMBOLS,
    TerminalPrompter,
    _hint,
    _index_of,
    _summarise,
    _window,
    is_usable,
)

CHOICES = [Choice("a", "Alpha"), Choice("b", "Bravo"), Choice("c", "Charlie")]


class WindowTest(unittest.TestCase):
    """A list longer than the terminal has to scroll, keeping the cursor visible."""

    def test_a_short_list_is_shown_whole(self):
        lines = ["one", "two", "three"]
        assert _window(lines, 0, 10) == (lines, 0)

    def test_a_long_list_is_windowed_around_the_cursor(self):
        lines = [str(n) for n in range(20)]
        visible, offset = _window(lines, 10, 5)
        assert len(visible) == 5
        assert lines[10] in visible
        assert offset > 0

    def test_the_window_never_runs_past_either_end(self):
        lines = [str(n) for n in range(20)]
        for cursor in range(20):
            with self.subTest(cursor=cursor):
                visible, offset = _window(lines, cursor, 6)
                assert len(visible) == 6
                assert 0 <= offset <= len(lines) - 6
                assert lines[cursor] in visible


class DefaultsTest(unittest.TestCase):
    def test_the_default_choice_is_where_the_cursor_starts(self):
        assert _index_of(CHOICES, "b") == 1

    def test_an_unknown_default_starts_at_the_top(self):
        assert _index_of(CHOICES, "zzz") == 0
        assert _index_of(CHOICES, None) == 0


class SummaryTest(unittest.TestCase):
    """What is echoed into the scrollback once a question is answered."""

    def test_a_few_picks_are_named(self):
        assert _summarise(CHOICES, ["a", "c"], "en") == "Alpha, Charlie"

    def test_many_picks_are_counted(self):
        many = [Choice(str(n), f"Item {n}") for n in range(8)]
        assert _summarise(many, [str(n) for n in range(8)], "en") == "8 selected"

    def test_picking_nothing_says_so_rather_than_showing_an_empty_line(self):
        assert _summarise(CHOICES, [], "en") == "nothing"
        assert _summarise(CHOICES, [], "fr") == "rien"


class HintTest(unittest.TestCase):
    def test_hints_exist_in_both_languages(self):
        for key in ("select", "checkbox", "none-picked", "n-picked"):
            with self.subTest(hint=key):
                assert _hint(key, "en")
                assert _hint(key, "fr")
                assert _hint(key, "fr") != _hint(key, "en")

    def test_an_unknown_language_falls_back_to_english(self):
        assert _hint("select", "de") == _hint("select", "en")


class SymbolsTest(unittest.TestCase):
    def test_the_symbols_are_ascii(self):
        """They land in logs and screenshots, not just in modern terminals."""
        for symbol in (SYMBOLS.pointer, SYMBOLS.checked, SYMBOLS.unchecked, SYMBOLS.question):
            with self.subTest(symbol=symbol):
                symbol.encode("ascii")


class SelectionTest(unittest.TestCase):
    """The rules the prompter applies when there is no terminal to drive."""

    def test_a_pipe_gets_the_plain_prompter(self):
        # The suite runs with stdout captured, so this is exactly that case.
        from twake_profile_editor.prompt import default_prompter

        assert not is_usable()
        assert isinstance(default_prompter("fr"), PlainPrompter)

    def test_the_terminal_prompter_refuses_to_start_without_a_terminal(self):
        from twake_profile_editor.prompt import PrompterError

        with self.assertRaisesRegex(PrompterError, "no terminal"):
            TerminalPrompter("en")

    def test_a_terminal_that_reports_no_height_is_assumed_ordinary(self):
        assert DEFAULT_HEIGHT >= 20
