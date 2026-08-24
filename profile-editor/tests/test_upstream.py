"""The Python port must not drift away from the TypeScript it mirrors.

Nothing here is a copy of the frontend: the resolver and ``validation.md`` are
read from their real place in this repository. What the checksums buy is a
reminder — edit ``proxy-resolver.ts`` and this fails, which is the moment to
re-read ``resolver.py`` rather than discover the divergence in production.

Only the two resolver files are pinned, and deliberately so. The vendored
webadmin-proxy profiles are runtime *data*: no Python here mirrors their
contents, so an updated baseline should simply be used, not turned into a build
failure. Whether their content still behaves is covered by ``test_generator.py``
and ``test_check.py``, which resolve the real rules.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

import unittest

from twake_profile_editor import repo


def recorded_checksums() -> dict[str, str]:
    entries = {}
    for line in repo.CHECKSUMS.read_text(encoding="utf-8").splitlines():
        digest, _, name = line.partition("  ")
        if name:
            entries[name] = digest
    return entries


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()



class UpstreamTest(unittest.TestCase):
    def test_the_repository_layout_is_the_one_this_project_expects(self):
        assert repo.is_available()
        assert repo.RESOLVER_TS.is_file()
        assert repo.RESOLVER_TEST_TS.is_file()



    def test_exactly_the_mirrored_sources_are_checksummed(self):
        """Pin what the port mirrors, and nothing else.

        Adding a data file here would make an upstream update fail the build
        instead of simply being picked up.
        """
        assert set(recorded_checksums()) == {
            "src/lib/proxy-resolver.ts",
            "src/lib/proxy-resolver.test.ts",
        }



    def test_the_vendored_profiles_are_left_free_to_move(self):
        """A baseline updated upstream must not need a checksum refresh."""
        recorded = set(recorded_checksums())
        assert not any("profiles/" in name for name in recorded)

    def test_the_checksummed_files_have_not_moved(self):
        for name, digest in sorted(recorded_checksums().items()):
            with self.subTest(file=name):
                path = repo.REPO_ROOT / name
                assert path.is_file(), f"{name} is checksummed but missing"
                assert sha256(path) == digest, (
                    f"{name} changed. Re-read twake_profile_editor/resolver.py "
                    f"and the inventory against it, then refresh "
                    f"checksums.sha256 — see UPSTREAM.md."
                )
