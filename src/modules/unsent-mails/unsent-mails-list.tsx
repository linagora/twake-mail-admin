import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { Link } from "react-router";
import { RefreshCw, Trash2, Download, Search, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFetchData } from "@/hooks/use-fetch-data";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { PaginationControls } from "@/components/custom/pagination-controls";
import {
  getUnsentMailIds,
  getUnsentMail,
  deleteUnsentMail,
  resendAllUnsentMails,
  resendUnsentMail,
  downloadUnsentMail,
} from "./api-client";
import type { UnsentMailId, UnsentMail } from "./types";

const PAGE_SIZE = 50;

export default function UnsentMailsList() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();

  const canResendAll = useIsAllowed("POST", "/unsentMails");
  const canResendOne = useIsAllowed("POST", "/unsentMails/{id}");
  const canDelete = useIsAllowed("DELETE", "/unsentMails/{id}");

  const fetchIds = useCallback(() => getUnsentMailIds(), []);
  const { data: ids, isLoading, error, refresh } =
    useFetchData<UnsentMailId[]>(fetchIds);

  const [mails, setMails] = useState<Record<string, UnsentMail>>({});
  const [senderFilter, setSenderFilter] = useState("");
  const [recipientFilter, setRecipientFilter] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!ids) return;
    const active = ids.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    active.forEach(async ({ id }) => {
      if (mails[id]) return;
      try {
        const detail = await getUnsentMail(id);
        setMails((prev) => ({ ...prev, [id]: detail }));
      } catch {
        // mail may have been deleted or resent since the list was fetched
      }
    });
  }, [ids, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (!ids) return [];
    const sender = senderFilter.trim().toLowerCase();
    const recipient = recipientFilter.trim().toLowerCase();
    return ids.filter(({ id }) => {
      const mail = mails[id];
      if (!mail) return !sender && !recipient;
      const fromMatch = !sender || (mail.mailFrom ?? "").toLowerCase().includes(sender);
      const toMatch =
        !recipient || mail.rcptTo.some((r) => r.toLowerCase().includes(recipient));
      return fromMatch && toMatch;
    });
  }, [ids, mails, senderFilter, recipientFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const handleResendAll = async () => {
    const confirmed = await confirm({
      header: t("unsentMails.resendAllTitle"),
      message: t("unsentMails.resendAllConfirm"),
    });
    if (!confirmed) return;
    try {
      const { taskId } = await resendAllUnsentMails();
      toast({
        title: t("unsentMails.taskSubmitted"),
        description: (
          <Link className="text-blue-500 hover:underline" to={`/task/${taskId}`}>
            {t("common.taskLink", { taskId })}
          </Link>
        ),
      });
    } catch (err) {
      toast({
        title: t("unsentMails.errorResending"),
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  const handleResendOne = async (id: string, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const confirmed = await confirm({
      header: t("unsentMails.resendTitle"),
      message: t("unsentMails.resendConfirm", { id }),
    });
    if (!confirmed) return;
    try {
      const { taskId } = await resendUnsentMail(id);
      toast({
        title: t("unsentMails.taskSubmitted"),
        description: (
          <Link className="text-blue-500 hover:underline" to={`/task/${taskId}`}>
            {t("common.taskLink", { taskId })}
          </Link>
        ),
      });
      refresh();
    } catch (err) {
      toast({
        title: t("unsentMails.errorResending"),
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  const handleDelete = async (id: string, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const confirmed = await confirm({
      header: t("unsentMails.deleteTitle"),
      message: t("unsentMails.deleteConfirm", { id }),
    });
    if (!confirmed) return;
    try {
      await deleteUnsentMail(id);
      toast({ title: t("unsentMails.deleted") });
      setMails((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      refresh();
    } catch (err) {
      toast({
        title: t("unsentMails.errorDeleting"),
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  const handleDownload = async (id: string, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await downloadUnsentMail(id);
    } catch (err) {
      toast({
        title: t("unsentMails.errorDownloading"),
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  const resetPage = () => setPage(1);

  return (
    <div>
      {canResendAll && (
        <button
          onClick={handleResendAll}
          className="mb-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
          {t("unsentMails.resendAll")}
        </button>
      )}

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="flex-1 flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            type="text"
            value={senderFilter}
            onChange={(e) => {
              setSenderFilter(e.target.value);
              resetPage();
            }}
            placeholder={t("unsentMails.searchSender")}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex-1 flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            type="text"
            value={recipientFilter}
            onChange={(e) => {
              setRecipientFilter(e.target.value);
              resetPage();
            }}
            placeholder={t("unsentMails.searchRecipient")}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {isLoading && <p className="text-gray-500">{t("common.loading")}</p>}
      {error && <p className="text-red-500">{error}</p>}

      {filtered.length > 0 && (
        <PaginationControls
          onFirst={() => setPage(1)}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          onLast={() => setPage(totalPages)}
          disabledPrev={page <= 1}
          disabledNext={page >= totalPages}
          label={t("common.page", {
            page,
            totalPages,
            total: filtered.length,
          })}
        />
      )}

      <div>
        {pageItems.map(({ id }, index) => {
          const mail = mails[id];
          return (
            <Link
              key={id}
              to={`/unsent-mails/mail/${id}`}
              className="block space-y-1 p-4 bg-white rounded-2 my-2 hover:bg-gray-50 transition"
            >
              <div className="flex justify-between items-center">
                <div className="min-w-0">
                  <h4 className="text-sm font-medium leading-none">
                    <span className="text-gray-400 mr-2">
                      {pageStart + index + 1}/
                    </span>
                    {id}
                  </h4>
                  <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-4">
                    <span>
                      <span className="font-medium">{t("unsentMails.date")}:</span>{" "}
                      {mail ? new Date(mail.createdAt).toLocaleString() : t("common.loading")}
                    </span>
                    <span>
                      <span className="font-medium">{t("unsentMails.sender")}:</span>{" "}
                      {mail ? (mail.mailFrom ?? "—") : t("common.loading")}
                    </span>
                    <span>
                      <span className="font-medium">{t("unsentMails.recipient")}:</span>{" "}
                      {mail ? mail.rcptTo.join(", ") : t("common.loading")}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {canResendOne && (
                    <button
                      className="p-2 rounded-md hover:bg-gray-200"
                      title={t("unsentMails.resendTooltip")}
                      onClick={(e) => handleResendOne(id, e)}
                    >
                      <RefreshCw className="w-4 h-4 text-blue-600" />
                    </button>
                  )}
                  <button
                    className="p-2 rounded-md hover:bg-gray-200"
                    title={t("unsentMails.downloadTooltip")}
                    onClick={(e) => handleDownload(id, e)}
                  >
                    <Download className="w-4 h-4 text-blue-600" />
                  </button>
                  {canDelete && (
                    <button
                      className="p-2 rounded-md hover:bg-gray-200"
                      title={t("unsentMails.deleteTooltip")}
                      onClick={(e) => handleDelete(id, e)}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
