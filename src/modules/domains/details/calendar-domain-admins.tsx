import { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getDomainAdmins, addDomainAdmin, removeDomainAdmin } from "../api-client";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { useCheckUserExists } from "@/hooks/use-check-user-exists";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { useTranslation } from "react-i18next";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

interface Props {
  domain: string;
  defaultOpen?: boolean;
}

export default function CalendarDomainAdmins({ domain, defaultOpen = false }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canView = useIsAllowed("GET", "/domains/{domain}/admins");
  const canAdd = useIsAllowed("PUT", "/domains/{domain}/admins/{username}");
  const canRemove = useIsAllowed("DELETE", "/domains/{domain}/admins/{username}");

  const fetchAdmins = useCallback(() => getDomainAdmins(domain), [domain]);
  const { data: admins, isLoading, error, refresh } = useFetchData<string[]>(canView ? fetchAdmins : null);

  const [open, setOpen] = useState(defaultOpen);
  const [showAddInput, setShowAddInput] = useState(false);
  const [newAdmin, setNewAdmin] = useState("");
  const [page, setPage] = useState(1);
  const adminStatus = useCheckUserExists(newAdmin);

  const sorted = useMemo(() => {
    if (!admins) return [];
    return [...admins].sort((a, b) => a.localeCompare(b));
  }, [admins]);

  if (!canView) return null;

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_LIMIT));
  const paginated = sorted.slice((page - 1) * PAGE_LIMIT, page * PAGE_LIMIT);

  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  const handleAdd = async () => {
    const username = newAdmin.trim();
    if (!username) return;
    try {
      await addDomainAdmin(domain, username);
      toast({ title: t("domains.calendarAdmins.added") });
      setNewAdmin("");
      setShowAddInput(false);
      await refresh();
    } catch (err) {
      toast({
        title: t("domains.calendarAdmins.errorAdding"),
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  const handleRemove = async (username: string) => {
    const confirmed = await confirm({
      header: t("domains.calendarAdmins.removeTitle"),
      message: t("domains.calendarAdmins.removeConfirm", { username, domain }),
    });
    if (!confirmed) return;
    try {
      await removeDomainAdmin(domain, username);
      toast({ title: t("domains.calendarAdmins.removed") });
      await refresh();
    } catch (err) {
      toast({
        title: t("domains.calendarAdmins.errorRemoving"),
        description: <ErrorDisplayer error={err} />,
      });
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
          {t("domains.calendarAdmins.title")}
          {admins && (
            <span className="text-sm font-normal text-gray-500">
              ({admins.length})
            </span>
          )}
        </button>
        {open && canAdd && (
          <button
            onClick={() => setShowAddInput(!showAddInput)}
            className="p-1 rounded-md hover:bg-gray-200 transition"
            title={t("domains.calendarAdmins.addTooltip")}
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2">
          {showAddInput && (
            <div className="flex gap-2 mt-2 mb-2">
              <input
                type="text"
                value={newAdmin}
                onChange={(e) => setNewAdmin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder={t("domains.calendarAdmins.addPlaceholder")}
                className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {adminStatus === "checking" && (
                <span className="flex items-center text-xs text-gray-400 whitespace-nowrap">{t("common.checking")}</span>
              )}
              {adminStatus === "exists" && (
                <span className="flex items-center gap-1 text-xs text-green-600 whitespace-nowrap">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                  {t("common.userExists")}
                </span>
              )}
              {adminStatus === "not_found" && (
                <span className="flex items-center gap-1 text-xs text-orange-500 whitespace-nowrap">
                  <span className="inline-block w-2 h-2 rounded-full bg-orange-400" />
                  {t("common.userNotFound")}
                </span>
              )}
              {adminStatus === "invalid" && (
                <span className="flex items-center gap-1 text-xs text-red-600 whitespace-nowrap">
                  <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                  {t("common.invalidUsername")}
                </span>
              )}
              <button
                onClick={handleAdd}
                disabled={!newAdmin.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("common.add")}
              </button>
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

          <p className="mt-2 mb-2 text-sm text-gray-500 italic">
            {t("domains.calendarAdmins.roleNote")}
          </p>

          {admins && (
            <div>
              {paginated.map((admin, index) => (
                <div key={admin} className="space-y-1 p-4 bg-gray-50 rounded-2 my-2 flex justify-between items-center">
                  <h4 className="text-sm font-medium leading-none">
                    <span className="text-gray-500 mr-2">{(page - 1) * PAGE_LIMIT + index + 1}/</span>
                    {admin}
                  </h4>
                  {canRemove && (
                    <button onClick={() => handleRemove(admin)} className="p-2 rounded-md hover:bg-gray-200" title={t("domains.calendarAdmins.removeTooltip")}>
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  )}
                </div>
              ))}
              {admins.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">{t("domains.calendarAdmins.empty")}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
