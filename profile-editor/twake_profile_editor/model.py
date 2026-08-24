"""The permission model: application/mode/page/section/action tree.

This is the heart of the tool. The interview, the generator and ``--check`` are
all views over the tree defined in :mod:`twake_profile_editor.inventory`.

Two rules give the tree its meaning:

* **MUST** endpoints gate the node itself — forbid one and the component is not
  rendered at all.
* **MAY** endpoints degrade gracefully — forbid one and only that button goes away.

Nodes nest, and visibility is transitive: a hidden page hides every section and
action underneath it, whatever the answers say. :func:`close_downwards` enforces
that on any answer set, including hand-edited ones.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from enum import Enum
from typing import Iterator, Mapping, Sequence


class Application(str, Enum):
    MAIL = "MAIL"
    CALENDAR = "CALENDAR"


class Mode(str, Enum):
    GLOBAL = "GLOBAL"
    DOMAIN = "DOMAIN"


class Requirement(str, Enum):
    MUST = "MUST"
    MAY = "MAY"


class Kind(str, Enum):
    PAGE = "PAGE"
    SECTION = "SECTION"
    ACTION = "ACTION"


ALL_APPLICATIONS = frozenset(Application)
ALL_MODES = frozenset(Mode)


@dataclass(frozen=True)
class Label:
    """A user-facing string in every supported language."""

    en: str
    fr: str

    def get(self, lang: str) -> str:
        return self.fr if lang == "fr" else self.en


@dataclass(frozen=True)
class Endpoint:
    """One API call a component makes, as declared in validation.md.

    ``gates`` holds the patterns the frontend actually passes to ``useIsAllowed``
    when they differ from the pattern of the call itself -- most often because the
    component asks about the bare path while the call carries a query string.
    Both must be granted: the gate decides whether the control is rendered, the
    pattern decides whether pressing it succeeds.
    """

    verb: str
    pattern: str
    requirement: Requirement
    applications: frozenset[Application] = ALL_APPLICATIONS
    modes: frozenset[Mode] = ALL_MODES
    gates: tuple[str, ...] = ()
    note: str = ""

    def applies_to(self, application: Application, mode: Mode) -> bool:
        return application in self.applications and mode in self.modes

    @property
    def key(self) -> tuple[str, str]:
        return (self.verb, self.pattern)

    @property
    def keys(self) -> tuple[tuple[str, str], ...]:
        """Every (verb, pattern) a profile must grant for this call to work."""
        return ((self.verb, self.pattern), *((self.verb, gate) for gate in self.gates))


@dataclass(frozen=True)
class Node:
    """A page, a section within a page, or an action inside either."""

    id: str
    kind: Kind
    label: Label
    endpoints: tuple[Endpoint, ...] = ()
    children: tuple["Node", ...] = ()
    applications: frozenset[Application] = ALL_APPLICATIONS
    modes: frozenset[Mode] = ALL_MODES
    help: Label | None = None
    note: str = ""

    # -- structure ---------------------------------------------------------

    def applies_to(self, application: Application, mode: Mode) -> bool:
        return application in self.applications and mode in self.modes

    @property
    def must_endpoints(self) -> tuple[Endpoint, ...]:
        return tuple(e for e in self.endpoints if e.requirement is Requirement.MUST)

    @property
    def derives_visibility(self) -> bool:
        """True when the node has no gate of its own.

        validation.md has a handful of these ("if none are present hide the
        deleted message vault", "if both are missing hide the page"): the
        container shows up only because at least one of its actions is allowed.
        """
        return not self.must_endpoints and bool(self.children)

    def walk(self) -> Iterator["Node"]:
        yield self
        for child in self.children:
            yield from child.walk()


@dataclass(frozen=True, eq=False)
class Inventory:
    """The full tree, plus the flat index used to resolve answers by id.

    DOMAIN mode is not GLOBAL mode minus a few pages: the frontend ships a
    separate left bar there, promoting what are tabs of a domain in GLOBAL mode
    to top-level entries. ``domain_pages`` names those entries, by id, per
    application. Ids are unchanged across modes, so a ``.questions`` file stays
    meaningful if the mode is switched.
    """

    pages: tuple[Node, ...]
    domain_pages: Mapping[Application, tuple[str, ...]] = field(default_factory=dict)

    @property
    def nodes(self) -> tuple[Node, ...]:
        return tuple(node for page in self.pages for node in page.walk())

    @property
    def index(self) -> Mapping[str, Node]:
        return {node.id: node for node in self.nodes}

    @property
    def parents(self) -> Mapping[str, str | None]:
        out: dict[str, str | None] = {}
        for page in self.pages:
            out[page.id] = None
            _record_parents(page, out)
        return out

    def endpoints(self) -> Iterator[Endpoint]:
        for node in self.nodes:
            yield from node.endpoints

    def for_scope(self, application: Application, mode: Mode) -> "Inventory":
        """Prune everything that does not exist for this application and mode.

        The result is already scoped: it carries no ``domain_pages`` of its own.
        """
        index = self.index
        if mode is Mode.DOMAIN and self.domain_pages:
            roots = [index[node_id] for node_id in self.domain_pages.get(application, ())]
        else:
            roots = list(self.pages)
        pages = tuple(
            pruned
            for root in roots
            if (pruned := _prune(root, application, mode)) is not None
        )
        return Inventory(pages=pages)


def _record_parents(node: Node, out: dict[str, str | None]) -> None:
    for child in node.children:
        out[child.id] = node.id
        _record_parents(child, out)


def _prune(node: Node, application: Application, mode: Mode) -> Node | None:
    if not node.applies_to(application, mode):
        return None
    endpoints = tuple(e for e in node.endpoints if e.applies_to(application, mode))
    children = tuple(
        pruned
        for child in node.children
        if (pruned := _prune(child, application, mode)) is not None
    )
    if not endpoints and not children:
        return None
    return replace(node, endpoints=endpoints, children=children)


# ---------------------------------------------------------------------------
# Construction helpers — used by inventory.py to keep the data readable
# ---------------------------------------------------------------------------


def must(verb: str, pattern: str, **kwargs) -> Endpoint:
    return Endpoint(verb=verb, pattern=pattern, requirement=Requirement.MUST, **kwargs)


def may(verb: str, pattern: str, **kwargs) -> Endpoint:
    return Endpoint(verb=verb, pattern=pattern, requirement=Requirement.MAY, **kwargs)


def node(
    kind: Kind,
    id: str,
    en: str,
    fr: str,
    *,
    endpoints: Sequence[Endpoint] = (),
    children: Sequence[Node] = (),
    applications: frozenset[Application] = ALL_APPLICATIONS,
    modes: frozenset[Mode] = ALL_MODES,
    help: Label | None = None,
    note: str = "",
) -> Node:
    """Build a node, rewriting child ids so they are prefixed by this one."""
    return Node(
        id=id,
        kind=kind,
        label=Label(en, fr),
        endpoints=tuple(endpoints),
        children=tuple(_prefix(child, id) for child in children),
        applications=applications,
        modes=modes,
        help=help,
        note=note,
    )


def page(id: str, en: str, fr: str, **kwargs) -> Node:
    return node(Kind.PAGE, id, en, fr, **kwargs)


def section(id: str, en: str, fr: str, **kwargs) -> Node:
    return node(Kind.SECTION, id, en, fr, **kwargs)


def action(id: str, en: str, fr: str, **kwargs) -> Node:
    return node(Kind.ACTION, id, en, fr, **kwargs)


def _prefix(node: Node, parent_id: str) -> Node:
    """Prepend ``parent_id.`` to every id in a subtree.

    The subtree was built by its own constructor call, so its ids are already
    rooted at the child's own local id -- ``aliases`` and ``aliases.add``. The
    prefix is therefore prepended uniformly rather than recomputed at each level,
    which would produce ``domains.aliases.aliases.add``.
    """
    return replace(
        node,
        id=f"{parent_id}.{node.id}",
        children=tuple(_prefix(child, parent_id) for child in node.children),
    )


# ---------------------------------------------------------------------------
# Answer coherence
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Correction:
    """One answer the closure had to overrule, reported to the user."""

    node_id: str
    reason: Label


def close_downwards(
    inventory: Inventory, answers: Mapping[str, bool]
) -> tuple[dict[str, bool], list[Correction]]:
    """Force every descendant of a disabled node to disabled.

    Answers come from a checkbox interview (which cannot break the invariant) or
    from a hand-edited ``.questions`` file (which can). Rather than emitting an
    incoherent profile -- an action allowed on a page the user cannot open --
    the offending answers are flipped off and reported.
    """
    resolved: dict[str, bool] = {}
    corrections: list[Correction] = []

    def visit(current: Node, parent_enabled: bool, parent_id: str | None) -> None:
        asked = answers.get(current.id, False)
        if not parent_enabled and asked:
            corrections.append(
                Correction(
                    node_id=current.id,
                    reason=Label(
                        en=f"disabled: its parent {parent_id} is not granted",
                        fr=f"désactivé : son parent {parent_id} n'est pas accordé",
                    ),
                )
            )
        enabled = asked and parent_enabled
        resolved[current.id] = enabled
        for child in current.children:
            visit(child, enabled, current.id)

    for page_node in inventory.pages:
        visit(page_node, True, None)

    return resolved, corrections


def missing_answers(inventory: Inventory, answers: Mapping[str, bool]) -> list[str]:
    """Ids the tree asks about that the answer set says nothing on."""
    return [node.id for node in inventory.nodes if node.id not in answers]
