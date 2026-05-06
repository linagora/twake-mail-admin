import { useState } from "react";
import { Link } from "react-router";
import { ChevronDown, ChevronRight, Loader2, Search, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import RestoreCriteriaBuilder from "../components/restore-criteria-builder";
import { DeletedMessage, RestoreCriterion, RestoreDeletedMessagesRequest } from "../types";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { RunTaskResponse } from "@/modules/common-tasks/types";

const PAGE_SIZE = 10;

interface Props {
  label: string;
  onSearch: (body: RestoreDeletedMessagesRequest) => Promise<DeletedMessage[]>;
  onRestore: (body: RestoreDeletedMessagesRequest) => Promise<RunTaskResponse>;
  canSearch?: boolean;
  canRestore?: boolean;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UserDeletedMessageVault({ label, onSearch, onRestore, canSearch = true, canRestore = true }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [criteria, setCriteria] = useState<RestoreCriterion[]>([]);
  const [limit, setLimit] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [results, setResults] = useState<DeletedMessage[] | null>(null);
  const [page, setPage] = useState(1);

  const handleSearch = async () => {
    setLoading(true);
    setResults(null);
    setPage(1);
    try {
      const body: RestoreDeletedMessagesRequest = {
        combinator: "and",
        criteria,
        ...(limit !== undefined ? { limit } : {}),
      };
      const data = await onSearch(body);
      setResults(data);
    } catch (err) {
      toast({
        title: t("users.deletedVault.errorSearch"),
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    const count = results?.length;
    const confirmed = await confirm({
      header: t("users.deletedVault.restoreTitle"),
      message: t("users.deletedVault.restoreConfirm", { count: count ?? "all matching", label }),
    });
    if (!confirmed) return;

    setRestoreLoading(true);
    try {
      const body: RestoreDeletedMessagesRequest = {
        combinator: "and",
        criteria,
        ...(limit !== undefined ? { limit } : {}),
      };
      const data = await onRestore(body);
      toast({
        title: t("users.deletedVault.restoreStarted"),
        description: (
          <p>
            Task{" "}
            <Link className="text-blue-500 hover:underline" to={`/task/${data.taskId}`}>
              {data.taskId}
            </Link>
          </p>
        ),
      });
    } catch (err) {
      toast({
        title: t("users.deletedVault.errorRestoring"),
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setRestoreLoading(false);
    }
  };

  const totalPages = results ? Math.ceil(results.length / PAGE_SIZE) || 1 : 1;
  const pageItems = results
    ? results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    : [];

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-md font-semibold hover:text-blue-600 transition"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {t("users.deletedVault.title")}
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          <RestoreCriteriaBuilder
            onChange={(c, l) => {
              setCriteria(c);
              setLimit(l);
            }}
          />

          <div className="flex items-center gap-2">
            {canSearch && (
              <Button
                size="sm"
                onClick={handleSearch}
                disabled={loading || restoreLoading}
                className="flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {t("users.deletedVault.search")}
              </Button>
            )}
            {canRestore && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRestore}
                disabled={loading || restoreLoading}
                className="flex items-center gap-2 text-green-700 border-green-600 hover:bg-green-50"
              >
                {restoreLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                {t("users.deletedVault.restore")}
              </Button>
            )}
          </div>

          {results !== null && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {t("users.deletedVault.found", { count: results.length })}
                {totalPages > 1 && ` — ${t("common.pageOf", { page, count: totalPages })}`}
              </p>

              <div className="overflow-x-auto rounded border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-10">#</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{t("users.deletedVault.subject")}</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{t("users.deletedVault.sender")}</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{t("users.deletedVault.recipients")}</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{t("users.deletedVault.deliveryDate")}</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{t("users.deletedVault.deletionDate")}</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{t("users.deletedVault.attachment")}</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{t("users.deletedVault.size")}</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{t("users.deletedVault.messageId")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-4 text-center text-muted-foreground">
                          {t("users.deletedVault.empty")}
                        </td>
                      </tr>
                    ) : (
                      pageItems.map((msg, i) => {
                        const rowNum = (page - 1) * PAGE_SIZE + i + 1;
                        return (
                          <tr key={msg.messageId} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="px-3 py-2 text-muted-foreground text-xs">{rowNum}</td>
                            <td className="px-3 py-2 max-w-[200px] truncate" title={msg.subject}>
                              {msg.subject || <span className="text-muted-foreground italic">—</span>}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{msg.sender}</td>
                            <td className="px-3 py-2 text-xs max-w-[180px]">
                              {msg.recipients.join(", ")}
                            </td>
                            <td className="px-3 py-2 text-xs whitespace-nowrap">{formatDate(msg.deliveryDate)}</td>
                            <td className="px-3 py-2 text-xs whitespace-nowrap">{formatDate(msg.deletionDate)}</td>
                            <td className="px-3 py-2 text-xs text-center">
                              {msg.hasAttachment ? t("common.yes") : t("common.no")}
                            </td>
                            <td className="px-3 py-2 text-xs whitespace-nowrap">{formatSize(msg.size)}</td>
                            <td className="px-3 py-2 font-mono text-xs text-muted-foreground whitespace-nowrap">
                              {msg.messageId}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    {t("common.previous")}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    {t("common.next")}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
