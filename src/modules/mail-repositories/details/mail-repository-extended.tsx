import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { Download, MoveHorizontal, Trash2, RefreshCw, Loader2 } from "lucide-react";
import {
  getMailRepositories,
  getMailsInRepository,
  getMailDetail,
  moveSingleMail,
  removeSingleMailFromRepository,
  reprocessSingleMail,
} from "../api-client";
import { GetMailRepositoriesResponseType, MailDetail } from "../types";
import { apiClient } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ConfirmTaskContent from "@/modules/common-tasks/components/confirm-task-content";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

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
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return d;
  }
}

export default function MailRepositoryExtended() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const repoSize = Number(searchParams.get("size")) || 0;
  const page = Number(searchParams.get("page")) || 1;
  const offset = (page - 1) * PAGE_LIMIT;
  const totalPages = Math.max(1, Math.ceil(repoSize / PAGE_LIMIT));
  const hasMore = offset + PAGE_LIMIT < repoSize;

  const [mailKeys, setMailKeys] = useState<string[]>([]);
  const [mails, setMails] = useState<MailRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sortField, setSortField] = useState<SortField>("name");
  const [sortAsc, setSortAsc] = useState(true);

  const [selectedMail, setSelectedMail] = useState<MailRow | null>(null);

  const [allRepos, setAllRepos] = useState<GetMailRepositoriesResponseType>([]);
  useEffect(() => {
    getMailRepositories().then(setAllRepos).catch(() => {});
  }, []);

  const encodedRepo = encodeURIComponent(id!);

  const fetchPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const keys = await getMailsInRepository(encodedRepo, { limit: PAGE_LIMIT, offset });
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
  }, [encodedRepo, offset]);

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

  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setSearchParams({ page: newPage.toString(), size: repoSize.toString() });
  };

  const handleDownload = async (mailKey: string) => {
    try {
      const response = await apiClient.get(
        `/mailRepositories/${encodedRepo}/mails/${mailKey}`,
        { headers: { Accept: "message/rfc822" }, responseType: "blob" }
      ) as any;
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${mailKey}.eml`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      toast({ title: "Error downloading mail", description: <ErrorDisplayer error={err} /> });
    }
  };

  const handleDelete = async (mailKey: string) => {
    const confirmed = await confirm({
      header: "Delete Mail",
      message: `Delete mail "${mailKey}" from repository ${id}?`,
    });
    if (!confirmed) return;
    try {
      await removeSingleMailFromRepository(encodedRepo, mailKey);
      toast({ title: "Mail removed" });
      await fetchPage();
    } catch (err) {
      toast({ title: "Error removing mail", description: <ErrorDisplayer error={err} /> });
    }
  };

  const handleReprocess = async (mailKey: string) => {
    const params = [
      { key: "queue", defaultValue: "spool", type: "input" as const },
      { key: "processor", defaultValue: "", type: "input" as const },
    ];
    const paramValues: { [key: string]: string } = {};
    const confirmed = await confirm({
      header: "Reprocess Mail",
      message: (
        <ConfirmTaskContent
          message={<p>Reprocess mail <b>{mailKey}</b>?</p>}
          command={`curl -XPATCH 'http://ip:port/mailRepositories/{encodedPathOfTheRepository}/mails/${mailKey}?action=reprocess&'`}
          params={params}
          getParamValues={(key, value) => {
            paramValues[key] = typeof value === "boolean" ? value.toString() : value;
          }}
        />
      ),
    });
    if (!confirmed) return;
    try {
      const { taskId } = await reprocessSingleMail(encodedRepo, mailKey, {
        queue: paramValues["queue"] || undefined,
        processor: paramValues["processor"] || undefined,
      });
      toast({
        title: "Reprocess scheduled",
        description: (
          <span>
            Task: <a href={`/task/${taskId}`} className="text-blue-500 hover:underline">{taskId}</a>
          </span>
        ),
      });
    } catch (err) {
      toast({ title: "Error reprocessing mail", description: <ErrorDisplayer error={err} /> });
    }
  };

  const handleMove = async (mailKey: string) => {
    const otherRepos = allRepos.filter((r) => r.path !== id);
    if (otherRepos.length === 0) {
      toast({ title: "No other repositories available to move this mail to" });
      return;
    }
    let targetRepo = otherRepos[0].path;
    const confirmed = await confirm({
      header: "Move Mail",
      message: (
        <div className="space-y-2 py-2">
          <p className="text-sm">
            Move mail <b>{mailKey}</b> to:
          </p>
          <select
            className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            defaultValue={otherRepos[0].path}
            onChange={(e) => {
              targetRepo = e.target.value;
            }}
          >
            {otherRepos.map((r) => (
              <option key={r.path} value={r.path}>
                {r.repository} ({r.path})
              </option>
            ))}
          </select>
        </div>
      ),
    });
    if (!confirmed) return;
    try {
      await moveSingleMail(encodedRepo, mailKey, targetRepo);
      toast({ title: "Mail moved successfully" });
      await fetchPage();
    } catch (err) {
      toast({ title: "Error moving mail", description: <ErrorDisplayer error={err} /> });
    }
  };

  const SORT_FIELDS: { key: SortField; label: string }[] = [
    { key: "name", label: "Name" },
    { key: "sender", label: "Sender" },
    { key: "recipients", label: "Recipients" },
    { key: "size", label: "Size" },
    { key: "lastUpdated", label: "Last Updated" },
  ];

  return (
    <div className="mt-4 p-4 bg-white rounded-2">
      <h3 className="text-lg font-semibold">Mail Repository — Extended View</h3>
      <p className="text-sm text-gray-500">Repository: {id}</p>

      {/* Sort controls */}
      <div className="flex items-center gap-2 mt-4 mb-3">
        <label className="text-sm font-medium">Sort by:</label>
        <select
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
          {sortAsc ? "Asc \u2191" : "Desc \u2193"}
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-8 justify-center text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading mail details...
        </div>
      )}
      {error && <p className="text-red-500 mt-2">Error: {error}</p>}

      {!loading && mails.length > 0 && (
        <>
          {/* Legend */}
          <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto_auto_auto] gap-2 text-xs font-semibold text-muted-foreground px-3 pb-2 border-b mb-1">
            <span className="w-10">#</span>
            <span>Name / Sender</span>
            <span>Recipients</span>
            <span>Last Updated</span>
            <span className="w-16 text-right">Size</span>
            <span className="w-36 text-center">Actions</span>
            <span className="w-0" />
          </div>

          <div className="space-y-1">
            {sorted.map((mail, index) => {
              const globalIndex = offset + index + 1;
              return (
                <div
                  key={mail.name}
                  className="grid grid-cols-[auto_1fr_1fr_1fr_auto_auto_auto] gap-2 items-center p-3 bg-gray-50 rounded-2 cursor-pointer hover:bg-gray-100 transition text-sm"
                  onClick={() => setSelectedMail(mail)}
                >
                  <span className="text-muted-foreground w-10">{globalIndex}.</span>
                  <div className="truncate">
                    <span className="font-medium">{mail.name}</span>
                    <br />
                    <span className="text-xs text-gray-500">{mail.sender}</span>
                  </div>
                  <span className="truncate text-xs">{mail.recipients.join(", ") || "—"}</span>
                  <span className="truncate text-xs">{formatDate(mail.lastUpdated)}</span>
                  <span className="w-16 text-right text-xs">{formatSize(mail.size)}</span>
                  <div className="w-36 flex justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleDownload(mail.name)}
                      className="p-1.5 rounded-md hover:bg-gray-200"
                      title="Download (.eml)"
                    >
                      <Download className="w-4 h-4 text-blue-600" />
                    </button>
                    <button
                      onClick={() => handleReprocess(mail.name)}
                      className="p-1.5 rounded-md hover:bg-gray-200"
                      title="Reprocess"
                    >
                      <RefreshCw className="w-4 h-4 text-green-600" />
                    </button>
                    <button
                      onClick={() => handleMove(mail.name)}
                      className="p-1.5 rounded-md hover:bg-gray-200"
                      title="Move to another repository"
                    >
                      <MoveHorizontal className="w-4 h-4 text-orange-500" />
                    </button>
                    <button
                      onClick={() => handleDelete(mail.name)}
                      className="p-1.5 rounded-md hover:bg-gray-200"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                  <span className="w-0" />
                </div>
              );
            })}
          </div>
        </>
      )}

      {!loading && mails.length === 0 && mailKeys.length === 0 && (
        <p className="text-sm text-gray-500 mt-4">No mails in this repository.</p>
      )}

      {/* Pagination */}
      {repoSize > 0 && (
        <div className="mt-4 flex justify-between items-center">
          <button
            onClick={() => goToPage(1)}
            disabled={page <= 1}
            className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            First
          </button>
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm font-medium text-center">
            Page {page} / {totalPages} — Total: {repoSize}
          </span>
          <button
            onClick={() => goToPage(page + 1)}
            disabled={!hasMore}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
          <button
            onClick={() => goToPage(totalPages)}
            disabled={!hasMore}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Last
          </button>
        </div>
      )}

      {/* JSON Detail Dialog */}
      <Dialog open={!!selectedMail} onOpenChange={(v) => !v && setSelectedMail(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mail — {selectedMail?.name}</DialogTitle>
          </DialogHeader>
          <pre className="text-xs bg-gray-50 p-4 rounded overflow-x-auto">
            {JSON.stringify(selectedMail, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
