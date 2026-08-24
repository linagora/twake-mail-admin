"""Reading and writing ``<name>.questions``.

The answer file, not the generated JSON, is the source of truth for a profile:
``--generate-from`` rebuilds ``<name>.json`` from it, so a profile can be
refreshed after the endpoint inventory changes without redoing the interview.

It is plain JSON despite the extension -- diffable, and editable by hand when
someone would rather flip three booleans than walk the questions again.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

from .model import Application, Mode

FORMAT_VERSION = 1


class AnswersError(RuntimeError):
    """The answer file is unusable."""


@dataclass
class Answers:
    """One recorded interview."""

    name: str
    application: Application
    mode: Mode
    baseline: str | None = None
    language: str = "en"
    values: dict[str, bool] = field(default_factory=dict)

    def to_json(self) -> dict:
        return {
            "version": FORMAT_VERSION,
            "name": self.name,
            "application": self.application.value,
            "mode": self.mode.value,
            "baseline": self.baseline,
            "language": self.language,
            # Sorted so that re-running the interview produces a reviewable diff.
            "answers": dict(sorted(self.values.items())),
        }

    @classmethod
    def from_json(cls, raw: object, *, source: str) -> "Answers":
        if not isinstance(raw, dict):
            raise AnswersError(f"{source}: expected a JSON object")

        version = raw.get("version")
        if version != FORMAT_VERSION:
            raise AnswersError(
                f"{source}: unsupported format version {version!r} "
                f"(this tool writes version {FORMAT_VERSION})"
            )

        answers = raw.get("answers")
        if not isinstance(answers, dict):
            raise AnswersError(f'{source}: "answers" must be an object')
        for key, value in answers.items():
            if not isinstance(value, bool):
                raise AnswersError(
                    f"{source}: answer {key!r} is {value!r}, expected true or false"
                )

        return cls(
            name=_require_str(raw, "name", source),
            application=_require_enum(raw, "application", Application, source),
            mode=_require_enum(raw, "mode", Mode, source),
            baseline=raw.get("baseline") or None,
            language=raw.get("language") or "en",
            values=dict(answers),
        )


def _require_str(raw: dict, key: str, source: str) -> str:
    value = raw.get(key)
    if not isinstance(value, str) or not value:
        raise AnswersError(f"{source}: missing or empty {key!r}")
    return value


def _require_enum(raw: dict, key: str, enum: type, source: str):
    value = raw.get(key)
    try:
        return enum(value)
    except ValueError:
        allowed = ", ".join(member.value for member in enum)
        raise AnswersError(
            f"{source}: {key!r} is {value!r}, expected one of {allowed}"
        ) from None


def load(path: Path) -> Answers:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise AnswersError(f"cannot read {path}: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise AnswersError(f"{path} is not valid JSON: {exc}") from exc
    return Answers.from_json(raw, source=str(path))


def save(path: Path, answers: Answers) -> None:
    path.write_text(
        json.dumps(answers.to_json(), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
