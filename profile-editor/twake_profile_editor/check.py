"""``--check``: read an existing profile and say what it makes visible.

This is the interview run backwards. Rather than asking what should be allowed,
it takes an ``allowed.urls`` block and walks the same tree, reporting page by
page and action by action what an administrator holding this profile would see.

Visibility is decided by the ported frontend resolver, so the answer is the one
the real UI will give.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, Sequence

from .i18n import t
from .model import Endpoint, Inventory, Kind, Node, Requirement
from .resolver import Resolver, Rule


@dataclass
class ComponentStatus:
    """What becomes of one node under a given profile."""

    node: Node
    available: bool
    reason_key: str
    missing: list[Endpoint] = field(default_factory=list)
    degraded: list[Endpoint] = field(default_factory=list)
    children: list["ComponentStatus"] = field(default_factory=list)

    @property
    def is_action(self) -> bool:
        return self.node.kind is Kind.ACTION

    def walk(self) -> Iterable["ComponentStatus"]:
        yield self
        for child in self.children:
            yield from child.walk()


def check(inventory: Inventory, rules: Sequence[Rule]) -> list[ComponentStatus]:
    """Evaluate every node of an already-scoped inventory against ``rules``."""
    resolver = Resolver(tuple(rules))
    return [_evaluate(page, resolver, parent_available=True) for page in inventory.pages]


def _evaluate(node: Node, resolver: Resolver, *, parent_available: bool) -> ComponentStatus:
    # An endpoint is satisfied only when the call itself *and* every gate the
    # frontend checks for it are allowed: the gate renders the control, the call
    # makes pressing it work.
    missing = [
        e
        for e in node.endpoints
        if not all(resolver.is_allowed(verb, pattern) for verb, pattern in e.keys)
    ]
    missing_must = [e for e in missing if e.requirement is Requirement.MUST]
    degraded = [e for e in missing if e.requirement is Requirement.MAY]

    own_gate_open = not missing_must
    if node.kind is Kind.ACTION:
        # An action is all-or-nothing: every call it makes must go through.
        own_gate_open = not missing

    children = [
        _evaluate(child, resolver, parent_available=parent_available and own_gate_open)
        for child in node.children
    ]

    if not parent_available:
        return ComponentStatus(
            node=node,
            available=False,
            reason_key="check.parent-hidden",
            missing=missing_must,
            degraded=degraded,
            children=children,
        )

    if node.derives_visibility:
        available = any(child.available for child in children)
        return ComponentStatus(
            node=node,
            available=available,
            reason_key="check.derived" if available else "check.derived-hidden",
            missing=missing_must,
            degraded=degraded,
            children=children,
        )

    reason_key = _reason_key(node, own_gate_open)
    return ComponentStatus(
        node=node,
        available=own_gate_open,
        reason_key=reason_key,
        missing=missing if node.kind is Kind.ACTION else missing_must,
        degraded=degraded,
        children=children,
    )


def _reason_key(node: Node, available: bool) -> str:
    if node.kind is Kind.ACTION:
        return "check.allowed" if available else "check.forbidden"
    return "check.visible" if available else "check.hidden"


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------

MARK_OK = "+"
MARK_KO = "-"


def render(statuses: Sequence[ComponentStatus], lang: str = "en") -> str:
    lines: list[str] = []
    for status in statuses:
        _render_node(status, lang, depth=0, lines=lines)
        lines.append("")
    lines.append(_summary(statuses, lang))
    return "\n".join(lines)


def _render_node(
    status: ComponentStatus, lang: str, *, depth: int, lines: list[str]
) -> None:
    indent = "  " * depth
    mark = MARK_OK if status.available else MARK_KO
    label = status.node.label.get(lang)
    lines.append(f"{indent}{mark} {label} [{t(status.reason_key, lang)}]")

    detail_indent = indent + "    "
    for endpoint in status.missing:
        lines.append(
            f"{detail_indent}{t('check.missing', lang)}: {endpoint.verb} {endpoint.pattern}"
        )
    if status.available:
        for endpoint in status.degraded:
            lines.append(
                f"{detail_indent}{t('check.missing', lang)}: "
                f"{endpoint.verb} {endpoint.pattern}"
            )
    if status.node.note:
        lines.append(f"{detail_indent}note: {status.node.note}")

    # A hidden container's children are all unreachable; saying so once is enough.
    if not status.available and status.node.kind is not Kind.ACTION:
        return
    for child in status.children:
        _render_node(child, lang, depth=depth + 1, lines=lines)


def _summary(statuses: Sequence[ComponentStatus], lang: str) -> str:
    pages = list(statuses)
    actions = [s for status in statuses for s in status.walk() if s.is_action]
    return t(
        "check.summary",
        lang,
        visible=sum(1 for s in pages if s.available),
        total=len(pages),
        actions=sum(1 for s in actions if s.available),
        total_actions=len(actions),
    )
