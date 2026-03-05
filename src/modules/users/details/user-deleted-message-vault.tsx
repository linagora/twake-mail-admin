import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Search, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import RestoreCriteriaBuilder from "../components/restore-criteria-builder";
import { searchDeletedMessages, restoreDeletedMessages } from "../api-client";
import { DeletedMessage, RestoreCriterion, RestoreDeletedMessagesRequest } from "../types";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";

const PAGE_SIZE = 10;

interface Props {
  username: string;
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

export default function UserDeletedMessageVault({ username }: Props) {
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
      const data = await searchDeletedMessages(username, body);
      setResults(data);
    } catch (err) {
      toast({
        title: "Error searching deleted messages",
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    const count = results?.length;
    const confirmed = await confirm({
      header: "Restore deleted messages",
      message: (
        <p>
          Restore <strong>{count ?? "all matching"}</strong> message{count !== 1 ? "s" : ""} for <strong>{username}</strong>?
          This will enqueue a background task.
        </p>
      ),
    });
    if (!confirmed) return;

    setRestoreLoading(true);
    try {
      const body: RestoreDeletedMessagesRequest = {
        combinator: "and",
        criteria,
        ...(limit !== undefined ? { limit } : {}),
      };
      const data = await restoreDeletedMessages(username, body);
      toast({
        title: "Restore task started",
        description: (
          <p>
            Task{" "}
            <a className="text-blue-500 hover:underline" href={`/task/${data.taskId}`}>
              {data.taskId}
            </a>
          </p>
        ),
      });
    } catch (err) {
      toast({
        title: "Error restoring deleted messages",
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
        Deleted Message Vault
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
            <Button
              size="sm"
              onClick={handleSearch}
              disabled={loading || restoreLoading}
              className="flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRestore}
              disabled={loading || restoreLoading}
              className="flex items-center gap-2 text-green-700 border-green-600 hover:bg-green-50"
            >
              {restoreLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              Restore
            </Button>
          </div>

          {results !== null && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {results.length} message{results.length !== 1 ? "s" : ""} found
                {totalPages > 1 && ` — page ${page} / ${totalPages}`}
              </p>

              <div className="overflow-x-auto rounded border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-10">#</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Subject</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Sender</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Recipients</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Delivery date</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Deletion date</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Attachment</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Size</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Message ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-4 text-center text-muted-foreground">
                          No messages match the criteria.
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
                              {msg.hasAttachment ? "Yes" : "No"}
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
                    Previous
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
                    Next
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
