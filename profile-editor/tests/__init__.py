"""Test package.

Written against the standard library's ``unittest`` so the suite runs with a
bare ``python3`` and nothing installed — the CI agent has neither pip nor
ensurepip. ``pytest`` collects ``unittest.TestCase`` classes natively, so
``python -m pytest`` still works locally and gives the nicer output.
"""
