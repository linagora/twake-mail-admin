"""Locating the frontend sources this tool is derived from.

The generator lives in the same repository as the frontend it describes, which
is the whole point: ``validation.md``, the resolver and the permission gates are
read from their real location, never from a copy that could quietly fall behind.

Only the webadmin-proxy baseline profiles come from another repository, and those
are the one thing still vendored.
"""

from __future__ import annotations

import re
from pathlib import Path

PACKAGE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = PACKAGE_DIR.parent
REPO_ROOT = PROJECT_DIR.parent

VALIDATION_MD = REPO_ROOT / "validation.md"
FRONTEND_SRC = REPO_ROOT / "src"
RESOLVER_TS = FRONTEND_SRC / "lib" / "proxy-resolver.ts"
RESOLVER_TEST_TS = FRONTEND_SRC / "lib" / "proxy-resolver.test.ts"

CHECKSUMS = PROJECT_DIR / "checksums.sha256"

#: A ``useIsAllowed("VERB", "/pattern")`` call with both arguments literal. Call
#: sites that build their arguments at runtime cannot be read statically and are
#: counted separately.
_GATE_CALL = re.compile(
    r"""useIsAllowed\(\s*["']([A-Z]+)["']\s*,\s*["']([^"']*)["']\s*\)"""
)
_ANY_CALL = re.compile(r"useIsAllowed\(")

#: The common-tasks panel keeps its gates in a table and feeds them to a single
#: ``useIsAllowed`` call, so the patterns live here rather than at the call site.
_ALLOWANCE_TABLE = re.compile(
    r"""allowanceCheck:\s*\{\s*verb:\s*["']([A-Z]+)["']\s*,"""
    r"""\s*pattern:\s*["']([^"']*)["']\s*\}"""
)


def is_available() -> bool:
    """False when the package was installed away from its repository."""
    return VALIDATION_MD.is_file() and FRONTEND_SRC.is_dir()


def frontend_permission_gates() -> set[tuple[str, str]]:
    """Every ``(verb, pattern)`` the frontend statically asks the proxy about.

    Read from the sources rather than from a snapshot: a component that starts
    gating on a new pattern shows up here on the next test run.
    """
    gates: set[tuple[str, str]] = set()
    for path in _frontend_files():
        text = path.read_text(encoding="utf-8")
        for pattern in (_GATE_CALL, _ALLOWANCE_TABLE):
            for match in pattern.finditer(text):
                gates.add((match.group(1), match.group(2)))
    return gates


def dynamic_gate_call_sites() -> int:
    """Call sites whose arguments are computed, so they cannot be extracted."""
    total = 0
    for path in _frontend_files():
        text = path.read_text(encoding="utf-8")
        total += len(_ANY_CALL.findall(text)) - len(_GATE_CALL.findall(text))
    return total - (1 if _uses_allowance_table() else 0)


def _uses_allowance_table() -> bool:
    """The common-tasks table is fed to one call site, already accounted for."""
    return any(
        _ALLOWANCE_TABLE.search(path.read_text(encoding="utf-8"))
        for path in _frontend_files()
    )


def _frontend_files() -> list[Path]:
    return sorted(
        path
        for suffix in ("*.ts", "*.tsx")
        for path in FRONTEND_SRC.rglob(suffix)
    )
