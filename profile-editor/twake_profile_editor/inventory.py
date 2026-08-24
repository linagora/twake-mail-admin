"""The endpoint inventory, transcribed from twake-mail-admin's validation.md.

Every ``(verb, pattern)`` pair declared upstream appears here exactly once, and
``tests/test_inventory.py`` re-parses validation.md on each run to prove it. When
the frontend grows a page, that test fails and points at the missing rows -- the
inventory cannot silently drift out of date.

What this file adds on top of the upstream tables is the part a flat list cannot
express: which component *contains* which, so that refusing a page also refuses
everything inside it, and so the interview can skip a whole subtree in one answer.

Deliberate departures from validation.md are listed in :data:`DISCREPANCIES`.
"""

from __future__ import annotations

from dataclasses import dataclass

from .model import (
    Application,
    Inventory,
    Mode,
    action,
    may,
    must,
    page,
    section,
)

MAIL = frozenset({Application.MAIL})
CALENDAR = frozenset({Application.CALENDAR})
GLOBAL = frozenset({Mode.GLOBAL})
DOMAIN = frozenset({Mode.DOMAIN})


@dataclass(frozen=True)
class Discrepancy:
    """Something in validation.md this inventory had to interpret or correct."""

    where: str
    upstream: str
    decision: str


DISCREPANCIES: tuple[Discrepancy, ...] = (
    Discrepancy(
        where="Mail repositories — Download mail",
        upstream=(
            "Declared as `GET .../mails/{mailKey}` with `Accept: message/rfc822`, "
            "identical to the mail detail load once the header is ignored."
        ),
        decision=(
            "Kept as its own action so the interview stays readable; the duplicate "
            "rule is collapsed at emission time."
        ),
    ),
)
#: Calls the proxy never evaluates — they must not appear in a generated profile.
NEVER_BLOCKED: tuple[tuple[str, str], ...] = (("GET", "/.proxy/myDomain"),)

#: Endpoints this inventory declares that validation.md does not. Empty, and
#: meant to stay that way: a component whose permission gate is undocumented has
#: a documentation bug, not an exception. Listing one here is a deliberate,
#: reviewable escape hatch, never a way to quiet a failing test.
FRONTEND_ONLY: tuple[tuple[str, str], ...] = ()

#: Permission gates the frontend evaluates on paths validation.md never mentions.
#: Also empty: ``tests/test_frontend_crosscheck.py`` proves that a profile
#: granting the whole tree satisfies every gate the UI evaluates, so nothing the
#: frontend can hide is outside the questionnaire.
MISSING_FROM_VALIDATION: tuple[tuple[str, str], ...] = ()


# ---------------------------------------------------------------------------
# Domains
# ---------------------------------------------------------------------------

_TM = "/domains/{domain}/team-mailboxes/{mailbox}"
_TM_FOLDER = f"{_TM}/mailboxes/{{folderName}}"

DOMAINS = page(
    "domains",
    "Domains",
    "Domaines",
    endpoints=[must("GET", "/domains")],
    children=[
        action(
            "create",
            "Create a domain",
            "Créer un domaine",
            endpoints=[may("PUT", "/domains/{domain}")],
        ),
        action(
            "delete",
            "Delete a domain",
            "Supprimer un domaine",
            endpoints=[may("DELETE", "/domains/{domain}")],
        ),
        action(
            "delete-data",
            "Delete all data of a domain",
            "Supprimer toutes les données d'un domaine",
            endpoints=[may("POST", "/domains/{domain}?action=deleteData")],
        ),
        section(
            "aliases",
            "Aliases tab",
            "Onglet Alias",
            applications=MAIL,
            endpoints=[must("GET", "/domains/{domain}/aliases")],
            children=[
                action(
                    "add",
                    "Add an alias",
                    "Ajouter un alias",
                    endpoints=[may("PUT", "/domains/{domain}/aliases/{source}")],
                ),
                action(
                    "delete",
                    "Delete an alias",
                    "Supprimer un alias",
                    endpoints=[may("DELETE", "/domains/{domain}/aliases/{source}")],
                ),
            ],
        ),
        section(
            "quota",
            "Quota tab",
            "Onglet Quota",
            applications=MAIL,
            endpoints=[must("GET", "/quota/domains/{domain}")],
            children=[
                action(
                    "save",
                    "Update the domain quota",
                    "Modifier le quota du domaine",
                    endpoints=[may("PUT", "/quota/domains/{domain}")],
                )
            ],
        ),
        section(
            "ratelimits",
            "Rate limits tab",
            "Onglet Limites de débit",
            applications=MAIL,
            endpoints=[must("GET", "/domains/{domain}/ratelimits")],
            children=[
                action(
                    "save",
                    "Update rate limits",
                    "Modifier les limites de débit",
                    endpoints=[may("PUT", "/domains/{domain}/ratelimits")],
                )
            ],
        ),
        section(
            "contacts",
            "Contacts tab",
            "Onglet Contacts",
            applications=MAIL,
            endpoints=[
                must("GET", "/domains/{domain}/contacts"),
                must("GET", "/domains/{domain}/contacts/{username}"),
            ],
            children=[
                action(
                    "create",
                    "Create a contact",
                    "Créer un contact",
                    endpoints=[may("POST", "/domains/{domain}/contacts")],
                ),
                action(
                    "edit",
                    "Edit a contact",
                    "Modifier un contact",
                    endpoints=[may("PUT", "/domains/{domain}/contacts/{username}")],
                ),
                action(
                    "delete",
                    "Delete a contact",
                    "Supprimer un contact",
                    endpoints=[may("DELETE", "/domains/{domain}/contacts/{username}")],
                ),
            ],
        ),
        section(
            "team-mailboxes",
            "Team mailboxes tab",
            "Onglet Boîtes partagées",
            applications=MAIL,
            endpoints=[must("GET", "/domains/{domain}/team-mailboxes")],
            children=[
                action(
                    "create",
                    "Create a team mailbox",
                    "Créer une boîte partagée",
                    endpoints=[
                        may("PUT", "/domains/{domain}/team-mailboxes/{name}")
                    ],
                ),
                action(
                    "delete",
                    "Delete a team mailbox",
                    "Supprimer une boîte partagée",
                    endpoints=[
                        may("DELETE", "/domains/{domain}/team-mailboxes/{name}")
                    ],
                ),
                section(
                    "members",
                    "Members sub-tab",
                    "Sous-onglet Membres",
                    endpoints=[must("GET", f"{_TM}/members")],
                    children=[
                        action(
                            "add",
                            "Add a member",
                            "Ajouter un membre",
                            endpoints=[may("PUT", f"{_TM}/members/{{username}}")],
                        ),
                        action(
                            "remove",
                            "Remove a member",
                            "Retirer un membre",
                            endpoints=[may("DELETE", f"{_TM}/members/{{username}}")],
                        ),
                    ],
                ),
                section(
                    "extra-senders",
                    "Extra senders sub-tab",
                    "Sous-onglet Expéditeurs supplémentaires",
                    endpoints=[must("GET", f"{_TM}/extraSenders")],
                    children=[
                        action(
                            "add",
                            "Add a sender",
                            "Ajouter un expéditeur",
                            endpoints=[may("PUT", f"{_TM}/extraSenders/{{username}}")],
                        ),
                        action(
                            "remove",
                            "Remove a sender",
                            "Retirer un expéditeur",
                            endpoints=[
                                may("DELETE", f"{_TM}/extraSenders/{{username}}")
                            ],
                        ),
                    ],
                ),
                section(
                    "quota",
                    "Quota sub-tab",
                    "Sous-onglet Quota",
                    endpoints=[must("GET", f"{_TM}/quota")],
                    children=[
                        action(
                            "save",
                            "Update the quota",
                            "Modifier le quota",
                            endpoints=[may("PUT", f"{_TM}/quota/limit/size")],
                        ),
                        action(
                            "clear",
                            "Clear the quota",
                            "Effacer le quota",
                            endpoints=[may("DELETE", f"{_TM}/quota/limit/size")],
                        ),
                    ],
                ),
                section(
                    "deleted-messages",
                    "Deleted messages sub-tab",
                    "Sous-onglet Messages supprimés",
                    note="Hidden entirely when neither action is granted.",
                    children=[
                        action(
                            "search",
                            "Search deleted messages",
                            "Rechercher des messages supprimés",
                            endpoints=[
                                may(
                                    "POST",
                                    "/deletedMessages/users/{mailbox@domain}"
                                    "/messages?force=true",
                                )
                            ],
                        ),
                        action(
                            "restore",
                            "Restore deleted messages",
                            "Restaurer des messages supprimés",
                            endpoints=[
                                may(
                                    "POST",
                                    "/deletedMessages/teamMailbox/{mailbox@domain}"
                                    "?action=restore",
                                )
                            ],
                        ),
                    ],
                ),
                section(
                    "folders",
                    "Folders sub-tab",
                    "Sous-onglet Dossiers",
                    endpoints=[must("GET", f"{_TM}/mailboxes")],
                    children=[
                        action(
                            "message-count",
                            "Display message counts",
                            "Afficher le nombre de messages",
                            endpoints=[may("GET", f"{_TM_FOLDER}/messageCount")],
                        ),
                        action(
                            "unseen-count",
                            "Display unread counts",
                            "Afficher le nombre de messages non lus",
                            endpoints=[may("GET", f"{_TM_FOLDER}/unseenMessageCount")],
                        ),
                        action(
                            "create",
                            "Create a folder",
                            "Créer un dossier",
                            endpoints=[may("PUT", _TM_FOLDER)],
                        ),
                        action(
                            "delete",
                            "Delete a folder",
                            "Supprimer un dossier",
                            endpoints=[may("DELETE", _TM_FOLDER)],
                        ),
                        action(
                            "subaddressing-status",
                            "Display the subaddressing status",
                            "Afficher l'état du sous-adressage",
                            endpoints=[may("GET", f"{_TM_FOLDER}/subaddressing")],
                        ),
                        action(
                            "subaddressing-toggle",
                            "Toggle subaddressing",
                            "Activer ou désactiver le sous-adressage",
                            endpoints=[may("PUT", f"{_TM_FOLDER}/subaddressing")],
                        ),
                        section(
                            "extra-acl",
                            "Extra ACL sub-tab",
                            "Sous-onglet Droits supplémentaires",
                            endpoints=[must("GET", f"{_TM_FOLDER}/extraAcl")],
                                            children=[
                                action(
                                    "add",
                                    "Add an ACL entry",
                                    "Ajouter un droit",
                                    endpoints=[
                                        may("PUT", f"{_TM_FOLDER}/extraAcl/{{username}}")
                                    ],
                                ),
                                action(
                                    "remove",
                                    "Remove an ACL entry",
                                    "Retirer un droit",
                                    endpoints=[
                                        may(
                                            "DELETE",
                                            f"{_TM_FOLDER}/extraAcl/{{username}}",
                                        )
                                    ],
                                ),
                                action(
                                    "clear",
                                    "Clear all ACL entries",
                                    "Effacer tous les droits",
                                    endpoints=[
                                        may("DELETE", f"{_TM_FOLDER}/extraAcl")
                                    ],
                                ),
                            ],
                        ),
                    ],
                ),
            ],
        ),
        section(
            "signature-templates",
            "Signature templates section",
            "Section Modèles de signature",
            applications=MAIL,
            endpoints=[must("GET", "/domains/{domain}/signature-templates")],
            children=[
                action(
                    "save",
                    "Save the signature templates",
                    "Enregistrer les modèles de signature",
                    endpoints=[may("PUT", "/domains/{domain}/signature-templates")],
                ),
                action(
                    "delete",
                    "Delete the signature templates",
                    "Supprimer les modèles de signature",
                    endpoints=[may("DELETE", "/domains/{domain}/signature-templates")],
                ),
                action(
                    "apply",
                    "Apply the signature templates to every user",
                    "Appliquer les modèles de signature à tous les utilisateurs",
                    endpoints=[
                        may("POST", "/domains/{domain}/signature-templates?action=apply")
                    ],
                ),
            ],
        ),
        section(
            "jmap-report",
            "JMAP settings report section",
            "Section Rapport des paramètres JMAP",
            applications=MAIL,
            endpoints=[must("GET", "/jmap/settings/reports")],
        ),
        action(
            "provision-templates",
            "Provision mailbox templates for the domain",
            "Provisionner les modèles de boîtes du domaine",
            applications=MAIL,
            endpoints=[
                may(
                    "POST",
                    "/domains/{domain}/templates?action=provision&{params}",
                    gates=("/domains/{domain}/templates",),
                )
            ],
        ),
        action(
            "sync-members",
            "Sync domain members",
            "Synchroniser les membres du domaine",
            applications=CALENDAR,
            endpoints=[
                may(
                    "POST",
                    "/addressbook/domain-members/{domain}?task=sync",
                    gates=("/addressbook/domain-members/{domain}",),
                )
            ],
        ),
        section(
            "admins",
            "Calendar: Admins tab",
            "Agenda : onglet Administrateurs",
            applications=CALENDAR,
            endpoints=[must("GET", "/domains/{domain}/admins")],
            children=[
                action(
                    "add",
                    "Add an admin",
                    "Ajouter un administrateur",
                    endpoints=[may("PUT", "/domains/{domain}/admins/{username}")],
                ),
                action(
                    "remove",
                    "Remove an admin",
                    "Retirer un administrateur",
                    endpoints=[may("DELETE", "/domains/{domain}/admins/{username}")],
                ),
            ],
        ),
        section(
            "resources",
            "Calendar: Resources tab",
            "Agenda : onglet Ressources",
            applications=CALENDAR,
            endpoints=[
                must("GET", "/domains/{domain}/resources"),
                must("GET", "/domains/{domain}/resources/{resourceId}"),
            ],
            children=[
                action(
                    "create",
                    "Create a resource",
                    "Créer une ressource",
                    endpoints=[may("POST", "/domains/{domain}/resources")],
                ),
                action(
                    "edit",
                    "Edit a resource",
                    "Modifier une ressource",
                    endpoints=[
                        may("PATCH", "/domains/{domain}/resources/{resourceId}")
                    ],
                ),
                action(
                    "delete",
                    "Delete a resource",
                    "Supprimer une ressource",
                    endpoints=[
                        may("DELETE", "/domains/{domain}/resources/{resourceId}")
                    ],
                ),
                action(
                    "reposition-write-rights",
                    "Reposition write rights",
                    "Repositionner les droits d'écriture",
                    endpoints=[
                        may(
                            "POST",
                            "/domains/{domain}/resources?task=repositionWriteRights",
                            gates=("/domains/{domain}/resources",),
                        )
                    ],
                ),
            ],
        ),
        section(
            "team-calendars",
            "Calendar: Team calendars section",
            "Agenda : section Agendas d'équipe",
            applications=CALENDAR,
            endpoints=[must("GET", "/domains/{domain}/team-calendars")],
            children=[
                action(
                    "create",
                    "Create a team calendar",
                    "Créer un agenda d'équipe",
                    endpoints=[may("POST", "/domains/{domain}/team-calendars")],
                ),
                action(
                    "edit",
                    "Edit a team calendar",
                    "Modifier un agenda d'équipe",
                    endpoints=[
                        may(
                            "PATCH",
                            "/domains/{domain}/team-calendars/{teamCalendarId}",
                        )
                    ],
                ),
                action(
                    "delete",
                    "Delete a team calendar",
                    "Supprimer un agenda d'équipe",
                    endpoints=[
                        may(
                            "DELETE",
                            "/domains/{domain}/team-calendars/{teamCalendarId}",
                        )
                    ],
                ),
                action(
                    "view-members",
                    "View the members of a team calendar",
                    "Consulter les membres d'un agenda d'équipe",
                    endpoints=[
                        may(
                            "GET",
                            "/domains/{domain}/team-calendars/{teamCalendarId}/members",
                        )
                    ],
                ),
                action(
                    "manage-members",
                    "Add, change or remove a member",
                    "Ajouter, modifier ou retirer un membre",
                    endpoints=[
                        may(
                            "POST",
                            "/domains/{domain}/team-calendars/{teamCalendarId}"
                            "/members/invitee",
                        )
                    ],
                ),
            ],
        ),
        section(
            "settings",
            "Calendar: Settings section",
            "Agenda : section Paramètres",
            applications=CALENDAR,
            endpoints=[must("GET", "/domains/{domain}/settings")],
            children=[
                action(
                    "save",
                    "Save the domain settings",
                    "Enregistrer les paramètres du domaine",
                    endpoints=[may("PUT", "/domains/{domain}/settings")],
                )
            ],
        ),
    ],
)


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

_U = "/users/{username}"
_QUOTA_EXPLORER = (
    "/quota/users?minOccupationRatio={min}&maxOccupationRatio={max}"
    "&limit={limit}&offset={offset}"
)

USERS = page(
    "users",
    "Users",
    "Utilisateurs",
    endpoints=[
        must("GET", "/users", modes=GLOBAL),
        must("GET", "/domains/{domain}/users", modes=DOMAIN),
    ],
    children=[
        action(
            "rename",
            "Rename a user",
            "Renommer un utilisateur",
            applications=MAIL,
            endpoints=[
                may(
                    "POST",
                    f"{_U}/rename/{{newUsername}}?action=rename",
                    # The frontend spells the target variable {newUser}; quoted verbatim.
                    gates=(f"{_U}/rename/{{newUser}}",),
                )
            ],
        ),
        action(
            "delete-data",
            "Delete all data of a user",
            "Supprimer toutes les données d'un utilisateur",
            endpoints=[may("POST", f"{_U}?action=deleteData")],
        ),
        action(
            "cleanup-mailbox",
            "Clean up old messages of a mailbox",
            "Purger les anciens messages d'une boîte",
            applications=MAIL,
            endpoints=[
                may(
                    "DELETE",
                    "/messages?mailbox={mailbox}&olderThan={date}&useSavedDate",
                    gates=(
                        "/messages",
                        "/messages?mailbox=Spam",
                        "/messages?mailbox=Trash",
                    ),
                )
            ],
        ),
        section(
            "mailboxes",
            "Mailboxes tab",
            "Onglet Boîtes aux lettres",
            applications=MAIL,
            endpoints=[must("GET", f"{_U}/mailboxes")],
            children=[
                action(
                    "message-count",
                    "Display message counts",
                    "Afficher le nombre de messages",
                    endpoints=[may("GET", f"{_U}/mailboxes/{{mailboxName}}/messageCount")],
                ),
                action(
                    "unseen-count",
                    "Display unread counts",
                    "Afficher le nombre de messages non lus",
                    endpoints=[
                        may("GET", f"{_U}/mailboxes/{{mailboxName}}/unseenMessageCount")
                    ],
                ),
                action(
                    "create",
                    "Create a mailbox",
                    "Créer une boîte aux lettres",
                    endpoints=[may("PUT", f"{_U}/mailboxes/{{mailboxName}}")],
                ),
                action(
                    "delete",
                    "Delete a mailbox",
                    "Supprimer une boîte aux lettres",
                    endpoints=[may("DELETE", f"{_U}/mailboxes/{{mailboxName}}")],
                ),
                action(
                    "clear",
                    "Empty a mailbox",
                    "Vider une boîte aux lettres",
                    endpoints=[
                        may("DELETE", f"{_U}/mailboxes/{{mailboxName}}/messages")
                    ],
                ),
                action(
                    "delete-all",
                    "Delete every mailbox",
                    "Supprimer toutes les boîtes aux lettres",
                    endpoints=[may("DELETE", f"{_U}/mailboxes")],
                ),
                action(
                    "reindex",
                    "Reindex mailboxes",
                    "Réindexer les boîtes aux lettres",
                    endpoints=[
                        may(
                            "POST",
                            f"{_U}/mailboxes?task=reIndex",
                            gates=(f"{_U}/mailboxes",),
                        )
                    ],
                ),
                action(
                    "subscribe-all",
                    "Subscribe to every mailbox",
                    "S'abonner à toutes les boîtes aux lettres",
                    endpoints=[
                        may(
                            "POST",
                            f"{_U}/mailboxes?task=subscribeAll",
                            gates=(f"{_U}/mailboxes",),
                        )
                    ],
                ),
                action(
                    "recompute-projection",
                    "Recompute the fast view projection",
                    "Recalculer la projection d'affichage rapide",
                    endpoints=[
                        may(
                            "POST",
                            f"{_U}/mailboxes?task=recomputeFastViewProjectionItems",
                            gates=(f"{_U}/mailboxes",),
                        )
                    ],
                ),
            ],
        ),
        section(
            "quota",
            "Quota tab",
            "Onglet Quota",
            applications=MAIL,
            endpoints=[must("GET", "/quota/users/{username}")],
            children=[
                action(
                    "save",
                    "Update the quota",
                    "Modifier le quota",
                    endpoints=[may("PUT", "/quota/users/{username}/size")],
                ),
                action(
                    "clear",
                    "Clear the quota",
                    "Effacer le quota",
                    endpoints=[may("DELETE", "/quota/users/{username}/size")],
                ),
            ],
        ),
        section(
            "aliases",
            "Aliases tab",
            "Onglet Alias",
            applications=MAIL,
            endpoints=[must("GET", "/address/aliases/{username}")],
            children=[
                action(
                    "add",
                    "Add an alias",
                    "Ajouter un alias",
                    endpoints=[
                        may("PUT", "/address/aliases/{username}/sources/{alias}")
                    ],
                ),
                action(
                    "remove",
                    "Remove an alias",
                    "Retirer un alias",
                    endpoints=[
                        may("DELETE", "/address/aliases/{username}/sources/{alias}")
                    ],
                ),
            ],
        ),
        section(
            "forwards",
            "Forwards tab",
            "Onglet Redirections",
            applications=MAIL,
            endpoints=[must("GET", "/address/forwards/{username}")],
            children=[
                action(
                    "add",
                    "Add a forward",
                    "Ajouter une redirection",
                    endpoints=[
                        may(
                            "PUT",
                            "/address/forwards/{username}/targets/{destination}",
                        )
                    ],
                ),
                action(
                    "remove",
                    "Remove a forward",
                    "Retirer une redirection",
                    endpoints=[
                        may(
                            "DELETE",
                            "/address/forwards/{username}/targets/{destination}",
                        )
                    ],
                ),
            ],
        ),
        section(
            "vacation",
            "Vacation tab",
            "Onglet Réponse d'absence",
            applications=MAIL,
            endpoints=[must("GET", "/vacation/{username}")],
            children=[
                action(
                    "save",
                    "Save the vacation reply",
                    "Enregistrer la réponse d'absence",
                    endpoints=[may("POST", "/vacation/{username}")],
                ),
                action(
                    "delete",
                    "Delete the vacation reply",
                    "Supprimer la réponse d'absence",
                    endpoints=[may("DELETE", "/vacation/{username}")],
                ),
            ],
        ),
        section(
            "identities",
            "Identities tab",
            "Onglet Identités",
            applications=MAIL,
            endpoints=[must("GET", f"{_U}/identities")],
            children=[
                action(
                    "create",
                    "Create an identity",
                    "Créer une identité",
                    endpoints=[may("POST", f"{_U}/identities")],
                ),
                action(
                    "edit",
                    "Edit an identity",
                    "Modifier une identité",
                    endpoints=[may("PUT", f"{_U}/identities/{{identityId}}")],
                ),
                action(
                    "delete",
                    "Delete an identity",
                    "Supprimer une identité",
                    endpoints=[may("DELETE", f"{_U}/identities/{{identityId}}")],
                ),
            ],
        ),
        section(
            "allowed-from",
            "Allowed From headers section",
            "Section En-têtes From autorisés",
            applications=MAIL,
            endpoints=[must("GET", f"{_U}/allowedFromHeaders")],
        ),
        section(
            "delegated-users",
            "Delegated users tab",
            "Onglet Utilisateurs délégués",
            applications=MAIL,
            endpoints=[must("GET", f"{_U}/authorizedUsers")],
            children=[
                action(
                    "add",
                    "Add a delegated user",
                    "Ajouter un utilisateur délégué",
                    endpoints=[may("PUT", f"{_U}/authorizedUsers/{{delegated}}")],
                ),
                action(
                    "remove",
                    "Remove a delegated user",
                    "Retirer un utilisateur délégué",
                    endpoints=[may("DELETE", f"{_U}/authorizedUsers/{{delegated}}")],
                ),
            ],
        ),
        section(
            "channels",
            "Channels tab",
            "Onglet Connexions",
            applications=MAIL,
            endpoints=[must("GET", "/servers/channels/{username}")],
            children=[
                action(
                    "disconnect",
                    "Disconnect the user's channels",
                    "Déconnecter les connexions de l'utilisateur",
                    endpoints=[may("DELETE", "/servers/channels/{username}")],
                )
            ],
        ),
        section(
            "ratelimits",
            "Rate limits tab",
            "Onglet Limites de débit",
            applications=MAIL,
            endpoints=[must("GET", f"{_U}/ratelimits")],
            children=[
                action(
                    "save",
                    "Update rate limits",
                    "Modifier les limites de débit",
                    endpoints=[may("PUT", f"{_U}/ratelimits")],
                )
            ],
        ),
        section(
            "mappings",
            "Mappings tab",
            "Onglet Réécritures",
            applications=MAIL,
            endpoints=[
                must("GET", "/mappings/user/{username}"),
                must("GET", "/mappings/sources/{username}?type={type}"),
            ],
            children=[
                action(
                    "delete-sources",
                    "Delete mapping sources",
                    "Supprimer des sources de réécriture",
                    endpoints=[
                        may(
                            "DELETE",
                            "/mappings/sources/{username}?type={type}",
                            gates=("/mappings/sources/{username}",),
                        )
                    ],
                )
            ],
        ),
        section(
            "labels",
            "Labels tab",
            "Onglet Étiquettes",
            applications=MAIL,
            endpoints=[must("GET", f"{_U}/labels")],
            children=[
                action(
                    "create",
                    "Create a label",
                    "Créer une étiquette",
                    endpoints=[may("POST", f"{_U}/labels")],
                ),
                action(
                    "edit",
                    "Edit a label",
                    "Modifier une étiquette",
                    endpoints=[may("PATCH", f"{_U}/labels/{{labelId}}")],
                ),
                action(
                    "delete",
                    "Delete a label",
                    "Supprimer une étiquette",
                    endpoints=[may("DELETE", f"{_U}/labels/{{labelId}}")],
                ),
            ],
        ),
        section(
            "deleted-messages",
            "Deleted messages tab",
            "Onglet Messages supprimés",
            applications=MAIL,
            note="Hidden entirely when neither action is granted.",
            children=[
                action(
                    "search",
                    "Search deleted messages",
                    "Rechercher des messages supprimés",
                    endpoints=[
                        may("POST", "/deletedMessages/users/{username}/messages")
                    ],
                ),
                action(
                    "restore",
                    "Restore deleted messages",
                    "Restaurer des messages supprimés",
                    endpoints=[
                        may(
                            "POST",
                            "/deletedMessages/users/{username}?action=restore",
                            gates=("/deletedMessages/users/{username}",),
                        )
                    ],
                ),
            ],
        ),
        section(
            "team-mailboxes",
            "Team mailboxes tab",
            "Onglet Boîtes partagées",
            applications=MAIL,
            endpoints=[must("GET", f"{_U}/team-mailboxes")],
            children=[
                action(
                    "leave",
                    "Leave a team mailbox",
                    "Quitter une boîte partagée",
                    endpoints=[may("DELETE", f"{_TM}/members/{{username}}")],
                )
            ],
        ),
        section(
            "message-search",
            "Message search tab",
            "Onglet Recherche de messages",
            applications=MAIL,
            endpoints=[
                must(
                    "POST",
                    f"{_U}/mails?limit={{limit}}&offset={{offset}}",
                    gates=(f"{_U}/mails",),
                )
            ],
        ),
        section(
            "quota-explorer",
            "Quota explorer",
            "Explorateur de quotas",
            applications=MAIL,
            endpoints=[
                must("GET", _QUOTA_EXPLORER, modes=GLOBAL),
                must(
                    "GET",
                    _QUOTA_EXPLORER,
                    modes=DOMAIN,
                    gates=(f"{_QUOTA_EXPLORER}&domain={{domain}}",),
                ),
            ],
        ),
        section(
            "jmap-settings",
            "JMAP settings section",
            "Section Paramètres JMAP",
            applications=MAIL,
            endpoints=[must("GET", "/users/{username}/jmap/settings")],
            children=[
                action(
                    "save",
                    "Save the JMAP settings",
                    "Enregistrer les paramètres JMAP",
                    endpoints=[may("PUT", "/users/{username}/jmap/settings")],
                )
            ],
        ),
        action(
            "tier-data",
            "Move a user's data between storage tiers",
            "Déplacer les données d'un utilisateur entre niveaux de stockage",
            applications=MAIL,
            endpoints=[may("POST", "/users/{username}/data?tiering={tiering}")],
        ),
        action(
            "provision-templates",
            "Provision mailbox templates for the user",
            "Provisionner les modèles de boîtes de l'utilisateur",
            applications=MAIL,
            endpoints=[
                may(
                    "POST",
                    "/users/{username}/templates?action=provision&{params}",
                    gates=("/users/{username}/templates",),
                )
            ],
        ),
        section(
            "address-books",
            "Calendar: Address books section",
            "Agenda : section Carnets d'adresses",
            applications=CALENDAR,
            endpoints=[must("GET", "/users/{username}/addressbooks")],
            children=[
                action(
                    "create",
                    "Create an address book",
                    "Créer un carnet d'adresses",
                    endpoints=[may("POST", "/users/{username}/addressbooks")],
                ),
                action(
                    "delete",
                    "Delete an address book",
                    "Supprimer un carnet d'adresses",
                    endpoints=[
                        may("DELETE", "/users/{username}/addressbooks/{addressBookId}")
                    ],
                ),
                action(
                    "public-right",
                    "Change the public visibility",
                    "Modifier la visibilité publique",
                    endpoints=[
                        may(
                            "POST",
                            "/users/{username}/addressbooks/{addressBookId}/publicRight",
                        )
                    ],
                ),
                action(
                    "invitee",
                    "Manage invitees and delegation",
                    "Gérer les invités et la délégation",
                    endpoints=[
                        may(
                            "POST",
                            "/users/{username}/addressbooks/{addressBookId}/invitee",
                        )
                    ],
                ),
            ],
        ),
        section(
            "booking-links",
            "Calendar: Booking links section",
            "Agenda : section Liens de réservation",
            applications=CALENDAR,
            endpoints=[must("GET", "/users/{username}/booking-links")],
            children=[
                action(
                    "create",
                    "Create a booking link",
                    "Créer un lien de réservation",
                    endpoints=[may("POST", "/users/{username}/booking-links")],
                ),
                action(
                    "edit",
                    "Edit a booking link",
                    "Modifier un lien de réservation",
                    endpoints=[
                        may("PATCH", "/users/{username}/booking-links/{publicId}")
                    ],
                ),
                action(
                    "delete",
                    "Delete a booking link",
                    "Supprimer un lien de réservation",
                    endpoints=[
                        may("DELETE", "/users/{username}/booking-links/{publicId}")
                    ],
                ),
                action(
                    "reset",
                    "Regenerate a booking link",
                    "Régénérer un lien de réservation",
                    endpoints=[
                        may("POST", "/users/{username}/booking-links/{publicId}/reset")
                    ],
                ),
                action(
                    "delete-events",
                    "Delete the events booked through a link",
                    "Supprimer les événements réservés via un lien",
                    endpoints=[
                        may(
                            "POST",
                            "/users/{username}/booking-links/{publicId}"
                            "?action=deleteEvents",
                        )
                    ],
                ),
            ],
        ),
        section(
            "registration",
            "Calendar: user registration",
            "Agenda : inscription de l'utilisateur",
            applications=CALENDAR,
            endpoints=[must("GET", "/registeredUsers")],
            children=[
                action(
                    "register",
                    "Register the user as a calendar user",
                    "Inscrire l'utilisateur comme utilisateur d'agenda",
                    endpoints=[may("POST", "/registeredUsers")],
                )
            ],
        ),
        action(
            "archive-events",
            "Calendar: archive a user's events",
            "Agenda : archiver les événements d'un utilisateur",
            applications=CALENDAR,
            endpoints=[
                may(
                    "POST",
                    "/calendars/{username}?task=archive",
                    gates=("/calendars/{username}",),
                )
            ],
        ),
        section(
            "calendars",
            "Calendar: Calendars section",
            "Agenda : section Agendas",
            applications=CALENDAR,
            endpoints=[must("GET", f"{_U}/calendars")],
            children=[
                action(
                    "create",
                    "Create a calendar",
                    "Créer un agenda",
                    endpoints=[may("POST", f"{_U}/calendars")],
                ),
                action(
                    "edit",
                    "Edit a calendar",
                    "Modifier un agenda",
                    endpoints=[may("PATCH", f"{_U}/calendars/{{calendarId}}")],
                ),
                action(
                    "public-right",
                    "Change the public visibility",
                    "Modifier la visibilité publique",
                    endpoints=[
                        may("POST", f"{_U}/calendars/{{calendarId}}/publicRight")
                    ],
                ),
                action(
                    "invitee",
                    "Manage invitees and delegation",
                    "Gérer les invités et la délégation",
                    endpoints=[
                        may("POST", f"{_U}/calendars/{{calendarId}}/invitee")
                    ],
                ),
                action(
                    "invitee-check",
                    "Check that an invitee's address exists",
                    "Vérifier l'existence de l'adresse d'un invité",
                    endpoints=[may("HEAD", _U)],
                ),
                action(
                    "owner-resolution",
                    "Resolve the owner of a shared calendar",
                    "Résoudre le propriétaire d'un agenda partagé",
                    endpoints=[may("GET", "/registeredUsers")],
                ),
                action(
                    "delete",
                    "Delete a calendar",
                    "Supprimer un agenda",
                    endpoints=[may("DELETE", f"{_U}/calendars/{{calendarId}}")],
                ),
            ],
        ),
    ],
)


# ---------------------------------------------------------------------------
# Mailing lists
# ---------------------------------------------------------------------------

_ML = "/mailingLists/{address}"

MAILING_LISTS = page(
    "mailing-lists",
    "Mailing lists",
    "Listes de diffusion",
    applications=MAIL,
    endpoints=[must("GET", "/mailingLists")],
    note=(
        "In DOMAIN mode the frontend appends ?domain={domain}, which the resolver "
        "treats as a distinct pattern. Confirm against what the proxy declares."
    ),
    children=[
        action(
            "create",
            "Create a mailing list",
            "Créer une liste de diffusion",
            endpoints=[may("PUT", _ML)],
        ),
        action(
            "delete",
            "Delete a mailing list",
            "Supprimer une liste de diffusion",
            endpoints=[may("DELETE", _ML)],
        ),
        section(
            "detail",
            "Mailing list details",
            "Détail d'une liste de diffusion",
            endpoints=[must("GET", _ML)],
            children=[
                action(
                    "add-member",
                    "Add a member",
                    "Ajouter un membre",
                    endpoints=[may("PUT", f"{_ML}/members/{{member}}")],
                ),
                action(
                    "remove-member",
                    "Remove a member",
                    "Retirer un membre",
                    endpoints=[may("DELETE", f"{_ML}/members/{{member}}")],
                ),
                action(
                    "add-owner",
                    "Add an owner",
                    "Ajouter un propriétaire",
                    endpoints=[may("PUT", f"{_ML}/owners/{{owner}}")],
                ),
                action(
                    "remove-owner",
                    "Remove an owner",
                    "Retirer un propriétaire",
                    endpoints=[may("DELETE", f"{_ML}/owners/{{owner}}")],
                ),
            ],
        ),
    ],
)


# ---------------------------------------------------------------------------
# Mail repositories (MAIL, GLOBAL)
# ---------------------------------------------------------------------------

_MR = "/mailRepositories/{encodedPath}"

MAIL_REPOSITORIES = page(
    "mail-repositories",
    "Mail repositories",
    "Dépôts de messages",
    applications=MAIL,
    modes=GLOBAL,
    endpoints=[must("GET", "/mailRepositories")],
    children=[
        action(
            "create",
            "Create a repository",
            "Créer un dépôt",
            endpoints=[may("PUT", f"{_MR}?protocol={{protocol}}", gates=(_MR,))],
        ),
        section(
            "detail",
            "Repository details",
            "Détail d'un dépôt",
            endpoints=[must("GET", _MR), must("GET", f"{_MR}/mails")],
            children=[
                action(
                    "clear-all",
                    "Clear every mail",
                    "Supprimer tous les messages",
                    endpoints=[may("DELETE", f"{_MR}/mails")],
                ),
                action(
                    "reprocess-all",
                    "Reprocess every mail",
                    "Retraiter tous les messages",
                    endpoints=[
                        may(
                            "PATCH",
                            f"{_MR}/mails?action=reprocess",
                            gates=(f"{_MR}/mails",),
                        )
                    ],
                ),
                action(
                    "move-all",
                    "Move every mail",
                    "Déplacer tous les messages",
                    endpoints=[may("PATCH", f"{_MR}/mails")],
                ),
                section(
                    "mail",
                    "Mail details",
                    "Détail d'un message",
                    endpoints=[must("GET", f"{_MR}/mails/{{mailKey}}")],
                    children=[
                        action(
                            "download",
                            "Download a mail",
                            "Télécharger un message",
                            note=(
                                "Same endpoint as the detail load once the Accept "
                                "header is ignored; see DISCREPANCIES."
                            ),
                            endpoints=[may("GET", f"{_MR}/mails/{{mailKey}}")],
                        ),
                        action(
                            "reprocess",
                            "Reprocess a mail",
                            "Retraiter un message",
                            endpoints=[
                                may(
                                    "PATCH",
                                    f"{_MR}/mails/{{mailKey}}?action=reprocess",
                                    gates=(f"{_MR}/mails/{{mailKey}}",),
                                )
                            ],
                        ),
                        action(
                            "move",
                            "Move a mail",
                            "Déplacer un message",
                            endpoints=[may("PATCH", f"{_MR}/mails/{{mailKey}}")],
                        ),
                        action(
                            "delete",
                            "Delete a mail",
                            "Supprimer un message",
                            endpoints=[may("DELETE", f"{_MR}/mails/{{mailKey}}")],
                        ),
                    ],
                ),
            ],
        ),
    ],
)


# ---------------------------------------------------------------------------
# Event dead-letter (GLOBAL)
# ---------------------------------------------------------------------------

_DL = "/events/deadLetter/groups/{group}"

EVENT_DEAD_LETTER = page(
    "event-dead-letter",
    "Event dead-letter",
    "File d'événements en échec",
    applications=MAIL,
    modes=GLOBAL,
    endpoints=[must("GET", "/events/deadLetter/groups")],
    children=[
        action(
            "redeliver-all",
            "Redeliver every event",
            "Rejouer tous les événements",
            endpoints=[may("POST", "/events/deadLetter?action=reDeliver")],
        ),
        section(
            "group",
            "Group details",
            "Détail d'un groupe",
            endpoints=[must("GET", _DL)],
            children=[
                action(
                    "redeliver",
                    "Redeliver the group's events",
                    "Rejouer les événements du groupe",
                    endpoints=[may("POST", f"{_DL}?action=reDeliver", gates=(_DL,))],
                ),
                action(
                    "delete-all",
                    "Delete every event of the group",
                    "Supprimer tous les événements du groupe",
                    endpoints=[may("DELETE", _DL)],
                ),
                section(
                    "event",
                    "Event details",
                    "Détail d'un événement",
                    endpoints=[must("GET", f"{_DL}/{{insertionId}}")],
                    children=[
                        action(
                            "delete",
                            "Delete an event",
                            "Supprimer un événement",
                            endpoints=[may("DELETE", f"{_DL}/{{insertionId}}")],
                        )
                    ],
                ),
            ],
        ),
    ],
)


# ---------------------------------------------------------------------------
# Remaining global pages
# ---------------------------------------------------------------------------

GLOBAL_QUOTA = page(
    "global-quota",
    "Global quota",
    "Quota global",
    applications=MAIL,
    modes=GLOBAL,
    endpoints=[must("GET", "/quota")],
    children=[
        action(
            "save",
            "Update the global quota",
            "Modifier le quota global",
            endpoints=[may("PUT", "/quota")],
        ),
        action(
            "specific-quota-report",
            "List users with a specific quota",
            "Lister les utilisateurs ayant un quota spécifique",
            endpoints=[may("GET", "/reports/quota/users?hasSpecificQuota")],
        ),
        action(
            "quota-summary",
            "Display the quota summary",
            "Afficher la synthèse des quotas",
            endpoints=[may("GET", "/reports/quota/users/sum?hasSpecificQuota")],
        ),
        section(
            "usage",
            "Global quota usage section",
            "Section Consommation globale",
            endpoints=[must("GET", "/quota/sum")],
        ),
    ],
)

TASKS = page(
    "tasks",
    "Tasks",
    "Tâches",
    endpoints=[must("GET", "/tasks?{query_params}", gates=("/tasks",))],
    children=[
        section(
            "detail",
            "Task details",
            "Détail d'une tâche",
            endpoints=[
                must("GET", "/tasks/{id}", modes=GLOBAL),
                must("GET", "/domains/{domain}/tasks/{id}", modes=DOMAIN),
            ],
            children=[
                action(
                    "cancel",
                    "Cancel a task",
                    "Annuler une tâche",
                    endpoints=[
                        may("DELETE", "/tasks/{id}", modes=GLOBAL),
                        may("DELETE", "/domains/{domain}/tasks/{id}", modes=DOMAIN),
                    ],
                )
            ],
        )
    ],
)

TASKS_SNACKBAR = page(
    "tasks-snackbar",
    "Task progress snackbar",
    "Bandeau de progression des tâches",
    note="Uses the global task pattern in GLOBAL mode, the domain-scoped one in DOMAIN mode.",
    endpoints=[
        must("GET", "/tasks/{id}", modes=GLOBAL),
        must("GET", "/domains/{domain}/tasks/{id}", modes=DOMAIN),
    ],
    children=[
        action(
            "cancel",
            "Cancel the running task",
            "Annuler la tâche en cours",
            endpoints=[
                may("DELETE", "/tasks/{id}", modes=GLOBAL),
                may("DELETE", "/domains/{domain}/tasks/{id}", modes=DOMAIN),
            ],
        )
    ],
)

LIVE_METRICS = page(
    "live-metrics",
    "Live metrics",
    "Métriques en direct",
    applications=MAIL,
    modes=GLOBAL,
    endpoints=[must("GET", "/metrics")],
)

NETWORK_CHANNELS = page(
    "network-channels",
    "Network channels",
    "Connexions réseau",
    applications=MAIL,
    modes=GLOBAL,
    endpoints=[must("GET", "/servers/channels")],
    children=[
        action(
            "disconnect-all",
            "Disconnect every channel",
            "Fermer toutes les connexions",
            endpoints=[may("DELETE", "/servers/channels")],
        )
    ],
)

MAPPINGS = page(
    "mappings",
    "Mappings",
    "Réécritures d'adresses",
    applications=MAIL,
    modes=GLOBAL,
    endpoints=[must("GET", "/mappings")],
    children=[
        action(
            "add",
            "Add an address mapping",
            "Ajouter une réécriture d'adresse",
            endpoints=[
                may("POST", "/mappings/address/{source}/targets/{destination}")
            ],
        ),
        action(
            "remove",
            "Remove an address mapping",
            "Retirer une réécriture d'adresse",
            endpoints=[
                may("DELETE", "/mappings/address/{source}/targets/{destination}")
            ],
        ),
        action(
            "remove-alias",
            "Remove an alias mapping",
            "Retirer une réécriture d'alias",
            endpoints=[
                may(
                    "DELETE",
                    "/address/aliases/{userAddress}/sources/{aliasSource}",
                )
            ],
        ),
        action(
            "remove-forward",
            "Remove a forward mapping",
            "Retirer une réécriture de redirection",
            endpoints=[
                may(
                    "DELETE",
                    "/address/forwards/{userAddress}/targets/{targetAddress}",
                )
            ],
        ),
        action(
            "remove-group-member",
            "Remove a group member",
            "Retirer un membre de groupe",
            endpoints=[
                may("DELETE", "/address/groups/{groupAddress}/{memberAddress}")
            ],
        ),
        action(
            "add-domain-mapping",
            "Add a domain mapping",
            "Ajouter une réécriture de domaine",
            endpoints=[may("PUT", "/domainMappings/{fromDomain}")],
        ),
        action(
            "remove-domain-alias",
            "Remove a domain alias mapping",
            "Retirer une réécriture d'alias de domaine",
            endpoints=[
                may(
                    "DELETE",
                    "/domainAliases/{destinationDomain}/sources/{sourceDomain}",
                )
            ],
        ),
        action(
            "add-regex",
            "Add a regex mapping",
            "Ajouter une réécriture par expression régulière",
            endpoints=[
                may("POST", "/mappings/regex/{mappingSource}/targets/{regex}")
            ],
        ),
        action(
            "remove-regex",
            "Remove a regex mapping",
            "Retirer une réécriture par expression régulière",
            endpoints=[
                may("DELETE", "/mappings/regex/{mappingSource}/targets/{regex}")
            ],
        ),
    ],
)

CASSANDRA = page(
    "cassandra",
    "Cassandra",
    "Cassandra",
    applications=MAIL,
    modes=GLOBAL,
    endpoints=[
        must("GET", "/cassandra/version"),
        must("GET", "/cassandra/version/latest"),
    ],
    children=[
        action(
            "upgrade",
            "Upgrade the schema version",
            "Mettre à niveau la version du schéma",
            endpoints=[may("POST", "/cassandra/version/upgrade/latest")],
        )
    ],
)

RESOURCE_LOCATOR = page(
    "resource-locator",
    "Resource locator",
    "Localisateur de ressources",
    applications=MAIL,
    modes=GLOBAL,
    note="Hidden entirely when neither search is granted.",
    children=[
        action(
            "search-mailbox",
            "Search a mailbox by id",
            "Rechercher une boîte par identifiant",
            endpoints=[may("GET", "/mailboxes/{mailboxId}")],
        ),
        action(
            "search-message",
            "Search a message by id",
            "Rechercher un message par identifiant",
            endpoints=[may("GET", "/messages/{messageId}")],
        ),
    ],
)

REGISTERED_USERS = page(
    "registered-users",
    "Registered users",
    "Utilisateurs enregistrés",
    applications=CALENDAR,
    endpoints=[
        must(
            "GET",
            "/domains/{domain}/registeredUsers",
            modes=DOMAIN,
            gates=("/registeredUsers",),
        ),
        must("GET", "/registeredUsers", modes=GLOBAL),
    ],
    children=[
        action(
            "create",
            "Create a registered user",
            "Créer un utilisateur enregistré",
            endpoints=[
                may("POST", "/domains/{domain}/registeredUsers", modes=DOMAIN),
                may("POST", "/registeredUsers", modes=GLOBAL),
            ],
        ),
        action(
            "delete",
            "Delete a registered user",
            "Supprimer un utilisateur enregistré",
            endpoints=[
                may(
                    "DELETE",
                    "/domains/{domain}/registeredUsers?email={email}",
                    modes=DOMAIN,
                    gates=("/registeredUsers",),
                ),
                may(
                    "DELETE",
                    "/registeredUsers?email={email}",
                    modes=GLOBAL,
                    gates=("/registeredUsers",),
                ),
            ],
        ),
        action(
            "edit",
            "Edit a registered user",
            "Modifier un utilisateur enregistré",
            endpoints=[
                may(
                    "PATCH",
                    "/domains/{domain}/registeredUsers?id={id}",
                    modes=DOMAIN,
                ),
                may(
                    "PATCH",
                    "/registeredUsers?id={id}",
                    modes=GLOBAL,
                    gates=("/registeredUsers",),
                ),
            ],
        ),
    ],
)


# ---------------------------------------------------------------------------
# Common tasks (admin operations panel)
# ---------------------------------------------------------------------------

COMMON_TASKS = page(
    "common-tasks",
    "Common tasks",
    "Tâches d'administration",
    note="Every button not granted is simply hidden.",
    children=[
        action(
            "mailbox-task",
            "Run a mailbox task",
            "Lancer une tâche sur les boîtes aux lettres",
            applications=MAIL,
            endpoints=[may("POST", "/mailboxes?{params}", gates=("/mailboxes",))],
        ),
        action(
            "message-task",
            "Run a message task",
            "Lancer une tâche sur les messages",
            applications=MAIL,
            endpoints=[may("POST", "/messages?{params}", gates=("/messages",))],
        ),
        action(
            "quota-task",
            "Run a quota task",
            "Lancer une tâche sur les quotas",
            applications=MAIL,
            endpoints=[may("POST", "/quota/users?{params}", gates=("/quota/users",))],
        ),
        action(
            "fix-cassandra-mappings",
            "Fix Cassandra mapping inconsistencies",
            "Corriger les incohérences de réécriture Cassandra",
            applications=MAIL,
            endpoints=[
                may(
                    "POST",
                    "/cassandra/mappings?action=SolveInconsistencies&{params}",
                    gates=("/cassandra/mappings",),
                )
            ],
        ),
        action(
            "cleanup-jmap-uploads",
            "Clean up expired JMAP uploads",
            "Purger les téléversements JMAP expirés",
            applications=MAIL,
            endpoints=[
                may(
                    "DELETE",
                    "/jmap/uploads?scope=expired&{params}",
                    gates=("/jmap/uploads",),
                )
            ],
        ),
        action(
            "blob-gc",
            "Run blob garbage collection",
            "Lancer le ramasse-miettes des blobs",
            applications=MAIL,
            endpoints=[
                may(
                    "DELETE",
                    "/blobs?scope=unreferenced&{params}",
                    gates=("/blobs",),
                )
            ],
        ),
        action(
            "reindex-users",
            "Reindex users",
            "Réindexer les utilisateurs",
            applications=MAIL,
            endpoints=[may("POST", "/users?{params}", gates=("/users",))],
        ),
        action(
            "purge-deleted-messages",
            "Purge expired deleted messages",
            "Purger les messages supprimés expirés",
            applications=MAIL,
            endpoints=[
                may(
                    "DELETE",
                    "/deletedMessages?scope=expired",
                    gates=("/deletedMessages",),
                )
            ],
        ),
        action(
            "reload-certificates",
            "Reload TLS certificates",
            "Recharger les certificats TLS",
            applications=MAIL,
            endpoints=[may("POST", "/servers?reload-certificate", gates=("/servers",))],
        ),
        action(
            "cleanup-old-messages",
            "Clean up old messages",
            "Purger les anciens messages",
            applications=MAIL,
            endpoints=[
                may(
                    "DELETE",
                    "/messages?mailbox={mailbox}&olderThan={date}&useSavedDate",
                    gates=(
                        "/messages",
                        "/messages?mailbox=Spam",
                        "/messages?mailbox=Trash",
                    ),
                )
            ],
        ),
        action(
            "delete-old-tasks",
            "Delete old tasks",
            "Supprimer les anciennes tâches",
            applications=MAIL,
            endpoints=[may("DELETE", "/tasks?olderThan={days}day", gates=("/tasks",))],
        ),
        action(
            "reposition-system-rights",
            "Reposition team mailbox system rights",
            "Repositionner les droits système des boîtes partagées",
            applications=MAIL,
            endpoints=[
                may(
                    "POST",
                    "/team-mailboxes?action=repositionSystemRights",
                    gates=("/team-mailboxes",),
                )
            ],
        ),
        action(
            "import-ldap-users",
            "Import users from LDAP",
            "Importer les utilisateurs depuis LDAP",
            applications=CALENDAR,
            endpoints=[may("POST", "/registeredUsers/tasks?task=importFromLDAP")],
        ),
        action(
            "sync-domain-members",
            "Sync domain members",
            "Synchroniser les membres des domaines",
            applications=CALENDAR,
            endpoints=[may("POST", "/addressbook/domain-members?task=sync")],
        ),
        action(
            "reindex-calendar-events",
            "Reindex calendar events",
            "Réindexer les événements d'agenda",
            applications=CALENDAR,
            endpoints=[may("POST", "/calendars?task=reindex")],
        ),
        action(
            "archive-calendar-events",
            "Archive calendar events",
            "Archiver les événements d'agenda",
            applications=CALENDAR,
            endpoints=[may("POST", "/calendars?task=archive")],
        ),
        action(
            "schedule-alarms",
            "Schedule alarms",
            "Planifier les alarmes",
            applications=CALENDAR,
            endpoints=[may("POST", "/calendars?task=scheduleAlarms")],
        ),
        action(
            "add-missing-user-fields",
            "Add missing user fields",
            "Compléter les champs manquants des utilisateurs",
            applications=CALENDAR,
            endpoints=[
                may(
                    "POST",
                    "/registeredUsers?action=addMissingFields",
                    gates=("/registeredUsers",),
                )
            ],
        ),
    ],
)


JMAP_SETTINGS_REPORT = page(
    "jmap-settings-report",
    "JMAP settings report",
    "Rapport des paramètres JMAP",
    applications=MAIL,
    modes=GLOBAL,
    note="Left-bar entry present in the frontend but absent from validation.md.",
    endpoints=[must("GET", "/jmap/settings/reports")],
)


HEALTH_CHECK = page(
    "health-check",
    "Health check",
    "Contrôle de santé",
    endpoints=[must("GET", "/healthcheck")],
    help=None,
)


#: DOMAIN-mode left bar, read from ``domain-admin/domain-sidebar.tsx`` and
#: ``domain-admin/calendar-domain-sidebar.tsx``. What is a tab of a domain in
#: GLOBAL mode is a top-level entry here, so the ids are the same but their
#: position in the tree is not.
DOMAIN_PAGES: dict[Application, tuple[str, ...]] = {
    Application.MAIL: (
        "users",
        "domains.aliases",
        "domains.team-mailboxes",
        "domains.quota",
        "domains.ratelimits",
        "mailing-lists",
        "tasks",
        "tasks-snackbar",
    ),
    Application.CALENDAR: (
        "domains.admins",
        "domains.resources",
        "users",
        "registered-users",
        "domains.settings",
        "tasks",
        "tasks-snackbar",
    ),
}


INVENTORY = Inventory(
    pages=(
        HEALTH_CHECK,
        DOMAINS,
        USERS,
        MAILING_LISTS,
        MAIL_REPOSITORIES,
        EVENT_DEAD_LETTER,
        GLOBAL_QUOTA,
        TASKS,
        TASKS_SNACKBAR,
        LIVE_METRICS,
        NETWORK_CHANNELS,
        MAPPINGS,
        CASSANDRA,
        RESOURCE_LOCATOR,
        REGISTERED_USERS,
        JMAP_SETTINGS_REPORT,
        COMMON_TASKS,
    ),
    domain_pages=DOMAIN_PAGES,
)
