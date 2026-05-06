import { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { useCheckUserExists } from "@/hooks/use-check-user-exists";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { getTeamMailboxExtraSenders, addTeamMailboxExtraSender, removeTeamMailboxExtraSender } from "../api-client";
import ErrorDisplayer from "@/components/custom/error-displayer";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

interface Props {
  domain: string;
  mailbox: string;
}

export default function TeamMailboxExtraSenders({ domain, mailbox }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canView = useIsAllowed("GET", "/domains/{domain}/team-mailboxes/{mailbox}/extraSenders");
  const canAdd = useIsAllowed("PUT", "/domains/{domain}/team-mailboxes/{mailbox}/extraSenders/{username}");
  const canRemove = useIsAllowed("DELETE", "/domains/{domain}/team-mailboxes/{mailbox}/extraSenders/{username}");

  const fetchSenders = useCallback(
    () => getTeamMailboxExtraSenders(domain, mailbox),
    [domain, mailbox]
  );
  const { data: senders, isLoading, error, refresh } = useFetchData<string[]>(canView ? fetchSenders : null);

  const [open, setOpen] = useState(true);
  const [page, setPage] = useState(1);
  const [newSender, setNewSender] = useState("");
  const senderStatus = useCheckUserExists(newSender);

  const sorted = useMemo(() => {
    if (!senders) return [];
    return [...senders].sort((a, b) => a.localeCompare(b));
  }, [senders]);

  if (!canView) return null;

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_LIMIT));
  const paginated = sorted.slice((page - 1) * PAGE_LIMIT, page * PAGE_LIMIT);

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
  };

  const handleAdd = async () => {
    const username = newSender.trim();
    if (!username) return;
    try {
      await addTeamMailboxExtraSender(domain, mailbox, username);
      toast({ title: t("domains.extraSenders.added") });
      setNewSender("");
      await refresh();
    } catch (err) {
      toast({ title: t("domains.extraSenders.errorAdding"), description: <ErrorDisplayer error={err} /> });
    }
  };

  const handleRemove = async (username: string) => {
    const confirmed = await confirm({
      header: t("domains.extraSenders.removeTitle"),
      message: t("domains.extraSenders.removeConfirm", { username }),
    });
    if (!confirmed) return;
    try {
      await removeTeamMailboxExtraSender(domain, mailbox, username);
      toast({ title: t("domains.extraSenders.removed") });
      await refresh();
    } catch (err) {
      toast({ title: t("domains.extraSenders.errorRemoving"), description: <ErrorDisplayer error={err} /> });
    }
  };

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-md font-semibold w-full text-left"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {t("domains.extraSenders.title")}
        {senders && <span className="text-sm font-normal text-gray-500">({senders.length})</span>}
      </button>

      {open && (<>
        {/* Add sender */}
        {canAdd && (<div className="flex gap-2 mt-3 mb-4">
          <input
            type="text"
            value={newSender}
            onChange={(e) => setNewSender(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="user@domain.tld"
            className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {senderStatus === "checking" && (
            <span className="flex items-center text-xs text-gray-400 whitespace-nowrap">{t("common.checking")}</span>
          )}
          {senderStatus === "exists" && (
            <span className="flex items-center gap-1 text-xs text-green-600 whitespace-nowrap">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
              {t("common.userExists")}
            </span>
          )}
          {senderStatus === "not_found" && (
            <span className="flex items-center gap-1 text-xs text-orange-500 whitespace-nowrap">
              <span className="inline-block w-2 h-2 rounded-full bg-orange-400" />
              {t("common.userNotFound")}
            </span>
          )}
          {senderStatus === "invalid" && (
            <span className="flex items-center gap-1 text-xs text-red-600 whitespace-nowrap">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
              {t("common.invalidUsername")}
            </span>
          )}
          <button
            onClick={handleAdd}
            disabled={!newSender.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("common.add")}
          </button>
        </div>)}

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
          </div>
        )}
        {error && <p className="text-red-500 mt-2">Error: {error}</p>}

        {/* Pagination */}
        {sorted.length > 0 && (
          <div className="mt-2 flex justify-between items-center">
            <button
              onClick={() => goToPage(1)}
              disabled={page <= 1}
              className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("common.first")}
            </button>
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("common.previous")}
            </button>
            <span className="text-sm font-medium text-center">
              {t("common.page", { page, totalPages, total: sorted.length })}
            </span>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("common.next")}
            </button>
            <button
              onClick={() => goToPage(totalPages)}
              disabled={page >= totalPages}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("common.last")}
            </button>
          </div>
        )}

        {/* Sender list */}
        <div>
          {paginated.map((username, index) => (
            <div
              key={username}
              className="space-y-1 p-4 bg-gray-50 rounded-2 my-2 flex justify-between items-center"
            >
              <h4 className="text-sm font-medium leading-none">
                <span className="text-gray-500 mr-2">{(page - 1) * PAGE_LIMIT + index + 1}/</span>
                {username}
              </h4>
              {canRemove && (
                <button
                  onClick={() => handleRemove(username)}
                  className="p-2 rounded-md hover:bg-gray-200"
                  title={t("domains.extraSenders.removeTooltip")}
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              )}
            </div>
          ))}
          {senders && senders.length === 0 && (
            <p className="mt-2 text-sm text-gray-500">{t("domains.extraSenders.empty")}</p>
          )}
        </div>
      </>)}
    </div>
  );
}
