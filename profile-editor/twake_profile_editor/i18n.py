"""User-facing strings, in every supported language.

Every string the tool prints lives here as ``key -> {en, fr}``. Component labels
are not here -- they belong to the inventory, next to the endpoints they name,
so a new page cannot be added without its French label.
"""

from __future__ import annotations

LANGUAGES = ("en", "fr")
DEFAULT_LANGUAGE = "en"

STRINGS: dict[str, dict[str, str]] = {
    # -- interview ---------------------------------------------------------
    "ask.name": {
        "en": "Name of the profile",
        "fr": "Nom du profil",
    },
    "ask.application": {
        "en": "Which application is this profile for?",
        "fr": "Pour quelle application ce profil est-il destiné ?",
    },
    "ask.mode": {
        "en": "Which mode?",
        "fr": "Quel mode ?",
    },
    "ask.baseline": {
        "en": "Reuse an existing webadmin-proxy profile as a baseline?",
        "fr": "Réutiliser un profil webadmin-proxy existant comme base ?",
    },
    "ask.pages": {
        "en": "Which pages may this profile see? (space to toggle, enter to confirm)",
        "fr": "Quelles pages ce profil peut-il voir ? (espace pour cocher, entrée pour valider)",
    },
    "ask.subtree": {
        "en": "{name} — what may be seen or done inside?",
        "fr": "{name} — que peut-on y voir ou y faire ?",
    },
    "ask.children": {
        "en": "{name} — tick what may be seen or done",
        "fr": "{name} — cochez ce qui peut être vu ou fait",
    },
    "choice.all": {
        "en": "Everything",
        "fr": "Tout",
    },
    "choice.none": {
        "en": "Nothing",
        "fr": "Rien",
    },
    "choice.detail": {
        "en": "Let me choose in detail",
        "fr": "Choisir en détail",
    },
    "choice.no-baseline": {
        "en": "No — build the profile from scratch",
        "fr": "Non — construire le profil de zéro",
    },
    "mode.global": {
        "en": "Global — the profile administers the whole server",
        "fr": "Global — le profil administre tout le serveur",
    },
    "mode.domain": {
        "en": "Per domain — the profile is limited to the admin's own domain",
        "fr": "Par domaine — le profil est limité au domaine de l'administrateur",
    },
    "app.mail": {"en": "Mail", "fr": "Messagerie"},
    "app.calendar": {"en": "Calendar", "fr": "Agenda"},
    # -- output ------------------------------------------------------------
    "out.header": {
        "en": "Profile {name} — {application}, {mode} mode",
        "fr": "Profil {name} — {application}, mode {mode}",
    },
    "out.written": {
        "en": "Written {path}",
        "fr": "Écrit {path}",
    },
    "out.rules.one": {
        "en": "1 rule",
        "fr": "1 règle",
    },
    "out.rules.many": {
        "en": "{count} rules",
        "fr": "{count} règles",
    },
    "out.restrictions": {
        "en": (
            "DOMAIN mode: an include target holds rules only, so add this to the "
            "client entry next to the include, or {name}.json grants every domain"
        ),
        "fr": (
            "Mode DOMAIN : une cible d'include ne contient que des règles ; ajoutez "
            "ceci à l'entrée client à côté de l'include, sinon {name}.json autorise "
            "tous les domaines"
        ),
    },
    "out.include-hint": {
        "en": "Reference it from the client entry with:",
        "fr": "Référencez-le depuis l'entrée client avec :",
    },
    "out.warnings": {
        "en": "Warnings",
        "fr": "Avertissements",
    },
    "out.corrections": {
        "en": "Answers overruled to keep the profile coherent",
        "fr": "Réponses corrigées pour garder le profil cohérent",
    },
    "out.prefilled": {
        "en": "{count} answers pre-filled from {path}",
        "fr": "{count} réponses pré-remplies depuis {path}",
    },
    "out.not-prefilled": {
        "en": "{count} questions could not be pre-filled (new since the file was saved)",
        "fr": "{count} questions n'ont pas pu être pré-remplies (nouvelles depuis l'enregistrement)",
    },
    "out.closed-fallback": {
        "en": (
            "{count} questions are absent from {path} and fell back to the closed "
            "answer (not visible, not allowed):"
        ),
        "fr": (
            "{count} questions sont absentes de {path} et ont basculé sur la réponse "
            "fermée (non visible, non autorisé) :"
        ),
    },
    "warn.baseline-shadow": {
        "en": (
            "{verb} {pattern} is granted by {profile} and was refused, but denying it "
            "would also block {shadow_verb} {shadow_pattern}, which is granted. The "
            "deny rule was left out; the endpoint stays reachable."
        ),
        "fr": (
            "{verb} {pattern} est accordé par {profile} et a été refusé, mais le "
            "refuser bloquerait aussi {shadow_verb} {shadow_pattern}, qui est accordé. "
            "La règle de refus a été omise ; l'endpoint reste accessible."
        ),
    },
    "warn.scoping.mailing-lists": {
        "en": (
            "mailing list addresses are not domain-scoped automatically: the calendar "
            "baseline matches them as xxx@lists.{{domain}} or xxx@{{domain}}. Review "
            "this rule by hand."
        ),
        "fr": (
            "les adresses de liste ne sont pas restreintes au domaine automatiquement : "
            "la base agenda les reconnaît comme xxx@lists.{{domain}} ou xxx@{{domain}}. "
            "Revoyez cette règle à la main."
        ),
    },
    "warn.scoping.rename": {
        "en": (
            "only the renamed user is domain-scoped; the target address stays free, so "
            "a user may be renamed into another domain."
        ),
        "fr": (
            "seul l'utilisateur renommé est restreint au domaine ; l'adresse cible "
            "reste libre, un utilisateur peut donc être renommé vers un autre domaine."
        ),
    },
    # -- check report ------------------------------------------------------
    "check.header": {
        "en": "What {path} makes visible — {application}, {mode} mode",
        "fr": "Ce que {path} rend visible — {application}, mode {mode}",
    },
    "check.visible": {"en": "visible", "fr": "visible"},
    "check.hidden": {"en": "hidden", "fr": "masqué"},
    "check.allowed": {"en": "allowed", "fr": "autorisé"},
    "check.forbidden": {"en": "forbidden", "fr": "interdit"},
    "check.missing": {
        "en": "missing",
        "fr": "manquant",
    },
    "check.derived": {
        "en": "shown only because an action below is allowed",
        "fr": "affiché uniquement car une action ci-dessous est autorisée",
    },
    "check.derived-hidden": {
        "en": "hidden: no action below is allowed",
        "fr": "masqué : aucune action ci-dessous n'est autorisée",
    },
    "check.parent-hidden": {
        "en": "unreachable: its parent is hidden",
        "fr": "inaccessible : son parent est masqué",
    },
    "check.summary": {
        "en": "{visible}/{total} pages visible, {actions}/{total_actions} actions allowed",
        "fr": "{visible}/{total} pages visibles, {actions}/{total_actions} actions autorisées",
    },
}


def t(key: str, lang: str = DEFAULT_LANGUAGE, **fmt: object) -> str:
    try:
        entry = STRINGS[key]
    except KeyError:  # pragma: no cover - a typo in a key is a programming error
        raise KeyError(f"unknown message key {key!r}") from None
    template = entry.get(lang) or entry[DEFAULT_LANGUAGE]
    # Always formatted, so a literal brace must be doubled in STRINGS -- keeping
    # it conditional would render those doubles verbatim.
    return template.format(**fmt)
