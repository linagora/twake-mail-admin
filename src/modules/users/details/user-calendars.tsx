import { useCallback, useState } from "react";
import { Link } from "react-router";
import { ChevronDown, ChevronRight, Plus, Minus, Pencil, Trash2, Save, Eye, EyeOff, Users, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { createUserCalendar, deleteUserCalendar, getUserCalendars, setUserCalendarPublicRight, updateUserCalendar, updateUserCalendarInvitees } from "../api-client";
import { CalendarShareUpdate, CreateUserCalendarPayload, GetUserCalendarsResponseType, UpdateUserCalendarPayload, UserCalendar } from "../types";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { useCheckUserExists } from "@/hooks/use-check-user-exists";
import { useDomain } from "@/modules/domain-admin/domain-context";
import { getRegisteredUsers } from "@/modules/registered-users/api-client";
import { RegisteredUser } from "@/modules/registered-users/types";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  username: string;
}

type CalendarCategory = "owner" | "delegated" | "subscription" | "resource";

const CATEGORY_ORDER: CalendarCategory[] = ["owner", "delegated", "subscription", "resource"];

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

// The owner of a delegated/subscribed calendar is referenced by its technical
// user id (the segment after /calendars/ in the source href), never by email.
// We resolve it via the registered users list (authoritative, full coverage),
// completed by the mailto invites found in the listing itself.
function buildOwnerEmailMap(
  calendars: UserCalendar[],
  registeredUsers: RegisteredUser[] | null,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const cal of calendars) {
    const invites = [...(cal.invite ?? []), ...(cal["calendarserver:source"]?.invite ?? [])];
    for (const inv of invites) {
      if (inv.href?.startsWith("mailto:") && inv.principal?.startsWith("principals/users/")) {
        map[inv.principal.slice("principals/users/".length)] = inv.href.replace(/^mailto:/, "");
      }
    }
  }
  // Registered users take precedence — they cover owners absent from any invite.
  for (const u of registeredUsers ?? []) {
    if (u.id && u.email) map[u.id] = u.email;
  }
  return map;
}

function ownerEmail(calendar: UserCalendar, ownerEmails: Record<string, string>): string | null {
  const sourceHref =
    calendar["calendarserver:delegatedsource"] ?? calendar["calendarserver:source"]?._links?.self?.href;
  if (!sourceHref) return null;
  // href looks like /calendars/{ownerId}/{calendarId}.json
  const ownerId = sourceHref.split("/").filter(Boolean)[1];
  if (!ownerId) return null;
  return ownerEmails[ownerId] ?? null;
}

function CalendarRow({
  calendar,
  owner,
  isOwned,
  canEdit,
  canDelete,
  canPublicRight,
  canInvitees,
  onEdit,
  onDelete,
  onPublicRight,
  onInvitees,
}: {
  calendar: UserCalendar;
  owner?: string | null;
  isOwned: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canPublicRight: boolean;
  canInvitees: boolean;
  onEdit: (calendar: UserCalendar) => void;
  onDelete: (calendar: UserCalendar) => void;
  onPublicRight: (calendar: UserCalendar) => void;
  onInvitees: (calendar: UserCalendar) => void;
}) {
  const { t } = useTranslation();
  const name = calendar["dav:name"];
  const color = calendar["apple:color"];
  const description = calendar["caldav:description"];
  const isPublicCalendar = isPublic(calendar);

  return (
    <div className="group flex items-start gap-3 py-1">
      <span
        className="inline-block w-4 h-4 rounded-full border border-gray-200 flex-shrink-0 mt-0.5"
        style={{ backgroundColor: color || "#cccccc" }}
        title={color}
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{name}</p>
        {description && (
          <p className="text-xs text-gray-400">{description}</p>
        )}
        {owner && (
          <p className="text-xs text-gray-400">
            {t("users.calendars.ownerLabel")}{" "}
            <Link
              to={`/users/user/${encodeURIComponent(owner)}`}
              className="text-blue-600 hover:underline"
            >
              {owner}
            </Link>
          </p>
        )}
      </div>
      {isOwned && canInvitees && (
        <button
          onClick={() => onInvitees(calendar)}
          className="p-1.5 rounded-md hover:bg-gray-200 transition"
          title={t("users.calendars.invitees.title")}
        >
          <Users className="w-3.5 h-3.5 text-gray-600" />
        </button>
      )}
      {isOwned && canPublicRight && (
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
      {canEdit && (
        <button
          onClick={() => onEdit(calendar)}
          className="p-1.5 rounded-md hover:bg-gray-200 transition"
          title={t("users.calendars.editTitle")}
        >
          <Pencil className="w-3.5 h-3.5 text-blue-600" />
        </button>
      )}
      {canDelete && (
        <button
          onClick={() => onDelete(calendar)}
          className="p-1.5 rounded-md hover:bg-gray-200 transition"
          title={t("users.calendars.deleteTitle")}
        >
          <Trash2 className="w-3.5 h-3.5 text-red-600" />
        </button>
      )}
    </div>
  );
}

export default function UserCalendars({ username }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canView = useIsAllowed("GET", "/users/{username}/calendars");
  const canCreate = useIsAllowed("POST", "/users/{username}/calendars");
  const canEdit = useIsAllowed("PATCH", "/users/{username}/calendars/{calendarId}");
  const canDelete = useIsAllowed("DELETE", "/users/{username}/calendars/{calendarId}");
  const canPublicRight = useIsAllowed("POST", "/users/{username}/calendars/{calendarId}/publicRight");
  const canInvitees = useIsAllowed("POST", "/users/{username}/calendars/{calendarId}/invitee");

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

  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserCalendarPayload>({ ...EMPTY_CREATE });
  const [creating, setCreating] = useState(false);

  const [editCalendar, setEditCalendar] = useState<UserCalendar | null>(null);
  const [editForm, setEditForm] = useState<UpdateUserCalendarPayload>({});
  const [saving, setSaving] = useState(false);

  const [publicRightCalendar, setPublicRightCalendar] = useState<UserCalendar | null>(null);
  const [publicRightValue, setPublicRightValue] = useState("");
  const [savingPublicRight, setSavingPublicRight] = useState(false);

  const [inviteesCalendar, setInviteesCalendar] = useState<UserCalendar | null>(null);

  if (!canView) return null;

  const calendars = data?._embedded?.["dav:calendar"] ?? [];
  const ownerEmails = buildOwnerEmailMap(calendars, registeredUsers);
  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: calendars.filter((c) => categorize(c) === category),
  })).filter((group) => group.items.length > 0 || (group.category === "owner" && canCreate));

  const handleCreate = async () => {
    const name = createForm["dav:name"].trim();
    if (!name) return;
    setCreating(true);
    try {
      const payload: CreateUserCalendarPayload = { "dav:name": name };
      if (createForm["apple:color"]?.trim()) payload["apple:color"] = createForm["apple:color"]!.trim();
      if (createForm["caldav:description"]?.trim()) payload["caldav:description"] = createForm["caldav:description"]!.trim();
      await createUserCalendar(username, payload);
      toast({ title: t("users.calendars.created") });
      setCreateForm({ ...EMPTY_CREATE });
      setShowCreate(false);
      await refresh();
    } catch (err) {
      toast({ title: t("users.calendars.errorCreate"), description: <ErrorDisplayer error={err} /> });
    } finally {
      setCreating(false);
    }
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
    if (!name) return;
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

  const handleDelete = async (calendar: UserCalendar) => {
    const confirmed = await confirm({
      header: t("users.calendars.deleteTitle"),
      message: t("users.calendars.deleteConfirm", { name: calendar["dav:name"] }),
    });
    if (!confirmed) return;
    try {
      await deleteUserCalendar(username, calendarId(calendar));
      toast({ title: t("users.calendars.deleted") });
      await refresh();
    } catch (err) {
      toast({ title: t("users.calendars.errorDelete"), description: <ErrorDisplayer error={err} /> });
    }
  };

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-md font-semibold hover:text-blue-600 transition"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {t("users.calendars.title")}
        {data && (
          <span className="text-sm font-normal text-gray-500">({calendars.length})</span>
        )}
      </button>

      {open && (
        <div className="mt-2 space-y-4">
          {isLoading && (
            <div className="h-[40px] rounded-2 animate-pulse bg-gray-200" />
          )}
          {error && <p className="text-red-500">Error: {error}</p>}

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
                    onClick={() => setShowCreate(true)}
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
                    calendar={calendar}
                    owner={
                      group.category === "delegated" || group.category === "subscription"
                        ? ownerEmail(calendar, ownerEmails)
                        : undefined
                    }
                    isOwned={group.category === "owner"}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    canPublicRight={canPublicRight}
                    canInvitees={canInvitees}
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

      {/* Create modal */}
      <Dialog open={showCreate} onOpenChange={(v) => { if (!v) { setShowCreate(false); setCreateForm({ ...EMPTY_CREATE }); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("users.calendars.createTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">{t("users.calendars.name")} *</label>
              <input
                type="text"
                value={createForm["dav:name"]}
                onChange={(e) => setCreateForm((f) => ({ ...f, "dav:name": e.target.value }))}
                className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t("users.calendars.color")}</label>
              <div className="flex gap-2 mt-1 items-center">
                <input
                  type="color"
                  value={createForm["apple:color"]?.trim() || "#007fd8"}
                  onChange={(e) => setCreateForm((f) => ({ ...f, "apple:color": e.target.value }))}
                  className="h-9 w-12 cursor-pointer border rounded-md"
                />
                <input
                  type="text"
                  value={createForm["apple:color"] ?? ""}
                  onChange={(e) => setCreateForm((f) => ({ ...f, "apple:color": e.target.value }))}
                  placeholder="#007fd8"
                  className="flex-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">{t("users.calendars.description")}</label>
              <input
                type="text"
                value={createForm["caldav:description"] ?? ""}
                onChange={(e) => setCreateForm((f) => ({ ...f, "caldav:description": e.target.value }))}
                className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => { setShowCreate(false); setCreateForm({ ...EMPTY_CREATE }); }}>
                {t("common.cancel")}
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={creating || !createForm["dav:name"].trim()}
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                {t("common.create")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      <Dialog open={!!editCalendar} onOpenChange={(v) => { if (!v) setEditCalendar(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("users.calendars.editTitle")} — {editCalendar?.["dav:name"]}</DialogTitle>
          </DialogHeader>
          {editCalendar && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">{t("users.calendars.name")} *</label>
                <input
                  type="text"
                  value={editForm["dav:name"] ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, "dav:name": e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t("users.calendars.color")}</label>
                <div className="flex gap-2 mt-1 items-center">
                  <input
                    type="color"
                    value={editForm["apple:color"]?.trim() || "#007fd8"}
                    onChange={(e) => setEditForm((f) => ({ ...f, "apple:color": e.target.value }))}
                    className="h-9 w-12 cursor-pointer border rounded-md"
                  />
                  <input
                    type="text"
                    value={editForm["apple:color"] ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, "apple:color": e.target.value }))}
                    placeholder="#007fd8"
                    className="flex-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">{t("users.calendars.description")}</label>
                <input
                  type="text"
                  value={editForm["caldav:description"] ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, "caldav:description": e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setEditCalendar(null)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  size="sm"
                  onClick={handleUpdate}
                  disabled={saving || !editForm["dav:name"]?.trim()}
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("users.calendars.publicRight.title")} — {publicRightCalendar?.["dav:name"]}</DialogTitle>
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
  const canAdd = status === "exists" && !isDuplicate;

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

  const handleStageAdd = () => {
    if (!canAdd) return;
    setAdditions((prev) => [...prev, { email: trimmedEmail, right: newRight }]);
    setNewEmail("");
    setNewRight("read");
  };

  const handleApply = async () => {
    const share: CalendarShareUpdate = {};
    const setEntries = [
      ...additions.map((a) => rightToShareEntry(`mailto:${a.email}`, a.right)),
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
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("users.calendars.invitees.title")} — {calendar["dav:name"]}</DialogTitle>
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
                    disabled={removed}
                    onChange={(e) => changeRight(invitee, e.target.value as CalendarRight)}
                    className={`px-2 py-1 border rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${changed ? "border-blue-400 text-blue-700" : ""}`}
                  >
                    {RIGHT_OPTIONS.map((r) => (
                      <option key={r} value={r}>{t(`users.calendars.invitees.rights.${r}`)}</option>
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
            <div className="flex gap-2">
              <input
                type="text"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleStageAdd()}
                placeholder={t("users.calendars.invitees.placeholder")}
                className="flex-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={newRight}
                onChange={(e) => setNewRight(e.target.value as CalendarRight)}
                className="px-2 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {RIGHT_OPTIONS.map((r) => (
                  <option key={r} value={r}>{t(`users.calendars.invitees.rights.${r}`)}</option>
                ))}
              </select>
              <Button size="sm" onClick={handleStageAdd} disabled={!canAdd}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="h-4">
              {trimmedEmail && status === "checking" && (
                <span className="text-xs text-gray-400">{t("common.checking")}</span>
              )}
              {trimmedEmail && status === "exists" && isDuplicate && (
                <span className="text-xs text-orange-500">{t("users.calendars.invitees.alreadyInvited")}</span>
              )}
              {trimmedEmail && status === "exists" && !isDuplicate && (
                <span className="text-xs text-green-600">{t("common.userExists")}</span>
              )}
              {trimmedEmail && status === "not_found" && (
                <span className="text-xs text-orange-500">{t("common.userNotFound")}</span>
              )}
              {trimmedEmail && status === "invalid" && (
                <span className="text-xs text-red-600">{t("common.invalidUsername")}</span>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleApply}
              disabled={saving || !hasChanges}
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
