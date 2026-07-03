import { useCallback, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Pencil, Plus, Trash2, X } from "lucide-react";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getTeamCalendars, createTeamCalendar, updateTeamCalendar, deleteTeamCalendar } from "../api-client";
import { TeamCalendar } from "../types";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { useTranslation } from "react-i18next";

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

  const fetchTeamCalendars = useCallback(() => getTeamCalendars(domain), [domain]);
  const { data: teamCalendars, isLoading, error, refresh } = useFetchData<TeamCalendar[]>(canView ? fetchTeamCalendars : null);

  const [open, setOpen] = useState(defaultOpen);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
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
    </div>
  );
}
