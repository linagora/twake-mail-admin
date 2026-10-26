import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { Download, MoveHorizontal, Trash2, RefreshCw, Loader2 } from "lucide-react";
import MailFiltersPanel, { MailFilters } from "./mail-filters-panel";
import {
  downloadMailFromRepository,
  getMailRepositories,
  getMailsInRepository,
  getMailDetail,
  moveSingleMail,
  removeSingleMailFromRepository,
  reprocessSingleMail,
} from "../api-client";
import { GetMailRepositoriesResponseType, MailDetail, MailRepository } from "../types";
import { useToast } from "@/hooks/use-toast";
import { useTaskCreatedToast } from "@/hooks/use-task-created-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { useReturnFocus } from "@/hooks/use-return-focus";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ConfirmTaskContent from "@/modules/common-tasks/components/confirm-task-content";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { PaginationControls } from "@/components/custom/pagination-controls";
import { currentLocale } from "@/i18n/locale";
import { formatByteSize } from "@/i18n/format-size";
import { EXTENDED_PAGE_LIMIT } from "./page-limits";
import Header from "@/components/custom/header";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import EmptyState from "@/components/custom/empty-state";
import { taskTypeLabel } from "@/modules/tasks/task-summary";

const PAGE_LIMIT = EXTENDED_PAGE_LIMIT;

type SortField = "name" | "sender" | "recipients" | "size" | "lastUpdated";

interface MailRow extends MailDetail {
  size: number;
}

function compareValues(a: string | number | null, b: string | number | null, asc: boolean): number {
  if (a === null && b === null) return 0;
  if (a === null) return asc ? 1 : -1;
  if (b === null) return asc ? -1 : 1;
  if (typeof a === "number" && typeof b === "number") return asc ? a - b : b - a;
  const sa = String(a);
  const sb = String(b);
  return asc ? sa.localeCompare(sb) : sb.localeCompare(sa);
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "—";
  return formatByteSize(bytes);
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString(currentLocale());
  } catch {
    return d;
  }
}

export default function MailRepositoryExtended() {
  const { t } = useTranslation();
  const sortFieldId = useId();
  const { toast } = useToast();
  const toastTaskCreated = useTaskCreatedToast();
  const confirm = useConfirm();
  const { id } = useParams();
  const breadcrumbs = useBreadcrumbs();
  const [searchParams, setSearchParams] = useSearchParams();
  const canViewMail = useIsAllowed("GET", "/mailRepositories/{encodedPath}/mails/{mailKey}");
  const canPatchMail = useIsAllowed("PATCH", "/mailRepositories/{encodedPath}/mails/{mailKey}");
  const canDeleteMail = useIsAllowed("DELETE", "/mailRepositories/{encodedPath}/mails/{mailKey}");

  const repoSize = Number(searchParams.get("size")) || 0;
  const page = Number(searchParams.get("page")) || 1;
  const offset = (page - 1) * PAGE_LIMIT;
  const totalPages = Math.max(1, Math.ceil(repoSize / PAGE_LIMIT));
  const hasMore = offset + PAGE_LIMIT < repoSize;

  const activeFilters: MailFilters = {
    sender: searchParams.get("sender") || "",
    recipient: searchParams.get("recipient") || "",
    updatedBefore: searchParams.get("updatedBefore") || "",
    updatedAfter: searchParams.get("updatedAfter") || "",
    remoteAddress: searchParams.get("remoteAddress") || "",
    remoteHost: searchParams.get("remoteHost") || "",
  };

  const [mailKeys, setMailKeys] = useState<string[]>([]);
  const [mails, setMails] = useState<MailRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sortField, setSortField] = useState<SortField>("name");
  const [sortAsc, setSortAsc] = useState(true);

  const [selectedMail, setSelectedMail] = useState<MailRow | null>(null);
  // The detail modal is controlled: bring the focus back to the row control that opened it
  const { rememberFocus, restoreFocus } = useReturnFocus();
  const openMail = (mail: MailRow) => {
    rememberFocus();
    setSelectedMail(mail);
  };

  const [allRepos, setAllRepos] = useState<GetMailRepositoriesResponseType>([]);
  useEffect(() => {
    getMailRepositories().then(setAllRepos).catch(() => {});
  }, []);

  const encodedRepo = encodeURIComponent(id!);

  const fetchPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const keys = await getMailsInRepository(encodedRepo, {
        limit: PAGE_LIMIT,
        offset,
        sender: activeFilters.sender || undefined,
        recipient: activeFilters.recipient || undefined,
        updatedBefore: activeFilters.updatedBefore || undefined,
        updatedAfter: activeFilters.updatedAfter || undefined,
        remoteAddress: activeFilters.remoteAddress || undefined,
        remoteHost: activeFilters.remoteHost || undefined,
      });
      setMailKeys(keys);

      const details = await Promise.all(
        keys.map(async (key) => {
          try {
            const detail = await getMailDetail(encodedRepo, key);
            // Estimate size from JSON payload
            const size = JSON.stringify(detail).length;
            return { ...detail, size } as MailRow;
          } catch {
            return {
              name: key,
              sender: "—",
              recipients: [],
              state: "",
              error: "",
              remoteHost: "",
              remoteAddr: "",
              lastUpdated: null,
              size: 0,
            } as MailRow;
          }
        })
      );
      setMails(details);
    } catch (err: any) {
      setError(err?.message || "Failed to load mails");
    } finally {
      setLoading(false);
    }
  }, [
    encodedRepo,
    offset,
    activeFilters.sender,
    activeFilters.recipient,
    activeFilters.updatedBefore,
    activeFilters.updatedAfter,
    activeFilters.remoteAddress,
    activeFilters.remoteHost,
  ]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  const sorted = useMemo(() => {
    const copy = [...mails];
    copy.sort((a, b) => {
      let va: string | number | null;
      let vb: string | number | null;
      switch (sortField) {
        case "name": va = a.name; vb = b.name; break;
        case "sender": va = a.sender; vb = b.sender; break;
        case "recipients": va = a.recipients.join(", "); vb = b.recipients.join(", "); break;
        case "size": va = a.size; vb = b.size; break;
        case "lastUpdated": va = a.lastUpdated; vb = b.lastUpdated; break;
        default: va = a.name; vb = b.name;
      }
      return compareValues(va, vb, sortAsc);
    });
    return copy;
  }, [mails, sortField, sortAsc]);

  const buildParams = (overrides: Record<string, string> = {}): Record<string, string> => {
    const params: Record<string, string> = { page: page.toString(), size: repoSize.toString(), ...overrides };
    if (activeFilters.sender) params.sender = activeFilters.sender;
    if (activeFilters.recipient) params.recipient = activeFilters.recipient;
    if (activeFilters.updatedBefore) params.updatedBefore = activeFilters.updatedBefore;
    if (activeFilters.updatedAfter) params.updatedAfter = activeFilters.updatedAfter;
    if (activeFilters.remoteAddress) params.remoteAddress = activeFilters.remoteAddress;
    if (activeFilters.remoteHost) params.remoteHost = activeFilters.remoteHost;
    return params;
  };

  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setSearchParams(buildParams({ page: newPage.toString() }));
  };

  const handleApplyFilters = (newFilters: MailFilters) => {
    const params: Record<string, string> = { page: "1", size: repoSize.toString() };
    if (newFilters.sender) params.sender = newFilters.sender;
    if (newFilters.recipient) params.recipient = newFilters.recipient;
    if (newFilters.updatedBefore) params.updatedBefore = newFilters.updatedBefore;
    if (newFilters.updatedAfter) params.updatedAfter = newFilters.updatedAfter;
    if (newFilters.remoteAddress) params.remoteAddress = newFilters.remoteAddress;
    if (newFilters.remoteHost) params.remoteHost = newFilters.remoteHost;
    setSearchParams(params);
  };

  const handleDownload = async (mailKey: string) => {
    try {
      await downloadMailFromRepository(encodedRepo, mailKey);
    } catch (err) {
      toast({ title: "Error downloading mail", description: <ErrorDisplayer error={err} /> });
    }
  };

  const handleDelete = async (mailKey: string) => {
    const confirmed = await confirm({
      header: t("mailRepositories.deleteMailHeader"),
      destructive: true,
      confirmLabel: t("common.delete"),
      message: t("mailRepositories.deleteMailConfirm", { mailKey, id }),
    });
    if (!confirmed) return;
    try {
      await removeSingleMailFromRepository(encodedRepo, mailKey);
      toast({ title: t("mailRepositories.mailRemoved") });
      await fetchPage();
    } catch (err) {
      toast({ title: t("mailRepositories.errorRemovingMail"), description: <ErrorDisplayer error={err} /> });
    }
  };

  const handleReprocess = async (mailKey: string) => {
    const params = [
      { key: "queue", defaultValue: "spool", type: "input" as const },
      { key: "processor", defaultValue: "", type: "input" as const },
    ];
    const paramValues: { [key: string]: string } = {};
    await confirm({
      header: t("mailRepositories.reprocessMailHeader"),
      message: (
        <ConfirmTaskContent
          message={<p>{t("mailRepositories.reprocessMailConfirm", { mailKey })}</p>}
          command={`curl -XPATCH '/mailRepositories/${encodedRepo}/mails/${mailKey}?action=reprocess'`}
          params={params}
          getParamValues={(key, value) => {
            paramValues[key] = typeof value === "boolean" ? value.toString() : value;
          }}
        />
      ),
      action: async () => {
        const { taskId } = await reprocessSingleMail(encodedRepo, mailKey, {
          queue: paramValues["queue"] || undefined,
          processor: paramValues["processor"] || undefined,
        });
        toastTaskCreated(taskId, t("mailRepositories.reprocessScheduled"), taskTypeLabel(t, "reprocessing-one"));
      },
    });
  };

  const handleMove = async (mailKey: string) => {
    const otherRepos = allRepos.filter((r) => r.repository !== id);
    if (otherRepos.length === 0) {
      toast({ title: t("mailRepositories.noOtherRepositoriesForMail") });
      return;
    }
    let targetRepo: MailRepository = otherRepos[0];
    const confirmed = await confirm({
      header: t("mailRepositories.moveMailHeader"),
      message: (
        <div className="space-y-2 py-2">
          <p className="text-sm">
            {t("mailRepositories.moveMailConfirm", { mailKey })}
          </p>
          <select
            className="w-full border rounded px-3 py-1.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            defaultValue={otherRepos[0].path}
            onChange={(e) => {
              targetRepo = otherRepos.find((r) => r.path === e.target.value) ?? targetRepo;
            }}
          >
            {otherRepos.map((r) => (
              <option key={r.path} value={r.path}>
                {r.repository}
              </option>
            ))}
          </select>
        </div>
      ),
    });
    if (!confirmed) return;
    try {
      await moveSingleMail(encodedRepo, mailKey, targetRepo);
      toast({ title: t("mailRepositories.mailMovedSuccess") });
      await fetchPage();
    } catch (err) {
      toast({ title: t("mailRepositories.errorMovingMail"), description: <ErrorDisplayer error={err} /> });
    }
  };

  const SORT_FIELDS: { key: SortField; label: string }[] = [
    { key: "name", label: t("mailRepositories.sortName") },
    { key: "sender", label: t("mailRepositories.sortSender") },
    { key: "recipients", label: t("mailRepositories.sortRecipients") },
    { key: "size", label: t("mailRepositories.sortSize") },
    { key: "lastUpdated", label: t("mailRepositories.sortLastUpdated") },
  ];

  return (
    <>
    <Header
      headerTitle={t("mailRepositories.extendedTitle")}
      documentTitle={`${t("mailRepositories.extendedTitle")} — ${id}`}
      breadcrumb={[...breadcrumbs.mailRepositories(), { label: id!, to: `/mail-repositories/repository/${encodeURIComponent(id!)}` }]}
    />
    <div className="mt-4 p-4 bg-white rounded-2">

      <MailFiltersPanel filters={activeFilters} onApply={handleApplyFilters} />

      {/* Sort controls */}
      <div className="flex items-center gap-2 mt-4 mb-3">
        <label htmlFor={sortFieldId} className="text-sm font-medium">{t("mailRepositories.sortBy")}</label>
        <select
          id={sortFieldId}
          className="border rounded px-2 py-1 text-sm"
          value={sortField}
          onChange={(e) => setSortField(e.target.value as SortField)}
        >
          {SORT_FIELDS.map((f) => (
            <option key={f.key} value={f.key}>{f.label}</option>
          ))}
        </select>
        <button
          className="border rounded px-2 py-1 text-sm"
          onClick={() => setSortAsc(!sortAsc)}
        >
          {sortAsc ? t("mailRepositories.sortAsc") : t("mailRepositories.sortDesc")}
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-8 justify-center text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          {t("mailRepositories.loadingMailDetails")}
        </div>
      )}
      {error && <p className="text-red-500 mt-2">{t("common.errorPrefix", { message: error })}</p>}

      {!loading && mails.length > 0 && (
        <>
          {/* Legend */}
          <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto_auto_auto] gap-2 text-xs font-semibold text-muted-foreground px-3 pb-2 border-b mb-1">
            <span className="w-10">#</span>
            <span>{t("mailRepositories.colNameSender")}</span>
            <span>{t("mailRepositories.colRecipients")}</span>
            <span>{t("mailRepositories.colLastUpdated")}</span>
            <span className="w-16 text-right">{t("mailRepositories.colSize")}</span>
            <span className="w-36 text-center">{t("mailRepositories.colActions")}</span>
            <span className="w-0" />
          </div>

          <div className="space-y-1">
            {sorted.map((mail, index) => {
              const globalIndex = offset + index + 1;
              return (
                <div
                  key={mail.name}
                  className="grid grid-cols-[auto_1fr_1fr_1fr_auto_auto_auto] gap-2 items-center p-3 bg-gray-50 rounded-2 cursor-pointer hover:bg-gray-100 transition text-sm"
                  onClick={() => openMail(mail)}
                >
                  <span className="text-muted-foreground w-10">{globalIndex}.</span>
                  <div className="truncate">
                    {/* A real button (the row itself holds the action buttons) so the detail opens from the keyboard */}
                    <button
                      type="button"
                      className="font-medium text-left rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      onClick={(e) => { e.stopPropagation(); openMail(mail); }}
                    >
                      {mail.name}
                    </button>
                    <br />
                    <span className="text-xs text-gray-500">{mail.sender}</span>
                  </div>
                  <span className="truncate text-xs">{mail.recipients.join(", ") || "—"}</span>
                  <span className="truncate text-xs">{formatDate(mail.lastUpdated)}</span>
                  <span className="w-16 text-right text-xs">{formatSize(mail.size)}</span>
                  <div className="w-36 flex justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {canViewMail && (
                      <button
                        onClick={() => handleDownload(mail.name)}
                        className="p-1.5 rounded-md hover:bg-gray-200"
                        title={t("mailRepositories.downloadTooltip")}
                      >
                        <Download className="w-4 h-4 text-blue-600" />
                      </button>
                    )}
                    {canPatchMail && (
                      <button
                        onClick={() => handleReprocess(mail.name)}
                        className="p-1.5 rounded-md hover:bg-gray-200"
                        title={t("mailRepositories.reprocessMailTooltip")}
                      >
                        <RefreshCw className="w-4 h-4 text-green-600" />
                      </button>
                    )}
                    {canPatchMail && (
                      <button
                        onClick={() => handleMove(mail.name)}
                        className="p-1.5 rounded-md hover:bg-gray-200"
                        title={t("mailRepositories.moveMailTooltip")}
                      >
                        <MoveHorizontal className="w-4 h-4 text-orange-500" />
                      </button>
                    )}
                    {canDeleteMail && (
                      <button
                        onClick={() => handleDelete(mail.name)}
                        className="p-1.5 rounded-md hover:bg-gray-200"
                        title={t("mailRepositories.deleteMailTooltip")}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    )}
                  </div>
                  <span className="w-0" />
                </div>
              );
            })}
          </div>
        </>
      )}

      {!loading && mails.length === 0 && mailKeys.length === 0 && (
        <EmptyState title={t("mailRepositories.noMails")} />
      )}

      {/* Pagination */}
      {repoSize > 0 && (
        <PaginationControls
          onFirst={() => goToPage(1)}
          onPrev={() => goToPage(page - 1)}
          onNext={() => goToPage(page + 1)}
          onLast={() => goToPage(totalPages)}
          disabledPrev={page <= 1}
          disabledNext={!hasMore}
          label={t("common.page", { page, totalPages, total: repoSize })}
          total={repoSize}
        />
      )}

      {/* JSON Detail Dialog */}
      <Dialog open={!!selectedMail} onOpenChange={(v) => !v && setSelectedMail(null)}>
        <DialogContent aria-describedby={undefined} className="max-w-2xl" onCloseAutoFocus={restoreFocus}>
          <DialogHeader>
            <DialogTitle>{t("mailRepositories.mailDetailTitle", { name: selectedMail?.name })}</DialogTitle>
          </DialogHeader>
          <pre className="text-xs bg-gray-50 p-4 rounded overflow-x-auto">
            {JSON.stringify(selectedMail, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
}
