import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Eraser, Plus, Search, Trash2 } from "lucide-react";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getUserMailboxes, createUserMailbox, deleteUserMailbox, clearMailboxContent } from "../api-client";
import { GetUserMailboxesResponseType } from "../types";
import { useToast } from "@/hooks/use-toast";
import { useTaskCreatedToast } from "@/hooks/use-task-created-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
import MailboxCounts from "./mailbox-counts";
import { PaginationControls } from "@/components/custom/pagination-controls";
import { currentLocale } from "@/i18n/locale";
import { formatMailboxCreationDate } from "./mailbox-creation-date";
import { SectionToggle, useSectionFact, useSectionOpen } from "@/components/custom/collapsible-section";
import FormDialog, { FIELD_CLASS } from "@/components/custom/form-dialog";
import { taskTypeLabel } from "@/modules/tasks/task-summary";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

interface Props {
  username: string;
}

function MailboxCreationDate({ mailboxId }: { mailboxId: string }) {
  const { t } = useTranslation();
  const creationDate = formatMailboxCreationDate(mailboxId, currentLocale());
  if (!creationDate) return null;
  // Wraps as a whole after the id, never inside "Creation"
  return <span className="inline-block ml-2 break-normal">— {t("users.mailboxes.creationDate")} {creationDate}</span>;
}

export default function UserMailboxes({ username }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const toastTaskCreated = useTaskCreatedToast();
  const confirm = useConfirm();
  const canView = useIsAllowed("GET", "/users/{username}/mailboxes");
  const canCreate = useIsAllowed("PUT", "/users/{username}/mailboxes/{mailboxName}");
  const canDelete = useIsAllowed("DELETE", "/users/{username}/mailboxes/{mailboxName}");
  const canClear = useIsAllowed("DELETE", "/users/{username}/mailboxes/{mailboxName}/messages");

  const fetchMailboxes = useCallback(
    () => getUserMailboxes(username),
    [username]
  );

  const {
    data: mailboxes,
    isLoading,
    error,
    refresh,
  } = useFetchData<GetUserMailboxesResponseType>(canView ? fetchMailboxes : null);

  const [open, setOpen, openContentId] = useSectionOpen("mailboxes");
  useSectionFact("mailboxes", mailboxes?.length);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [newMailbox, setNewMailbox] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const filtered = useMemo(() => {
    if (!mailboxes) return [];
    const sorted = [...mailboxes].sort((a, b) =>
      a.mailboxName.localeCompare(b.mailboxName)
    );
    if (!search) return sorted;
    const lower = search.toLowerCase();
    return sorted.filter((m) => m.mailboxName.toLowerCase().includes(lower) || m.mailboxId.toLowerCase().includes(lower));
  }, [mailboxes, search]);

  if (!canView) return null;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_LIMIT));
  const paginated = filtered.slice(
    (page - 1) * PAGE_LIMIT,
    page * PAGE_LIMIT
  );

  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  // A refusal throws: the modal shows it and keeps the typed name
  const handleCreate = async () => {
    await createUserMailbox(username, newMailbox.trim());
    toast({ title: t("users.mailboxes.created") });
    setNewMailbox("");
    await refresh();
  };

  const handleDelete = async (mailboxName: string) => {
    const confirmed = await confirm({
      header: t("users.mailboxes.deleteTitle"),
      destructive: true,
      confirmLabel: t("common.delete"),
      consequence: t("confirm.consequence.deleteMailbox", { mailbox: mailboxName }),
      // The INBOX can be deleted like any folder: make sure it is meant
      typeToConfirm: mailboxName.toUpperCase() === "INBOX" ? mailboxName : undefined,
      message: t("users.mailboxes.deleteConfirm", { mailboxName }),
    });
    if (!confirmed) return;
    try {
      await deleteUserMailbox(username, mailboxName);
      toast({ title: t("users.mailboxes.deleted") });
      await refresh();
    } catch (err) {
      toast({
        title: t("users.mailboxes.errorDeleting"),
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  const handleClearMailbox = async (mailboxName: string) => {
    const confirmed = await confirm({
      header: t("users.mailboxes.clearTitle"),
      destructive: true,
      confirmLabel: t("confirm.clear"),
      consequence: t("confirm.consequence.clearMailbox", { mailbox: mailboxName }),
      message: t("users.mailboxes.clearConfirm", { mailboxName }),
    });
    if (!confirmed) return;
    try {
      const data = await clearMailboxContent(username, mailboxName);
      toastTaskCreated(data.taskId, undefined, taskTypeLabel(t, "ClearMailboxContentTask"));
    } catch (err) {
      toast({
        title: t("users.mailboxes.errorClearing"),
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        <SectionToggle open={open} onToggle={() => setOpen(!open)} controls={openContentId}>
          {t("users.mailboxes.title")}
          {mailboxes && (
            <span className="text-sm font-normal text-gray-500">
              ({mailboxes.length})
            </span>
          )}
        </SectionToggle>
        <Link
          to={`/users/user/${encodeURIComponent(username)}/message-search`}
          className="p-1 rounded-md hover:bg-gray-200 transition text-gray-500 hover:text-blue-600"
          title={t("users.mailboxes.searchMessages")}
        >
          <Search className="w-4 h-4" />
        </Link>
        {canCreate && (
          <button
            type="button"
            onClick={() => { setOpen(true); setNewMailbox(""); setShowCreateDialog(true); }}
            className="p-1 rounded-md hover:bg-gray-200 transition"
            title={t("users.mailboxes.createTooltip")}
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      <FormDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        title={t("users.mailboxes.createTooltip")}
        submitLabel={t("common.create")}
        submitDisabled={!newMailbox.trim()}
        onSubmit={handleCreate}
      >
        <div>
          <label htmlFor="add-mailbox-name" className="text-sm font-medium">{t("users.mailboxes.nameLabel")}</label>
          <input
            type="text"
            autoFocus
            value={newMailbox}
            onChange={(e) => setNewMailbox(e.target.value)}
            id="add-mailbox-name"
            aria-describedby="add-mailbox-name-help"
            placeholder={t("users.mailboxes.nameExample")}
            className={FIELD_CLASS}
          />
          <p id="add-mailbox-name-help" className="text-xs text-muted-foreground mt-1">{t("users.mailboxes.nameHelp")}</p>
        </div>
      </FormDialog>

      {open && (
        <div id={openContentId} className="mt-2">
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            </div>
          )}
          {error && <p className="text-red-500 mt-2">{t("common.errorPrefix", { message: error })}</p>}

          {mailboxes && (
            <>
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={t("users.mailboxes.searchPlaceholder")}
                className="mt-2 w-full px-4 py-2 border rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />

              {filtered.length > 0 && (
                <PaginationControls
                  onFirst={() => goToPage(1)}
                  onPrev={() => goToPage(page - 1)}
                  onNext={() => goToPage(page + 1)}
                  onLast={() => goToPage(totalPages)}
                  disabledPrev={page <= 1}
                  disabledNext={page >= totalPages}
                  label={t("common.page", { page, totalPages, total: filtered.length })}
                  total={filtered.length}
                />
              )}

              <div className="mt-2">
                {paginated.map((mailbox, index) => (
                  <div
                    key={mailbox.mailboxName}
                    className="space-y-1 p-4 bg-gray-50 rounded-2 my-2 flex flex-wrap justify-between items-center gap-2 transition-colors hover:bg-gray-100"
                  >
                    <div className="min-w-0 break-all">
                      <h4 className="text-sm font-medium leading-none">
                        <span className="text-gray-500 mr-2">
                          {(page - 1) * PAGE_LIMIT + index + 1}/
                        </span>
                        {mailbox.mailboxName}
                      </h4>
                      <p className="text-xs text-gray-400 mt-1 ml-6">
                        <span className="break-all">{mailbox.mailboxId}</span>
                        <MailboxCreationDate mailboxId={mailbox.mailboxId} />
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-2">
                      <MailboxCounts username={username} mailboxName={mailbox.mailboxName} />
                      {canClear && (
                        <button
                          onClick={() => handleClearMailbox(mailbox.mailboxName)}
                          className="p-2 rounded-md hover:bg-gray-200"
                          title={t("users.mailboxes.clearTooltip")}
                        >
                          <Eraser className="w-4 h-4 text-red-600" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(mailbox.mailboxName)}
                          className="p-2 rounded-md hover:bg-gray-200"
                          title={t("users.mailboxes.deleteTooltip")}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>

              {filtered.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">{t("users.mailboxes.empty")}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
