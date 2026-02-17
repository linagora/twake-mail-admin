import { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Eraser, Plus, Trash2 } from "lucide-react";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getUserMailboxes, createUserMailbox, deleteUserMailbox, clearMailboxContent } from "../api-client";
import { GetUserMailboxesResponseType } from "../types";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
import MailboxCounts from "./mailbox-counts";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;
const INVALID_MAILBOX_PATTERN = /[%*]|^#/;

interface Props {
  username: string;
}

export default function UserMailboxes({ username }: Props) {
  const { toast } = useToast();
  const confirm = useConfirm();

  const fetchMailboxes = useCallback(
    () => getUserMailboxes(username),
    [username]
  );

  const {
    data: mailboxes,
    isLoading,
    error,
    refresh,
  } = useFetchData<GetUserMailboxesResponseType>(fetchMailboxes);

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [newMailbox, setNewMailbox] = useState("");
  const [showCreateInput, setShowCreateInput] = useState(false);

  const filtered = useMemo(() => {
    if (!mailboxes) return [];
    const sorted = [...mailboxes].sort((a, b) =>
      a.mailboxName.localeCompare(b.mailboxName)
    );
    if (!search) return sorted;
    const lower = search.toLowerCase();
    return sorted.filter((m) => m.mailboxName.toLowerCase().includes(lower));
  }, [mailboxes, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_LIMIT));
  const paginated = filtered.slice(
    (page - 1) * PAGE_LIMIT,
    page * PAGE_LIMIT
  );

  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  const handleCreate = async () => {
    const name = newMailbox.trim();
    if (!name) return;
    if (INVALID_MAILBOX_PATTERN.test(name)) {
      toast({
        title: "Invalid mailbox name",
        description: "Mailbox name must not contain % or * characters, nor start with #.",
      });
      return;
    }
    try {
      await createUserMailbox(username, name);
      toast({ title: "Mailbox created successfully" });
      setNewMailbox("");
      setShowCreateInput(false);
      await refresh();
    } catch (err) {
      toast({
        title: "Error creating mailbox",
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  const handleDelete = async (mailboxName: string) => {
    const confirmed = await confirm({
      header: "Delete Mailbox",
      message: `Are you sure you want to delete mailbox "${mailboxName}" and all its children?`,
    });
    if (!confirmed) return;
    try {
      await deleteUserMailbox(username, mailboxName);
      toast({ title: "Mailbox deleted successfully" });
      await refresh();
    } catch (err) {
      toast({
        title: "Error deleting mailbox",
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  const handleClearMailbox = async (mailboxName: string) => {
    const confirmed = await confirm({
      header: "Clear Mailbox Content",
      message: `Are you sure you want to delete all messages in "${mailboxName}"?`,
    });
    if (!confirmed) return;
    try {
      const data = await clearMailboxContent(username, mailboxName);
      toast({
        title: "Task is running",
        description: <p>Task <a className="text-blue-500 hover:underline" href={`/task/${data.taskId}`}>{data.taskId}</a></p>,
      });
    } catch (err) {
      toast({
        title: "Error clearing mailbox",
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
          {open ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          Mailboxes
          {mailboxes && (
            <span className="text-sm font-normal text-gray-500">
              ({mailboxes.length})
            </span>
          )}
        </button>
        {open && (
          <button
            onClick={() => setShowCreateInput(!showCreateInput)}
            className="p-1 rounded-md hover:bg-gray-200 transition"
            title="Create mailbox"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2">
          {showCreateInput && (
            <div className="flex gap-2 mt-2 mb-2">
              <input
                type="text"
                value={newMailbox}
                onChange={(e) => setNewMailbox(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="New mailbox name (use . for nesting, e.g. INBOX.work)"
                className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleCreate}
                disabled={!newMailbox.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
            </div>
          )}

          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            </div>
          )}
          {error && <p className="text-red-500 mt-2">Error: {error}</p>}

          {mailboxes && (
            <>
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search mailboxes..."
                className="mt-2 w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {filtered.length > 0 && (
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
                    Page {page} / {totalPages} — Total: {filtered.length}
                  </span>
                  <button
                    onClick={() => goToPage(page + 1)}
                    disabled={page >= totalPages}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => goToPage(totalPages)}
                    disabled={page >= totalPages}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Last
                  </button>
                </div>
              )}

              <div className="mt-2">
                {paginated.map((mailbox, index) => (
                  <div
                    key={mailbox.mailboxName}
                    className="space-y-1 p-4 bg-gray-50 rounded-2 my-2 flex justify-between items-center"
                  >
                    <div>
                      <h4 className="text-sm font-medium leading-none">
                        <span className="text-gray-500 mr-2">
                          {(page - 1) * PAGE_LIMIT + index + 1}/
                        </span>
                        {mailbox.mailboxName}
                      </h4>
                      <p className="text-xs text-gray-400 mt-1 ml-6">{mailbox.mailboxId}</p>
                    </div>
                    <span className="flex items-center gap-2">
                      <MailboxCounts username={username} mailboxName={mailbox.mailboxName} />
                      <button
                        onClick={() => handleClearMailbox(mailbox.mailboxName)}
                        className="p-2 rounded-md hover:bg-gray-200"
                        title="Clear mailbox content"
                      >
                        <Eraser className="w-4 h-4 text-red-600" />
                      </button>
                      <button
                        onClick={() => handleDelete(mailbox.mailboxName)}
                        className="p-2 rounded-md hover:bg-gray-200"
                        title="Delete mailbox"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </span>
                  </div>
                ))}
              </div>

              {filtered.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">No mailboxes found.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
