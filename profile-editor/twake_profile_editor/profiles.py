"""Access to the baseline profiles webadmin-proxy ships on its classpath.

The proxy resolves ``include`` directives itself at start-up; this module does
the same over vendored copies so the tool can reason about what a baseline
already grants -- both to carve deny rules out of it and to report on it.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from .model import Application
from .resolver import Rule

PROFILE_DIR = Path(__file__).parent / "profiles"

CLASSPATH_SCHEME = "classpath://"
FILE_SCHEME = "file://"

MAX_INCLUDE_DEPTH = 8


class ProfileError(RuntimeError):
    """A profile could not be read, parsed, or resolved."""


@dataclass(frozen=True)
class IncludeDirective:
    """A rule-list entry that expands to another profile.

    Expansion happens before evaluation, so the resolver never sees one of these:
    it is an emission concept only.
    """

    uri: str

    def to_json(self) -> dict:
        return {"include": self.uri}


@dataclass(frozen=True)
class Profile:
    """One reusable profile, identified by the URI a client entry would use."""

    uri: str
    label: str
    rules: tuple[Rule, ...]
    applications: frozenset[Application]

    @property
    def include_directive(self) -> dict:
        return {"include": self.uri}


def _application_of(name: str) -> frozenset[Application]:
    if "calendar" in name:
        return frozenset({Application.CALENDAR})
    if "mail" in name:
        return frozenset({Application.MAIL})
    return frozenset(Application)


def _label_of(name: str) -> str:
    return name.removesuffix(".json").replace("-", " ").capitalize()


def available_profiles() -> tuple[Profile, ...]:
    """Every vendored classpath profile, in a stable order."""
    profiles = []
    for path in sorted(PROFILE_DIR.glob("*.json")):
        profiles.append(
            Profile(
                uri=f"{CLASSPATH_SCHEME}{path.name}",
                label=_label_of(path.name),
                rules=tuple(load_rules(path)),
                applications=_application_of(path.name),
            )
        )
    return tuple(profiles)


def profiles_for(application: Application) -> tuple[Profile, ...]:
    return tuple(p for p in available_profiles() if application in p.applications)


def find_profile(uri: str) -> Profile:
    for profile in available_profiles():
        if profile.uri == uri:
            return profile
    known = ", ".join(p.uri for p in available_profiles())
    raise ProfileError(f"unknown profile {uri!r}; known profiles: {known}")


# ---------------------------------------------------------------------------
# Loading, with include resolution
# ---------------------------------------------------------------------------


def load_rules(path: Path) -> list[Rule]:
    """Read a rule list from disk and expand its include directives."""
    return _expand(_read_json_array(path), base_dir=path.parent, depth=0)


def rules_from_allowed_urls(raw: object, base_dir: Path | None = None) -> list[Rule]:
    """Accept either a bare rule array or a client-entry style wrapper."""
    if isinstance(raw, dict):
        if "allowed.urls" not in raw:
            raise ProfileError(
                'expected a JSON array of rules or an object holding "allowed.urls"'
            )
        raw = raw["allowed.urls"]
    if not isinstance(raw, list):
        raise ProfileError("expected a JSON array of rules")
    return _expand(raw, base_dir=base_dir or Path.cwd(), depth=0)


def _read_json_array(path: Path) -> list:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise ProfileError(f"cannot read {path}: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise ProfileError(f"{path} is not valid JSON: {exc}") from exc
    if not isinstance(raw, list):
        raise ProfileError(f"{path} must hold a JSON array of rules")
    return raw


def _expand(entries: Iterable[dict], *, base_dir: Path, depth: int) -> list[Rule]:
    if depth > MAX_INCLUDE_DEPTH:
        raise ProfileError("include directives are nested too deeply (cycle?)")

    rules: list[Rule] = []
    for entry in entries:
        if not isinstance(entry, dict):
            raise ProfileError(f"rule entries must be objects, got {entry!r}")
        if "include" in entry:
            target = _resolve_include(entry["include"], base_dir)
            rules.extend(
                _expand(
                    _read_json_array(target), base_dir=target.parent, depth=depth + 1
                )
            )
            continue
        if "endpoint" not in entry:
            raise ProfileError(f'rule entry has neither "endpoint" nor "include": {entry!r}')
        rules.append(Rule.from_json(entry))
    return rules


def _resolve_include(uri: object, base_dir: Path) -> Path:
    if not isinstance(uri, str):
        raise ProfileError(f"include target must be a string, got {uri!r}")
    if uri.startswith(CLASSPATH_SCHEME):
        return PROFILE_DIR / uri[len(CLASSPATH_SCHEME) :]
    if uri.startswith(FILE_SCHEME):
        rest = uri[len(FILE_SCHEME) :]
        # file:///absolute vs file://relative, as documented by the proxy
        return Path("/" + rest.lstrip("/")) if uri.startswith("file:///") else base_dir / rest
    raise ProfileError(f"unsupported include scheme in {uri!r}")
