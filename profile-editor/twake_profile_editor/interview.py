"""The interview.

Roughly two hundred endpoints hang off sixty-odd sections. Asking one yes/no
question per component would mean upwards of a hundred prompts, and nobody
finishes that. Three things keep it short:

* **Short-circuit** — refusing a page never asks about anything inside it.
* **All / nothing / detail** at every level — a whole subtree settles in one
  keystroke, and only "detail" descends.
* **Checkboxes** — twelve pages are ticked on one screen, not over twelve
  prompts.

Answers are recorded for every node, including the ones never shown, so that
``--generate-from`` and ``--check`` see a complete picture.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Sequence

from .answers import Answers
from .i18n import t
from .model import Application, Inventory, Mode, Node
from .profiles import profiles_for
from .prompt import Choice, Prompter

ALL = "__all__"
NONE = "__none__"
DETAIL = "__detail__"
NO_BASELINE = "__none__"


@dataclass
class InterviewResult:
    answers: Answers
    #: Ids the previous answer file said nothing about, in tree order.
    not_prefilled: list[str] = field(default_factory=list)


class _Prefill:
    """Previous answers, remembering which questions they did not cover."""

    def __init__(self, values: dict[str, bool] | None) -> None:
        self._values = values or {}
        self._unseen: list[str] = []

    def get(self, node_id: str) -> bool:
        if node_id in self._values:
            return self._values[node_id]
        if node_id not in self._unseen:
            self._unseen.append(node_id)
        return False

    @property
    def unseen(self) -> list[str]:
        return list(self._unseen)

    @property
    def empty(self) -> bool:
        return not self._values


def run(
    inventory: Inventory,
    prompter: Prompter,
    *,
    lang: str = "en",
    name: str | None = None,
    prefill: Answers | None = None,
) -> InterviewResult:
    previous = _Prefill(prefill.values if prefill else None)

    if name is None:
        name = prompter.text(t("ask.name", lang), default=prefill.name if prefill else "")

    application = Application(
        prompter.select(
            t("ask.application", lang),
            [
                Choice(Application.MAIL.value, t("app.mail", lang)),
                Choice(Application.CALENDAR.value, t("app.calendar", lang)),
            ],
            default=prefill.application.value if prefill else Application.MAIL.value,
        )
    )
    mode = Mode(
        prompter.select(
            t("ask.mode", lang),
            [
                Choice(Mode.GLOBAL.value, t("mode.global", lang)),
                Choice(Mode.DOMAIN.value, t("mode.domain", lang)),
            ],
            default=prefill.mode.value if prefill else Mode.GLOBAL.value,
        )
    )
    baseline = _ask_baseline(prompter, lang, application, prefill)

    scoped = inventory.for_scope(application, mode)
    values: dict[str, bool] = {}

    selected = prompter.checkbox(
        t("ask.pages", lang),
        [Choice(page.id, page.label.get(lang)) for page in scoped.pages],
        preselected=[page.id for page in scoped.pages if previous.get(page.id)],
    )
    for page in scoped.pages:
        if page.id in selected:
            values[page.id] = True
            _ask_subtree(page, prompter, lang, values, previous)
        else:
            _set_subtree(page, values, False)

    return InterviewResult(
        answers=Answers(
            name=name,
            application=application,
            mode=mode,
            baseline=baseline,
            language=lang,
            values=values,
        ),
        not_prefilled=[] if previous.empty else previous.unseen,
    )


def _ask_baseline(
    prompter: Prompter, lang: str, application: Application, prefill: Answers | None
) -> str | None:
    candidates = profiles_for(application)
    if not candidates:
        return None
    choices = [Choice(NO_BASELINE, t("choice.no-baseline", lang))]
    choices += [Choice(profile.uri, profile.label) for profile in candidates]
    chosen = prompter.select(
        t("ask.baseline", lang),
        choices,
        default=(prefill.baseline if prefill and prefill.baseline else NO_BASELINE),
    )
    return None if chosen == NO_BASELINE else chosen


def _ask_subtree(
    node: Node,
    prompter: Prompter,
    lang: str,
    values: dict[str, bool],
    previous: _Prefill,
) -> None:
    """Ask about everything inside an already-granted node."""
    if not node.children:
        return

    verdict = prompter.select(
        t("ask.subtree", lang, name=node.label.get(lang)),
        [
            Choice(ALL, t("choice.all", lang)),
            Choice(NONE, t("choice.none", lang)),
            Choice(DETAIL, t("choice.detail", lang)),
        ],
        default=_suggested_verdict(node, previous),
    )

    if verdict == ALL:
        for child in node.children:
            _set_subtree(child, values, True)
        return
    if verdict == NONE:
        for child in node.children:
            _set_subtree(child, values, False)
        return

    selected = prompter.checkbox(
        t("ask.children", lang, name=node.label.get(lang)),
        [Choice(child.id, child.label.get(lang)) for child in node.children],
        preselected=[child.id for child in node.children if previous.get(child.id)],
    )
    for child in node.children:
        if child.id in selected:
            values[child.id] = True
            _ask_subtree(child, prompter, lang, values, previous)
        else:
            _set_subtree(child, values, False)


def _suggested_verdict(node: Node, previous: _Prefill) -> str:
    """Offer the answer the previous interview implies, so resuming is one keystroke."""
    recorded = [previous.get(descendant.id) for descendant in _descendants(node)]
    if all(recorded):
        return ALL
    if not any(recorded):
        return NONE
    return DETAIL


def _descendants(node: Node) -> Sequence[Node]:
    return [descendant for descendant in node.walk() if descendant is not node]


def _set_subtree(node: Node, values: dict[str, bool], value: bool) -> None:
    for descendant in node.walk():
        values[descendant.id] = value
