import { useCallback, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Loader2, Minus, Pencil, Plus, Save, Trash2, Users, X } from "lucide-react";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getTeamCalendars, createTeamCalendar, updateTeamCalendar, deleteTeamCalendar, getTeamCalendarMembers, updateTeamCalendarMembers } from "../api-client";
import { TeamCalendar, TeamCalendarMember, TeamCalendarMemberRole, TeamCalendarShareSetEntry, TeamCalendarShareUpdate } from "../types";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { useCheckUserExists } from "@/hooks/use-check-user-exists";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";

const ROLE_OPTIONS: TeamCalendarMemberRole[] = ["viewer", "member", "manager"];

function roleToShareEntry(href: string, role: TeamCalendarMemberRole): TeamCalendarShareSetEntry {
  const entry: TeamCalendarShareSetEntry = { "dav:href": href };
  if (role === "viewer") entry["dav:read"] = true;
  else if (role === "member") entry["dav:read-write"] = true;
  else entry["dav:administration"] = true;
  return entry;
}

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

interface Props {
  domain: string;
  defaultOpen?: boolean;
}

export default function CalendarDomainTeamCalendars({ domain, defaultOpen = false }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canView = useIsAllowed("GET", "/domains/{domain}/team-calendars");
  const canCreate = useIsAllowed("POST", "/domains/{domain}/team-calendars");
  const canUpdate = useIsAllowed("PATCH", "/domains/{domain}/team-calendars/{teamCalendarId}");
  const canDelete = useIsAllowed("DELETE", "/domains/{domain}/team-calendars/{teamCalendarId}");
  const canViewMembers = useIsAllowed("GET", "/domains/{domain}/team-calendars/{teamCalendarId}/members");
  const canManageMembers = useIsAllowed("POST", "/domains/{domain}/team-calendars/{teamCalendarId}/members/invitee");

  const fetchTeamCalendars = useCallback(() => getTeamCalendars(domain), [domain]);
  const { data: teamCalendars, isLoading, error, refresh } = useFetchData<TeamCalendar[]>(canView ? fetchTeamCalendars : null);

  const [open, setOpen] = useState(defaultOpen);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [membersCalendar, setMembersCalendar] = useState<TeamCalendar | null>(null);
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    if (!teamCalendars) return [];
    return [...teamCalendars].sort((a, b) => a.name.localeCompare(b.name));
  }, [teamCalendars]);

  if (!canView) return null;

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_LIMIT));
  const paginated = sorted.slice((page - 1) * PAGE_LIMIT, page * PAGE_LIMIT);

  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await createTeamCalendar(domain, { name, displayName: newDisplayName.trim() || name });
      toast({ title: t("domains.teamCalendars.created") });
      setNewName("");
      setNewDisplayName("");
      setShowCreate(false);
      await refresh();
    } catch (err) {
      toast({ title: t("domains.teamCalendars.errorCreating"), description: <ErrorDisplayer error={err} /> });
    }
  };

  const startEdit = (teamCalendar: TeamCalendar) => {
    setEditingId(teamCalendar.id);
    setEditDisplayName(teamCalendar.displayName);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDisplayName("");
  };

  const handleUpdate = async (teamCalendar: TeamCalendar) => {
    const displayName = editDisplayName.trim();
    if (!displayName) return;
    try {
      await updateTeamCalendar(domain, teamCalendar.id, { displayName });
      toast({ title: t("domains.teamCalendars.updated") });
      cancelEdit();
      await refresh();
    } catch (err) {
      toast({ title: t("domains.teamCalendars.errorUpdating"), description: <ErrorDisplayer error={err} /> });
    }
  };

  const handleRemove = async (teamCalendar: TeamCalendar) => {
    const confirmed = await confirm({
      header: t("domains.teamCalendars.deleteTitle"),
      message: t("domains.teamCalendars.deleteConfirm", { name: teamCalendar.name }),
    });
    if (!confirmed) return;
    try {
      await deleteTeamCalendar(domain, teamCalendar.id);
      toast({ title: t("domains.teamCalendars.deleted") });
      await refresh();
    } catch (err) {
      toast({ title: t("domains.teamCalendars.errorDeleting"), description: <ErrorDisplayer error={err} /> });
    }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-md font-semibold hover:text-blue-600 transition"
        >
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {t("domains.teamCalendars.title")}
          {sorted.length > 0 && (
            <span className="text-sm font-normal text-gray-500">({sorted.length})</span>
          )}
        </button>
        {open && canCreate && (
          <button onClick={() => setShowCreate(!showCreate)} className="p-1 rounded-md hover:bg-gray-200 transition" title={t("domains.teamCalendars.addTooltip")}>
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2">
          {showCreate && (
            <div className="p-4 bg-blue-50 rounded-2 mb-2 space-y-2">
              <h5 className="text-sm font-semibold">{t("domains.teamCalendars.newTitle")}</h5>
              <div>
                <label className="text-xs font-medium text-gray-500">{t("domains.teamCalendars.nameLabel")} <span className="text-red-500">*</span></label>
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()} placeholder={t("domains.teamCalendars.namePlaceholder")}
                  className="mt-1 w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">{t("domains.teamCalendars.displayNameLabel")}</label>
                <input type="text" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()} placeholder={t("domains.teamCalendars.displayNamePlaceholder")}
                  className="mt-1 w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowCreate(false)}
                  className="px-4 py-2 border rounded-md text-sm hover:bg-gray-100 transition">{t("common.cancel")}</button>
                <button onClick={handleAdd} disabled={!newName.trim()}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed">{t("common.create")}</button>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            </div>
          )}
          {error && <p className="text-red-500 mt-2">{t("common.errorPrefix", { message: error })}</p>}

          {sorted.length > PAGE_LIMIT && (
            <div className="mt-2 flex justify-between items-center">
              <button onClick={() => goToPage(1)} disabled={page <= 1}
                className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed">{t("common.first")}</button>
              <button onClick={() => goToPage(page - 1)} disabled={page <= 1}
                className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed">{t("common.previous")}</button>
              <span className="text-sm font-medium text-center">{t("common.page", { page, totalPages, total: sorted.length })}</span>
              <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed">{t("common.next")}</button>
              <button onClick={() => goToPage(totalPages)} disabled={page >= totalPages}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed">{t("common.last")}</button>
            </div>
          )}

          {teamCalendars && (
            <div>
              {paginated.map((teamCalendar, index) => (
                <div key={teamCalendar.id} className="space-y-1 p-4 bg-gray-50 rounded-2 my-2 flex justify-between items-center gap-2">
                  <div className="flex-1 min-w-0">
                    {editingId === teamCalendar.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">{(page - 1) * PAGE_LIMIT + index + 1}/</span>
                        <span className="text-sm font-medium">{teamCalendar.name}</span>
                        <input type="text" value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleUpdate(teamCalendar); if (e.key === "Escape") cancelEdit(); }}
                          autoFocus placeholder={t("domains.teamCalendars.displayNamePlaceholder")}
                          className="flex-1 px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    ) : (
                      <h4 className="text-sm font-medium leading-none truncate">
                        <span className="text-gray-500 mr-2">{(page - 1) * PAGE_LIMIT + index + 1}/</span>
                        {teamCalendar.name}
                        {teamCalendar.displayName && teamCalendar.displayName !== teamCalendar.name && (
                          <span className="text-xs text-muted-foreground ml-2">{teamCalendar.displayName}</span>
                        )}
                      </h4>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {editingId === teamCalendar.id ? (
                      <>
                        <button onClick={() => handleUpdate(teamCalendar)} disabled={!editDisplayName.trim()}
                          className="p-2 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed" title={t("common.save")}>
                          <Check className="w-4 h-4 text-green-600" />
                        </button>
                        <button onClick={cancelEdit} className="p-2 rounded-md hover:bg-gray-200" title={t("common.cancel")}>
                          <X className="w-4 h-4 text-gray-600" />
                        </button>
                      </>
                    ) : (
                      <>
                        {canViewMembers && (
                          <button onClick={() => setMembersCalendar(teamCalendar)} className="p-2 rounded-md hover:bg-gray-200" title={t("domains.teamCalendars.members.tooltip")}>
                            <Users className="w-4 h-4 text-gray-600" />
                          </button>
                        )}
                        {canUpdate && (
                          <button onClick={() => startEdit(teamCalendar)} className="p-2 rounded-md hover:bg-gray-200" title={t("domains.teamCalendars.editTooltip")}>
                            <Pencil className="w-4 h-4 text-gray-600" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => handleRemove(teamCalendar)} className="p-2 rounded-md hover:bg-gray-200" title={t("domains.teamCalendars.deleteTooltip")}>
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
              {sorted.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">{t("domains.teamCalendars.empty")}</p>
              )}
            </div>
          )}
        </div>
      )}

      {membersCalendar && (
        <MembersModal
          domain={domain}
          teamCalendar={membersCalendar}
          canManage={canManageMembers}
          onClose={() => setMembersCalendar(null)}
        />
      )}
    </div>
  );
}

function MembersModal({
  domain,
  teamCalendar,
  canManage,
  onClose,
}: {
  domain: string;
  teamCalendar: TeamCalendar;
  canManage: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const fetchMembers = useCallback(
    () => getTeamCalendarMembers(domain, teamCalendar.id),
    [domain, teamCalendar.id],
  );
  const { data: members, isLoading, error, refresh } = useFetchData<TeamCalendarMember[]>(fetchMembers);

  const [removals, setRemovals] = useState<Set<string>>(new Set());
  const [changes, setChanges] = useState<Record<string, TeamCalendarMemberRole>>({});
  const [additions, setAdditions] = useState<{ username: string; role: TeamCalendarMemberRole }[]>([]);
  const [newUser, setNewUser] = useState("");
  const [newRole, setNewRole] = useState<TeamCalendarMemberRole>("viewer");
  const [saving, setSaving] = useState(false);

  const status = useCheckUserExists(newUser);
  const existing = members ?? [];

  const trimmedUser = newUser.trim();
  const isDuplicate =
    existing.some((m) => m.username === trimmedUser && !removals.has(m.username)) ||
    additions.some((a) => a.username === trimmedUser);
  const canAdd = canManage && status === "exists" && !isDuplicate;

  const toggleRemoval = (username: string) => {
    setRemovals((prev) => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username);
      else next.add(username);
      return next;
    });
  };

  const changeRole = (member: TeamCalendarMember, role: TeamCalendarMemberRole) => {
    setChanges((prev) => {
      const next = { ...prev };
      if (role === member.role) delete next[member.username];
      else next[member.username] = role;
      return next;
    });
  };

  const changedUsers = Object.keys(changes).filter((username) => !removals.has(username));
  const hasChanges = additions.length > 0 || removals.size > 0 || changedUsers.length > 0;

  const handleStageAdd = () => {
    if (!canAdd) return;
    setAdditions((prev) => [...prev, { username: trimmedUser, role: newRole }]);
    setNewUser("");
    setNewRole("viewer");
  };

  const handleApply = async () => {
    const share: TeamCalendarShareUpdate = {};
    const setEntries = [
      ...additions.map((a) => roleToShareEntry(`mailto:${a.username}`, a.role)),
      ...changedUsers.map((username) => roleToShareEntry(`mailto:${username}`, changes[username])),
    ];
    if (setEntries.length) share.set = setEntries;
    if (removals.size) share.remove = [...removals].map((username) => ({ "dav:href": `mailto:${username}` }));
    if (!share.set && !share.remove) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await updateTeamCalendarMembers(domain, teamCalendar.id, share);
      toast({ title: t("domains.teamCalendars.members.updated") });
      setRemovals(new Set());
      setChanges({});
      setAdditions([]);
      await refresh();
    } catch (err) {
      toast({ title: t("domains.teamCalendars.members.errorUpdate"), description: <ErrorDisplayer error={err} /> });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("domains.teamCalendars.members.title")} — {teamCalendar.displayName || teamCalendar.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {isLoading && <div className="h-[40px] rounded-2 animate-pulse bg-gray-200" />}
          {error && <p className="text-red-500 text-sm">{t("common.errorPrefix", { message: error })}</p>}

          {members && (
            <div className="space-y-1">
              {existing.length === 0 && additions.length === 0 && (
                <p className="text-sm text-gray-500">{t("domains.teamCalendars.members.empty")}</p>
              )}
              {existing.map((member) => {
                const removed = removals.has(member.username);
                const currentRole = changes[member.username] ?? member.role;
                const changed = member.username in changes;
                return (
                  <div key={member.username} className="flex items-center gap-2 py-1">
                    <span className={`flex-1 text-sm truncate ${removed ? "line-through text-gray-400" : ""}`}>
                      {member.username}
                    </span>
                    <select
                      value={currentRole}
                      disabled={removed || !canManage}
                      onChange={(e) => changeRole(member, e.target.value as TeamCalendarMemberRole)}
                      className={`px-2 py-1 border rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${changed ? "border-blue-400 text-blue-700" : ""}`}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>{t(`domains.teamCalendars.members.roles.${r}`)}</option>
                      ))}
                    </select>
                    {canManage && (
                      <button
                        onClick={() => toggleRemoval(member.username)}
                        className="p-1.5 rounded-md hover:bg-gray-200 transition"
                        title={removed ? t("domains.teamCalendars.members.undoRemove") : t("domains.teamCalendars.members.remove")}
                      >
                        {removed
                          ? <Plus className="w-3.5 h-3.5 text-gray-500" />
                          : <Minus className="w-3.5 h-3.5 text-red-600" />}
                      </button>
                    )}
                  </div>
                );
              })}
              {additions.map((addition, index) => (
                <div key={`add-${addition.username}-${index}`} className="flex items-center gap-2 py-1">
                  <span className="flex-1 text-sm truncate text-green-700">{addition.username}</span>
                  <span className="text-xs text-gray-500 w-28 text-right">
                    {t(`domains.teamCalendars.members.roles.${addition.role}`)}
                  </span>
                  <button
                    onClick={() => setAdditions((prev) => prev.filter((_, i) => i !== index))}
                    className="p-1.5 rounded-md hover:bg-gray-200 transition"
                    title={t("domains.teamCalendars.members.remove")}
                  >
                    <Minus className="w-3.5 h-3.5 text-red-600" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add row */}
          {canManage && (
            <div className="border-t pt-3 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newUser}
                  onChange={(e) => setNewUser(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleStageAdd()}
                  placeholder={t("domains.teamCalendars.members.placeholder")}
                  className="flex-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as TeamCalendarMemberRole)}
                  className="px-2 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>{t(`domains.teamCalendars.members.roles.${r}`)}</option>
                  ))}
                </select>
                <Button size="sm" onClick={handleStageAdd} disabled={!canAdd}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="h-4">
                {trimmedUser && status === "checking" && (
                  <span className="text-xs text-gray-400">{t("common.checking")}</span>
                )}
                {trimmedUser && status === "exists" && isDuplicate && (
                  <span className="text-xs text-orange-500">{t("domains.teamCalendars.members.alreadyMember")}</span>
                )}
                {trimmedUser && status === "exists" && !isDuplicate && (
                  <span className="text-xs text-green-600">{t("common.userExists")}</span>
                )}
                {trimmedUser && status === "not_found" && (
                  <span className="text-xs text-orange-500">{t("common.userNotFound")}</span>
                )}
                {trimmedUser && status === "invalid" && (
                  <span className="text-xs text-red-600">{t("common.invalidUsername")}</span>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            {canManage && (
              <Button size="sm" onClick={handleApply} disabled={saving || !hasChanges}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                {t("domains.teamCalendars.members.apply")}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
