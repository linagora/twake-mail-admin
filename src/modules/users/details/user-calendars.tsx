import { useCallback, useId, useState } from "react";
import UserLink from "@/components/custom/user-link";
import { CalendarDays, Plus, Minus, Pencil, Trash2, Save, Eye, EyeOff, Users, Loader2 } from "lucide-react";
import { Link } from "react-router";
import { Trans, useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { createUserCalendar, deleteUserCalendar, exportUserCalendar, getUserCalendarEventCount, getUserCalendars, importUserCalendar, setUserCalendarPublicRight, updateUserCalendar, updateUserCalendarInvitees } from "../api-client";
import { calendarDisplayName, isMainCalendar } from "./main-calendar";
import { CalendarShareUpdate, CreateUserCalendarPayload, GetUserCalendarsResponseType, UpdateUserCalendarPayload, UserCalendar } from "../types";
import { CollectionCountBadge, ExportCollectionButton, ImportCollectionButton } from "@/components/custom/dav-collection-actions";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { useCheckUserExists } from "@/hooks/use-check-user-exists";
import { useDomain } from "@/modules/domain-admin/domain-context";
import { getRegisteredUsers } from "@/modules/registered-users/api-client";
import { RegisteredUser } from "@/modules/registered-users/types";
import { buildOwnerEmailMap, ownerEmail, resourceSourceId, teamCalendarSourceId } from "./calendar-owner";
import ErrorDisplayer from "@/components/custom/error-displayer";
import FormDialog, { FIELD_CLASS } from "@/components/custom/form-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DEFAULT_CALENDAR_COLOR, isValidCalendarColor, toColorPickerValue } from "./calendar-color";
import { SectionToggle, useSectionFact, useSectionOpen } from "@/components/custom/collapsible-section";
import SharedWithChip from "@/components/custom/shared-with-chip";
import { StagedChangesNotice, blocksSave, useDiscardGuard } from "@/components/custom/staged-changes";
import UserSuggestInput from "@/components/custom/user-suggest-input";

interface Props {
  username: string;
  // Called once a calendar was created, renamed or deleted, for the other sections listing them.
  onCalendarsChanged?: () => void;
  // Open on a first visit of the page
  defaultOpen?: boolean;
}

type CalendarCategory = "owner" | "delegated" | "subscription" | "resource";

const CATEGORY_ORDER: CalendarCategory[] = ["owner", "delegated", "subscription", "resource"];

// The domain of a user, whose page manages its team calendars
const domainOf = (username: string) => username.slice(username.lastIndexOf("@") + 1);

// The page of a calendar resource: among the resources of the administered domain, or under its domain
const resourcePath = (resourceId: string, domain: string, administeredDomain: string) =>
  administeredDomain
    ? `/resources/resource/${encodeURIComponent(resourceId)}`
    : `/domains/domain/${encodeURIComponent(domain)}/resource/${encodeURIComponent(resourceId)}`;

const EMPTY_CREATE: CreateUserCalendarPayload = {
  "dav:name": "",
  "apple:color": "",
  "caldav:description": "",
};

function categorize(calendar: UserCalendar): CalendarCategory {
  if (calendar["calendarserver:delegatedsource"]) return "delegated";

  const source = calendar["calendarserver:source"];
  if (source) {
    const principals = [
      ...(source.invite ?? []).map((i) => i.principal),
      ...(source.acl ?? []).map((a) => a.principal),
    ];
    if (principals.some((p) => p?.startsWith("principals/resources/"))) return "resource";
    return "subscription";
  }

  return "owner";
}

const PUBLIC_READ = "{DAV:}read";

type CalendarRight = "read" | "read-write" | "administration";

const RIGHT_OPTIONS: CalendarRight[] = ["read", "read-write", "administration"];

// esn-sabre sharee access codes
function accessToRight(access: number): CalendarRight | null {
  switch (access) {
    case 2: return "read";
    case 3: return "read-write";
    case 5: return "administration";
    default: return null;
  }
}

function rightToShareEntry(href: string, right: CalendarRight) {
  const entry: { "dav:href": string; [key: string]: string | boolean } = { "dav:href": href };
  if (right === "read") entry["dav:read"] = true;
  else if (right === "read-write") entry["dav:read-write"] = true;
  else entry["dav:administration"] = true;
  return entry;
}

interface CurrentInvitee {
  href: string;
  email: string;
  right: CalendarRight | null;
}

function currentInvitees(calendar: UserCalendar): CurrentInvitee[] {
  return (calendar.invite ?? [])
    .filter((i) => i.href?.startsWith("mailto:"))
    .map((i) => ({
      href: i.href,
      email: i.href.replace(/^mailto:/, ""),
      right: accessToRight(i.access),
    }));
}

function isPublic(calendar: UserCalendar): boolean {
  return (calendar.acl ?? []).some(
    (a) =>
      a.principal === "{DAV:}authenticated" &&
      (a.privilege === "{DAV:}read" || a.privilege === "{DAV:}write" || a.privilege === "{DAV:}all")
  );
}

function calendarId(calendar: UserCalendar): string {
  const href = calendar._links?.self?.href ?? "";
  const last = href.split("/").pop() ?? "";
  return last.replace(/\.json$/, "") || href;
}

interface CalendarPermissions {
  edit: boolean;
  remove: boolean;
  publicRight: boolean;
  invitees: boolean;
  count: boolean;
  export: boolean;
  import: boolean;
}

function CalendarRow({
  username,
  calendar,
  owner,
  isOwned,
  permissions,
  onEdit,
  onDelete,
  onPublicRight,
  onInvitees,
}: {
  username: string;
  calendar: UserCalendar;
  owner?: string | null;
  isOwned: boolean;
  permissions: CalendarPermissions;
  onEdit: (calendar: UserCalendar) => void;
  onDelete: (calendar: UserCalendar) => void;
  onPublicRight: (calendar: UserCalendar) => void;
  onInvitees: (calendar: UserCalendar) => void;
}) {
  const { t } = useTranslation();
  const name = calendar["dav:name"];
  const displayName = calendarDisplayName(calendar, t, owner) || calendarId(calendar);
  const color = calendar["apple:color"];
  const description = calendar["caldav:description"];
  const isPublicCalendar = isPublic(calendar);
  const id = calendarId(calendar);
  // esn-sabre always refuses to delete the main calendar of a user.
  const isMain = isOwned && isMainCalendar(calendar);
  const resourceId = resourceSourceId(calendar);
  const administeredDomain = useDomain();
  // Bumped once an import task is over: a new key re-reads the event counter.
  const [countKey, setCountKey] = useState(0);

  return (
    // On a phone the actions wrap under the name together, instead of squeezing it into a word per line
    <div className="group flex flex-wrap items-start gap-3 py-1 -mx-2 px-2 rounded-md transition-colors hover:bg-gray-50">
      <span
        className="inline-block w-4 h-4 rounded-full border border-gray-200 shrink-0 mt-0.5"
        style={{ backgroundColor: color || "#cccccc" }}
        title={color}
      />
      <div className="min-w-48 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <p className="font-medium min-w-0 break-words" title={name !== displayName ? name : undefined}>{displayName}</p>
          {permissions.count && (
            <CollectionCountBadge
              key={countKey}
              owner={username}
              collectionId={id}
              count={getUserCalendarEventCount}
              icon={CalendarDays}
              title={t("users.calendars.eventCount")}
            />
          )}
          {isOwned && (
            <SharedWithChip
              sharees={currentInvitees(calendar)
                .filter((invitee) => invitee.right !== null)
                .map((invitee) => ({ label: invitee.email, right: t(`users.calendars.invitees.rights.${invitee.right}`) }))}
              onOpen={permissions.invitees ? () => onInvitees(calendar) : undefined}
            />
          )}
        </div>
        {description && (
          <p className="text-xs text-gray-400">{description}</p>
        )}
        {/* A team calendar names its domain, where its members are managed; a resource links to its page; another user's calendar, its owner */}
        {teamCalendarSourceId(calendar) ? (
          <p className="text-xs text-gray-400">
            {t("users.calendars.teamCalendarOf")}{" "}
            <Link to={`/domains/domain/${encodeURIComponent(domainOf(username))}`} className="text-blue-600 hover:underline">{domainOf(username)}</Link>
          </p>
        ) : resourceId ? (
          <p className="text-xs text-gray-400">
            {t("users.calendars.resourceOf")}{" "}
            <Link to={resourcePath(resourceId, domainOf(username), administeredDomain)} className="text-blue-600 hover:underline">{domainOf(username)}</Link>
          </p>
        ) : owner && (
          <p className="text-xs text-gray-400">
            {t("users.calendars.ownerLabel")}{" "}
            <UserLink address={owner} known />
          </p>
        )}
      </div>
      <div className="flex items-center gap-3 ml-auto">
        {isOwned && permissions.export && (
          <ExportCollectionButton
            owner={username}
            collectionId={id}
            // "Main calendar", not the "#default" the server names it
            name={displayName}
            extension="ics"
            exportCollection={exportUserCalendar}
            title={t("users.calendars.exportTitle")}
            errorTitle={t("users.calendars.errorExport")}
          />
        )}
        {isOwned && permissions.import && (
          <ImportCollectionButton
            owner={username}
            collectionId={id}
            accept=".ics,text/calendar"
            importCollection={importUserCalendar}
            title={t("users.calendars.importTitle")}
            taskType="calendar-import"
            errorTitle={t("users.calendars.errorImport")}
            onImported={() => setCountKey((key) => key + 1)}
          />
        )}
        {isOwned && permissions.invitees && (
          <button
            onClick={() => onInvitees(calendar)}
            className="p-1.5 rounded-md hover:bg-gray-200 transition"
            title={t("users.calendars.invitees.title")}
          >
            <Users className="w-3.5 h-3.5 text-gray-600" />
          </button>
        )}
        {isOwned && permissions.publicRight && (
          <button
            onClick={() => onPublicRight(calendar)}
            className="p-1.5 rounded-md hover:bg-gray-200 transition"
            title={isPublicCalendar ? t("users.calendars.publicRight.publicTitle") : t("users.calendars.publicRight.privateTitle")}
          >
            {isPublicCalendar
              ? <Eye className="w-3.5 h-3.5 text-green-600" />
              : <EyeOff className="w-3.5 h-3.5 text-gray-400" />}
          </button>
        )}
        {permissions.edit && (
          <button
            onClick={() => onEdit(calendar)}
            className="p-1.5 rounded-md hover:bg-gray-200 transition"
            title={t("users.calendars.editTitle")}
          >
            <Pencil className="w-3.5 h-3.5 text-blue-600" />
          </button>
        )}
        {permissions.remove && isMain && (
          <button
            disabled
            aria-label={t("users.calendars.deleteTitle")}
            className="p-1.5 rounded-md opacity-40 cursor-not-allowed"
            title={t("users.calendars.mainCalendarUndeletable")}
          >
            <Trash2 className="w-3.5 h-3.5 text-gray-400" />
          </button>
        )}
        {permissions.remove && !isMain && (
          // Another user's or a team calendar is only removed from this user's calendars: grey, not red
          <button
            onClick={() => onDelete(calendar)}
            className="p-1.5 rounded-md hover:bg-gray-200 transition"
            title={isOwned ? t("users.calendars.deleteTitle") : t("users.calendars.removeSharedTitle")}
          >
            <Trash2 className={`w-3.5 h-3.5 ${isOwned ? "text-red-600" : "text-gray-600"}`} />
          </button>
        )}
      </div>
    </div>
  );
}

function CalendarColorField({ value, onChange }: { value: string | undefined; onChange: (color: string) => void }) {
  const { t } = useTranslation();
  const id = useId();
  const invalid = !isValidCalendarColor(value);

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">{t("users.calendars.color")}</label>
      <div className="flex gap-2 mt-1 items-center">
        <input
          id={id}
          type="color"
          value={toColorPickerValue(value)}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer border rounded-md"
        />
        <input
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={DEFAULT_CALENDAR_COLOR}
          aria-label={t("users.calendars.colorCode")}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-error` : undefined}
          className={`flex-1 px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 ${invalid ? "border-red-500 focus:ring-red-500" : "focus:ring-blue-500"}`}
        />
      </div>
      {invalid && (
        <p id={`${id}-error`} className="text-xs text-red-600 mt-1">{t("users.calendars.invalidColor")}</p>
      )}
    </div>
  );
}

export default function UserCalendars({ username, onCalendarsChanged, defaultOpen = false }: Props) {
  const { t } = useTranslation();
  const idPrefix = useId();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canView = useIsAllowed("GET", "/users/{username}/calendars");
  const canCreate = useIsAllowed("POST", "/users/{username}/calendars");
  const permissions: CalendarPermissions = {
    edit: useIsAllowed("PATCH", "/users/{username}/calendars/{calendarId}"),
    remove: useIsAllowed("DELETE", "/users/{username}/calendars/{calendarId}"),
    publicRight: useIsAllowed("POST", "/users/{username}/calendars/{calendarId}/publicRight"),
    invitees: useIsAllowed("POST", "/users/{username}/calendars/{calendarId}/invitee"),
    count: useIsAllowed("GET", "/users/{username}/calendars/{calendarId}/eventCount"),
    export: useIsAllowed("POST", "/users/{username}/calendars/{calendarId}?action=export"),
    import: useIsAllowed("POST", "/users/{username}/calendars/{calendarId}?action=import"),
  };

  const fetchCalendars = useCallback(() => getUserCalendars(username), [username]);
  const { data, isLoading, error, refresh } = useFetchData<GetUserCalendarsResponseType>(
    canView ? fetchCalendars : null
  );

  // Resolve owner emails of delegated/subscribed calendars via the registered users list.
  const domain = useDomain() || undefined;
  const canRegisteredUsers = useIsAllowed("GET", "/registeredUsers");
  const fetchRegisteredUsers = useCallback(() => getRegisteredUsers(domain), [domain]);
  const { data: registeredUsers } = useFetchData<RegisteredUser[]>(
    canView && canRegisteredUsers ? fetchRegisteredUsers : null
  );

  const [open, setOpen, openContentId] = useSectionOpen("calendars", defaultOpen);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserCalendarPayload>({ ...EMPTY_CREATE });

  const [editCalendar, setEditCalendar] = useState<UserCalendar | null>(null);
  const [editForm, setEditForm] = useState<UpdateUserCalendarPayload>({});
  const [saving, setSaving] = useState(false);

  const [publicRightCalendar, setPublicRightCalendar] = useState<UserCalendar | null>(null);
  const [publicRightValue, setPublicRightValue] = useState("");
  const [savingPublicRight, setSavingPublicRight] = useState(false);

  const [inviteesCalendar, setInviteesCalendar] = useState<UserCalendar | null>(null);

  // Before the early return: a hook runs on every render
  useSectionFact("calendars", data?._embedded?.["dav:calendar"]?.length ?? (data ? 0 : undefined));

  if (!canView) return null;

  const calendars = data?._embedded?.["dav:calendar"] ?? [];
  const ownerEmails = buildOwnerEmailMap(calendars, registeredUsers);
  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: calendars.filter((c) => categorize(c) === category),
  })).filter((group) => group.items.length > 0 || (group.category === "owner" && canCreate));

  // A refusal throws: the modal shows it and keeps the typed values
  const handleCreate = async () => {
    const payload: CreateUserCalendarPayload = { "dav:name": createForm["dav:name"].trim() };
    if (createForm["apple:color"]?.trim()) payload["apple:color"] = createForm["apple:color"]!.trim();
    if (createForm["caldav:description"]?.trim()) payload["caldav:description"] = createForm["caldav:description"]!.trim();
    await createUserCalendar(username, payload);
    toast({ title: t("users.calendars.created") });
    onCalendarsChanged?.();
    refresh();
  };

  const openEdit = (calendar: UserCalendar) => {
    setEditCalendar(calendar);
    setEditForm({
      "dav:name": calendar["dav:name"] ?? "",
      "apple:color": calendar["apple:color"] ?? "",
      "caldav:description": calendar["caldav:description"] ?? "",
    });
  };

  const handleUpdate = async () => {
    if (!editCalendar) return;
    const name = editForm["dav:name"]?.trim();
    if (!name || !isValidCalendarColor(editForm["apple:color"])) return;
    setSaving(true);
    try {
      const payload: UpdateUserCalendarPayload = {
        "dav:name": name,
        "apple:color": editForm["apple:color"]?.trim() || "",
        "caldav:description": editForm["caldav:description"]?.trim() || "",
      };
      await updateUserCalendar(username, calendarId(editCalendar), payload);
      toast({ title: t("users.calendars.updated") });
      setEditCalendar(null);
      onCalendarsChanged?.();
      await refresh();
    } catch (err) {
      toast({ title: t("users.calendars.errorUpdate"), description: <ErrorDisplayer error={err} /> });
    } finally {
      setSaving(false);
    }
  };

  const openPublicRight = (calendar: UserCalendar) => {
    setPublicRightCalendar(calendar);
    setPublicRightValue(isPublic(calendar) ? PUBLIC_READ : "");
  };

  const handleSavePublicRight = async () => {
    if (!publicRightCalendar) return;
    setSavingPublicRight(true);
    try {
      await setUserCalendarPublicRight(username, calendarId(publicRightCalendar), publicRightValue);
      toast({ title: t("users.calendars.publicRight.updated") });
      setPublicRightCalendar(null);
      await refresh();
    } catch (err) {
      toast({ title: t("users.calendars.publicRight.errorUpdate"), description: <ErrorDisplayer error={err} /> });
    } finally {
      setSavingPublicRight(false);
    }
  };

  // The copy of another user's or of a team calendar: the DELETE removes it from this user only
  const removeSharedMessage = (calendar: UserCalendar, name: string) => {
    const domain = domainOf(username);
    if (teamCalendarSourceId(calendar)) {
      return (
        <p>
          <Trans
            i18nKey="users.calendars.removeTeamCalendarConfirm"
            values={{ name, user: username, domain }}
            components={{ domainLink: <Link to={`/domains/domain/${encodeURIComponent(domain)}`} className="text-blue-600 hover:underline" /> }}
          />
        </p>
      );
    }
    return t("users.calendars.removeSharedConfirm", { name, user: username, owner: ownerEmail(calendar, ownerEmails) ?? t("users.calendars.theOwner") });
  };

  const handleRemoveShared = async (calendar: UserCalendar) => {
    const name = calendarDisplayName(calendar, t, ownerEmail(calendar, ownerEmails)) || calendarId(calendar);
    const confirmed = await confirm({
      header: t("users.calendars.removeSharedTitle"),
      confirmLabel: t("common.remove"),
      message: removeSharedMessage(calendar, name),
    });
    if (!confirmed) return;
    try {
      await deleteUserCalendar(username, calendarId(calendar));
      toast({ title: t("users.calendars.removedShared", { user: username }) });
      onCalendarsChanged?.();
      await refresh();
    } catch (err) {
      toast({ title: t("users.calendars.errorDelete"), description: <ErrorDisplayer error={err} /> });
    }
  };

  const handleDelete = async (calendar: UserCalendar) => {
    if (categorize(calendar) !== "owner") {
      await handleRemoveShared(calendar);
      return;
    }
    const confirmed = await confirm({
      header: t("users.calendars.deleteTitle"),
      destructive: true,
      confirmLabel: t("common.delete"),
      message: t("users.calendars.deleteConfirm", { name: calendarDisplayName(calendar, t, ownerEmail(calendar, ownerEmails)) || calendarId(calendar) }),
    });
    if (!confirmed) return;
    try {
      await deleteUserCalendar(username, calendarId(calendar));
      toast({ title: t("users.calendars.deleted") });
      onCalendarsChanged?.();
      await refresh();
    } catch (err) {
      toast({ title: t("users.calendars.errorDelete"), description: <ErrorDisplayer error={err} /> });
    }
  };

  return (
    <div className="mt-6">
      <SectionToggle open={open} onToggle={() => setOpen(!open)} controls={openContentId}>
        {t("users.calendars.title")}
        {data && (
          <span className="text-sm font-normal text-gray-500">({calendars.length})</span>
        )}
      </SectionToggle>

      {open && (
        <div id={openContentId} className="mt-2 space-y-4">
          {isLoading && (
            <div className="h-[40px] rounded-2 animate-pulse bg-gray-200" />
          )}
          {error && <p className="text-red-500">{t("common.errorPrefix", { message: error })}</p>}

          {data && calendars.length === 0 && !canCreate && (
            <p className="text-sm text-gray-500">{t("users.calendars.empty")}</p>
          )}

          {grouped.map((group) => (
            <div key={group.category}>
              <div className="flex items-center gap-2 mb-2">
                <h5 className="text-sm font-semibold text-gray-600">
                  {t(`users.calendars.categories.${group.category}`)}
                  <span className="ml-1 font-normal text-gray-400">({group.items.length})</span>
                </h5>
                {group.category === "owner" && canCreate && (
                  <button
                    onClick={() => { setCreateForm({ ...EMPTY_CREATE }); setShowCreate(true); }}
                    className="p-1 rounded-md hover:bg-gray-200 transition"
                    title={t("users.calendars.createTitle")}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="space-y-1">
                {group.items.map((calendar) => (
                  <CalendarRow
                    key={calendarId(calendar)}
                    username={username}
                    calendar={calendar}
                    owner={
                      group.category === "delegated" || group.category === "subscription"
                        ? ownerEmail(calendar, ownerEmails)
                        : undefined
                    }
                    isOwned={group.category === "owner"}
                    permissions={permissions}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onPublicRight={openPublicRight}
                    onInvitees={setInviteesCalendar}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal: Enter submits, and the focus goes back to the + once it closes */}
      <FormDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title={t("users.calendars.createTitle")}
        submitLabel={t("common.create")}
        submitDisabled={!createForm["dav:name"].trim() || !isValidCalendarColor(createForm["apple:color"])}
        onSubmit={handleCreate}
      >
        <div>
          <label htmlFor={`${idPrefix}-create-name`} className="text-sm font-medium">{t("users.calendars.name")} *</label>
          <input
            id={`${idPrefix}-create-name`}
            type="text"
            autoFocus
            value={createForm["dav:name"]}
            onChange={(e) => setCreateForm((f) => ({ ...f, "dav:name": e.target.value }))}
            className={FIELD_CLASS}
          />
        </div>
        <CalendarColorField
          value={createForm["apple:color"]}
          onChange={(color) => setCreateForm((f) => ({ ...f, "apple:color": color }))}
        />
        <div>
          <label htmlFor={`${idPrefix}-create-description`} className="text-sm font-medium">{t("users.calendars.description")}</label>
          <input
            id={`${idPrefix}-create-description`}
            type="text"
            value={createForm["caldav:description"] ?? ""}
            onChange={(e) => setCreateForm((f) => ({ ...f, "caldav:description": e.target.value }))}
            className={FIELD_CLASS}
          />
        </div>
      </FormDialog>

      {/* Edit modal */}
      <Dialog open={!!editCalendar} onOpenChange={(v) => { if (!v) setEditCalendar(null); }}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t("users.calendars.editTitle")} — {editCalendar && calendarDisplayName(editCalendar, t)}</DialogTitle>
          </DialogHeader>
          {editCalendar && (
            <div className="space-y-3">
              <div>
                <label htmlFor={`${idPrefix}-edit-name`} className="text-sm font-medium">{t("users.calendars.name")} *</label>
                <input
                  id={`${idPrefix}-edit-name`}
                  type="text"
                  value={editForm["dav:name"] ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, "dav:name": e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <CalendarColorField
                value={editForm["apple:color"]}
                onChange={(color) => setEditForm((f) => ({ ...f, "apple:color": color }))}
              />
              <div>
                <label htmlFor={`${idPrefix}-edit-description`} className="text-sm font-medium">{t("users.calendars.description")}</label>
                <input
                  id={`${idPrefix}-edit-description`}
                  type="text"
                  value={editForm["caldav:description"] ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, "caldav:description": e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setEditCalendar(null)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  size="sm"
                  onClick={handleUpdate}
                  disabled={saving || !editForm["dav:name"]?.trim() || !isValidCalendarColor(editForm["apple:color"])}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                  {t("common.save")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Public visibility modal */}
      <Dialog open={!!publicRightCalendar} onOpenChange={(v) => { if (!v) setPublicRightCalendar(null); }}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t("users.calendars.publicRight.title")} — {publicRightCalendar && calendarDisplayName(publicRightCalendar, t)}</DialogTitle>
          </DialogHeader>
          {publicRightCalendar && (
            <div className="space-y-3">
              <label className="flex items-start gap-2 p-2 rounded-md hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name="public-right"
                  className="mt-1"
                  checked={publicRightValue === ""}
                  onChange={() => setPublicRightValue("")}
                />
                <div>
                  <p className="text-sm font-medium">{t("users.calendars.publicRight.private")}</p>
                  <p className="text-xs text-gray-400">{t("users.calendars.publicRight.privateDesc")}</p>
                </div>
              </label>
              <label className="flex items-start gap-2 p-2 rounded-md hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name="public-right"
                  className="mt-1"
                  checked={publicRightValue === PUBLIC_READ}
                  onChange={() => setPublicRightValue(PUBLIC_READ)}
                />
                <div>
                  <p className="text-sm font-medium">{t("users.calendars.publicRight.public")}</p>
                  <p className="text-xs text-gray-400">{t("users.calendars.publicRight.publicDesc")}</p>
                </div>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setPublicRightCalendar(null)}>
                  {t("common.cancel")}
                </Button>
                <Button size="sm" onClick={handleSavePublicRight} disabled={savingPublicRight}>
                  {savingPublicRight ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                  {t("common.save")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Invitees (delegation) modal */}
      {inviteesCalendar && (
        <InviteesModal
          username={username}
          calendar={inviteesCalendar}
          onClose={() => setInviteesCalendar(null)}
          onSaved={async () => { setInviteesCalendar(null); await refresh(); }}
        />
      )}
    </div>
  );
}

function InviteesModal({
  username,
  calendar,
  onClose,
  onSaved,
}: {
  username: string;
  calendar: UserCalendar;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const rightHintId = useId();
  const { toast } = useToast();

  const [removals, setRemovals] = useState<Set<string>>(new Set());
  const [changes, setChanges] = useState<Record<string, CalendarRight>>({});
  const [additions, setAdditions] = useState<{ email: string; right: CalendarRight }[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newRight, setNewRight] = useState<CalendarRight>("read");
  const [saving, setSaving] = useState(false);

  const status = useCheckUserExists(newEmail);
  const existing = currentInvitees(calendar);

  const trimmedEmail = newEmail.trim();
  const isDuplicate =
    existing.some((i) => i.email === trimmedEmail && !removals.has(i.href)) ||
    additions.some((a) => a.email === trimmedEmail);
  const isOwner = trimmedEmail.toLowerCase() === username.toLowerCase();
  const canAdd = status === "exists" && !isOwner && !isDuplicate;

  const toggleRemoval = (href: string) => {
    setRemovals((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  };

  const changeRight = (invitee: CurrentInvitee, right: CalendarRight) => {
    setChanges((prev) => {
      const next = { ...prev };
      if (right === invitee.right) delete next[invitee.href];
      else next[invitee.href] = right;
      return next;
    });
  };

  const changedHrefs = Object.keys(changes).filter((href) => !removals.has(href));
  const hasChanges = additions.length > 0 || removals.size > 0 || changedHrefs.length > 0;

  // An address typed but not added is added on Apply when valid, and blocks Apply otherwise
  const pending = canAdd ? [{ email: trimmedEmail, right: newRight }] : [];
  const stagedCount = additions.length + removals.size + changedHrefs.length;
  const blocking = blocksSave(newEmail, canAdd);
  const requestClose = useDiscardGuard(stagedCount + pending.length, onClose);

  const handleStageAdd = () => {
    if (!canAdd) return;
    setAdditions((prev) => [...prev, { email: trimmedEmail, right: newRight }]);
    setNewEmail("");
    setNewRight("read");
  };

  const handleApply = async () => {
    const share: CalendarShareUpdate = {};
    const setEntries = [
      ...[...additions, ...pending].map((a) => rightToShareEntry(`mailto:${a.email}`, a.right)),
      ...changedHrefs.map((href) => rightToShareEntry(href, changes[href])),
    ];
    if (setEntries.length) {
      share.set = setEntries;
    }
    if (removals.size) {
      share.remove = [...removals].map((href) => ({ "dav:href": href }));
    }
    if (!share.set && !share.remove) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await updateUserCalendarInvitees(username, calendarId(calendar), share);
      toast({ title: t("users.calendars.invitees.updated") });
      await onSaved();
    } catch (err) {
      toast({ title: t("users.calendars.invitees.errorUpdate"), description: <ErrorDisplayer error={err} /> });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) requestClose(); }}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t("users.calendars.invitees.title")} — {calendarDisplayName(calendar, t)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Current + staged invitees */}
          <div className="space-y-1">
            {existing.length === 0 && additions.length === 0 && (
              <p className="text-sm text-gray-500">{t("users.calendars.invitees.empty")}</p>
            )}
            {existing.map((invitee) => {
              const removed = removals.has(invitee.href);
              const currentRight = changes[invitee.href] ?? invitee.right ?? "read";
              const changed = invitee.href in changes;
              return (
                <div key={invitee.href} className="flex items-center gap-2 py-1">
                  <span className={`flex-1 text-sm truncate ${removed ? "line-through text-gray-400" : ""}`}>
                    {invitee.email}
                  </span>
                  <select
                    value={currentRight}
                    aria-label={t("users.calendars.invitees.rightOf", { email: invitee.email })}
                    disabled={removed}
                    onChange={(e) => changeRight(invitee, e.target.value as CalendarRight)}
                    className={`px-2 py-1 border rounded-md text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${changed ? "border-blue-400 text-blue-700" : ""}`}
                  >
                    {RIGHT_OPTIONS.map((r) => (
                      <option key={r} value={r} title={t(`users.calendars.invitees.rightHints.${r}`)}>{t(`users.calendars.invitees.rights.${r}`)}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => toggleRemoval(invitee.href)}
                    className="p-1.5 rounded-md hover:bg-gray-200 transition"
                    title={removed ? t("users.calendars.invitees.undoRemove") : t("users.calendars.invitees.remove")}
                  >
                    {removed
                      ? <Plus className="w-3.5 h-3.5 text-gray-500" />
                      : <Minus className="w-3.5 h-3.5 text-red-600" />}
                  </button>
                </div>
              );
            })}
            {additions.map((addition, index) => (
              <div key={`add-${addition.email}-${index}`} className="flex items-center gap-2 py-1">
                <span className="flex-1 text-sm truncate text-green-700">{addition.email}</span>
                <span className="text-xs text-gray-500 w-28 text-right">
                  {t(`users.calendars.invitees.rights.${addition.right}`)}
                </span>
                <button
                  onClick={() => setAdditions((prev) => prev.filter((_, i) => i !== index))}
                  className="p-1.5 rounded-md hover:bg-gray-200 transition"
                  title={t("users.calendars.invitees.remove")}
                >
                  <Minus className="w-3.5 h-3.5 text-red-600" />
                </button>
              </div>
            ))}
          </div>

          {/* Add row */}
          <div className="border-t pt-3 space-y-2">
            {/* flex-wrap and min-w-0: on a phone the select and the + button move under the
                address instead of being pushed past the dialog's right edge. */}
            <div className="flex flex-wrap gap-2">
              <UserSuggestInput
                value={newEmail}
                onValueChange={setNewEmail}
                onKeyDown={(e) => e.key === "Enter" && handleStageAdd()}
                placeholder={t("users.calendars.invitees.placeholder")}
                aria-label={t("users.calendars.invitees.email")}
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500" wrapperClassName="flex-1 basis-48 min-w-0"
              />
              <select
                value={newRight}
                aria-label={t("users.calendars.invitees.right")}
                aria-describedby={rightHintId}
                onChange={(e) => setNewRight(e.target.value as CalendarRight)}
                className="max-w-full px-2 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                {RIGHT_OPTIONS.map((r) => (
                  <option key={r} value={r} title={t(`users.calendars.invitees.rightHints.${r}`)}>{t(`users.calendars.invitees.rights.${r}`)}</option>
                ))}
              </select>
              <Button size="sm" onClick={handleStageAdd} disabled={!canAdd} aria-label={t("users.calendars.invitees.add")}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {/* What the right picked lets the invitee do */}
            <p id={rightHintId} className="text-xs text-muted-foreground">{t(`users.calendars.invitees.rightHints.${newRight}`)}</p>
            <div className="h-4">
              {trimmedEmail && status === "checking" && (
                <span className="text-xs text-gray-400">{t("common.checking")}</span>
              )}
              {trimmedEmail && status === "exists" && isOwner && (
                <span className="text-xs text-orange-500">{t("users.calendars.invitees.isOwner")}</span>
              )}
              {trimmedEmail && status === "exists" && !isOwner && isDuplicate && (
                <span className="text-xs text-orange-500">{t("users.calendars.invitees.alreadyInvited")}</span>
              )}
              {trimmedEmail && status === "exists" && !isOwner && !isDuplicate && (
                <span className="text-xs text-green-600">{t("common.userExists")}</span>
              )}
              {trimmedEmail && status === "not_found" && (
                <span className="text-xs text-orange-500">{t("common.userNotFound")}</span>
              )}
              {trimmedEmail && status === "invalid" && (
                <span className="text-xs text-red-600">{t("common.invalidUsername")}</span>
              )}
            </div>
            <StagedChangesNotice count={stagedCount} blocking={blocking} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={requestClose}>
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleApply}
              disabled={saving || blocking || (!hasChanges && pending.length === 0)}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              {t("users.calendars.invitees.apply")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
