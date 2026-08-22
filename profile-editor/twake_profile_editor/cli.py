"""Command line entry point."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import answers as answers_io
from .answers import Answers, AnswersError
from .check import check, render
from .generator import Generated, Scope, generate
from .i18n import t
from .interview import run as run_interview
from .inventory import INVENTORY
from .model import Application, Mode, missing_answers
from .profiles import ProfileError, find_profile, rules_from_allowed_urls
from .prompt import Choice, PrompterError, default_prompter

PROGRAM = "twake-profile-editor"


class UsageError(RuntimeError):
    """Something the user can fix by changing the command line or a file."""


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog=PROGRAM,
        description=(
            "Build a webadmin-proxy allowed.urls profile by answering questions "
            "about what an administrator should see and do."
        ),
    )
    parser.add_argument(
        "--name",
        help="name of the profile; drives <name>.json and <name>.questions",
    )
    parser.add_argument(
        "--fr", action="store_true", help="ask the questions in French"
    )

    action = parser.add_mutually_exclusive_group()
    action.add_argument(
        "--resume-from",
        metavar="FILE",
        type=Path,
        help="pre-fill every answer from a previous <name>.questions and walk them again",
    )
    action.add_argument(
        "--generate-from",
        metavar="FILE",
        type=Path,
        help="rebuild the profile from a <name>.questions without asking anything",
    )
    action.add_argument(
        "--check",
        metavar="FILE",
        type=Path,
        help="report, page by page, what an existing allowed.urls block makes visible",
    )

    parser.add_argument(
        "--application",
        choices=[member.value for member in Application],
        help="required by --check when it cannot be inferred",
    )
    parser.add_argument(
        "--mode",
        choices=[member.value for member in Mode],
        help="required by --check when it cannot be inferred",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=Path.cwd(),
        help="where <name>.json and <name>.questions are written (default: .)",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    lang = "fr" if args.fr else "en"
    try:
        if args.check:
            return _run_check(args, lang)
        if args.generate_from:
            return _run_generate_from(args, lang)
        return _run_interview(args, lang)
    except (UsageError, AnswersError, ProfileError) as exc:
        print(f"{PROGRAM}: {exc}", file=sys.stderr)
        return 1
    except PrompterError as exc:
        print(f"{PROGRAM}: {exc}", file=sys.stderr)
        return 1


# ---------------------------------------------------------------------------
# Interview and regeneration
# ---------------------------------------------------------------------------


def _run_interview(args, lang: str) -> int:
    prefill = answers_io.load(args.resume_from) if args.resume_from else None
    if prefill and not args.fr:
        lang = prefill.language

    result = run_interview(
        INVENTORY,
        default_prompter(),
        lang=lang,
        name=args.name or (prefill.name if prefill else None),
        prefill=prefill,
    )

    if prefill:
        recorded = len(prefill.values)
        print(t("out.prefilled", lang, count=recorded, path=args.resume_from), file=sys.stderr)
        if result.not_prefilled:
            print(
                t("out.not-prefilled", lang, count=len(result.not_prefilled)),
                file=sys.stderr,
            )

    return _emit(result.answers, lang, args.out_dir)


def _run_generate_from(args, lang: str) -> int:
    recorded = answers_io.load(args.generate_from)
    if not args.fr:
        lang = recorded.language
    if args.name:
        recorded.name = args.name

    scoped = INVENTORY.for_scope(recorded.application, recorded.mode)
    unanswered = missing_answers(scoped, recorded.values)
    if unanswered:
        # Nothing can be asked here, so the closed answer is the only safe one.
        print(
            t(
                "out.closed-fallback",
                lang,
                count=len(unanswered),
                path=args.generate_from,
            ),
            file=sys.stderr,
        )
        for node_id in unanswered:
            print(f"  {node_id}", file=sys.stderr)

    return _emit(recorded, lang, args.out_dir)


def _emit(recorded: Answers, lang: str, out_dir: Path) -> int:
    baseline = find_profile(recorded.baseline) if recorded.baseline else None
    scope = Scope(recorded.application, recorded.mode)
    generated = generate(INVENTORY, scope, recorded.values, baseline)

    print(
        t(
            "out.header",
            lang,
            name=recorded.name,
            application=recorded.application.value,
            mode=recorded.mode.value,
        ),
        file=sys.stderr,
    )
    print(json.dumps(generated.to_json(), indent=2, ensure_ascii=False))

    out_dir.mkdir(parents=True, exist_ok=True)
    json_path = out_dir / f"{recorded.name}.json"
    questions_path = out_dir / f"{recorded.name}.questions"
    json_path.write_text(
        json.dumps(generated.to_json(), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    answers_io.save(questions_path, recorded)

    count = len(generated.rules)
    key = "out.rules.one" if count == 1 else "out.rules.many"
    print(t(key, lang, count=count), file=sys.stderr)
    print(t("out.written", lang, path=json_path), file=sys.stderr)
    print(t("out.written", lang, path=questions_path), file=sys.stderr)
    _report_include(json_path, generated, recorded, lang)
    _report(generated, lang)
    return 0


def _report_include(json_path: Path, generated: Generated, recorded: Answers, lang: str) -> None:
    """Show how to wire the file up, and what could not go inside it."""
    print(file=sys.stderr)
    print(t("out.include-hint", lang), file=sys.stderr)
    print(
        "  " + json.dumps({"include": f"file://{json_path}"}, ensure_ascii=False),
        file=sys.stderr,
    )
    if not generated.restrictions:
        return
    print(file=sys.stderr)
    print(t("out.restrictions", lang, name=recorded.name), file=sys.stderr)
    snippet = json.dumps(
        {"url.patterns.restrictions": generated.restrictions}, indent=2, ensure_ascii=False
    )
    for line in snippet.splitlines():
        print(f"  {line}", file=sys.stderr)


def _report(generated: Generated, lang: str) -> None:
    if generated.corrections:
        print(f"\n{t('out.corrections', lang)}:", file=sys.stderr)
        for correction in generated.corrections:
            print(f"  {correction.node_id}: {correction.reason.get(lang)}", file=sys.stderr)
    if generated.warnings:
        print(f"\n{t('out.warnings', lang)}:", file=sys.stderr)
        for warning in generated.warnings:
            print(f"  {warning.get(lang)}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Check
# ---------------------------------------------------------------------------


def _run_check(args, lang: str) -> int:
    raw = _read_json(args.check)
    _warn_about_misspelled_verbs(raw, args.check)
    rules = rules_from_allowed_urls(raw, base_dir=args.check.resolve().parent)
    application, mode = _resolve_scope(args, lang)

    scoped = INVENTORY.for_scope(application, mode)
    print(
        t(
            "check.header",
            lang,
            path=args.check,
            application=application.value,
            mode=mode.value,
        )
    )
    print()
    print(render(check(scoped, rules), lang=lang))
    return 0


def _resolve_scope(args, lang: str) -> tuple[Application, Mode]:
    """Take the scope from the flags, from a sibling answer file, or ask."""
    application = Application(args.application) if args.application else None
    mode = Mode(args.mode) if args.mode else None

    sibling = args.check.with_suffix(".questions")
    if (application is None or mode is None) and sibling.exists():
        recorded = answers_io.load(sibling)
        application = application or recorded.application
        mode = mode or recorded.mode

    if application is not None and mode is not None:
        return application, mode

    if not sys.stdin.isatty():
        raise UsageError(
            "--check needs --application and --mode when they cannot be read from "
            f"{sibling.name} and there is no terminal to ask on"
        )

    prompter = default_prompter()
    if application is None:
        application = Application(
            prompter.select(
                t("ask.application", lang),
                [
                    Choice(Application.MAIL.value, t("app.mail", lang)),
                    Choice(Application.CALENDAR.value, t("app.calendar", lang)),
                ],
                default=Application.MAIL.value,
            )
        )
    if mode is None:
        mode = Mode(
            prompter.select(
                t("ask.mode", lang),
                [
                    Choice(Mode.GLOBAL.value, t("mode.global", lang)),
                    Choice(Mode.DOMAIN.value, t("mode.domain", lang)),
                ],
                default=Mode.GLOBAL.value,
            )
        )
    return application, mode


def _warn_about_misspelled_verbs(raw: object, path: Path) -> None:
    """`verbs` silently widens a rule to every verb; the proxy only reads `verb`."""
    entries = raw.get("allowed.urls", []) if isinstance(raw, dict) else raw
    if not isinstance(entries, list):
        return
    for entry in entries:
        if isinstance(entry, dict) and "verbs" in entry and "verb" not in entry:
            print(
                f"{PROGRAM}: {path}: rule {entry.get('endpoint')!r} spells the field "
                '"verbs"; the proxy reads only "verb", so this rule applies to every '
                "verb. Reported as the proxy will treat it.",
                file=sys.stderr,
            )


def _read_json(path: Path) -> object:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise UsageError(f"cannot read {path}: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise UsageError(f"{path} is not valid JSON: {exc}") from exc


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
