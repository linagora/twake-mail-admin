import { useCallback, useId, useMemo, useState } from "react";
import { Link } from "react-router";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getTeamMailboxFolders, createTeamMailboxFolder, deleteTeamMailboxFolder } from "../api-client";
import { GetTeamMailboxFoldersResponseType } from "../types";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { PaginationControls } from "@/components/custom/pagination-controls";
import TeamMailboxFolderCounts from "./team-mailbox-folder-counts";
import { SectionToggle, useSectionOpen } from "@/components/custom/collapsible-section";
import FormDialog, { FIELD_CLASS } from "@/components/custom/form-dialog";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

interface Props {
  domain: string;
  mailbox: string;
}

export default function TeamMailboxFolders({ domain, mailbox }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canView = useIsAllowed("GET", "/domains/{domain}/team-mailboxes/{mailbox}/mailboxes");
  const canCreate = useIsAllowed("PUT", "/domains/{domain}/team-mailboxes/{mailbox}/mailboxes/{folderName}");
  const canDelete = useIsAllowed("DELETE", "/domains/{domain}/team-mailboxes/{mailbox}/mailboxes/{folderName}");

  const fetchFolders = useCallback(
    () => getTeamMailboxFolders(domain, mailbox),
    [domain, mailbox]
  );

  const { data: folders, isLoading, error, refresh } = useFetchData<GetTeamMailboxFoldersResponseType>(canView ? fetchFolders : null);

  const [open, setOpen, openContentId] = useSectionOpen("folders");
  const [page, setPage] = useState(1);
  const [newFolder, setNewFolder] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const fieldId = useId();

  // WebAdmin lists the team mailbox root under its bare name, but folder routes are relative to that root
  const sorted = useMemo(() => {
    if (!folders) return [];
    return folders
      .filter((folder) => folder.mailboxName !== mailbox)
      .sort((a, b) => a.mailboxName.localeCompare(b.mailboxName));
  }, [folders, mailbox]);

  if (!canView) return null;

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_LIMIT));
  const paginated = sorted.slice((page - 1) * PAGE_LIMIT, page * PAGE_LIMIT);

  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  // A refusal is shown in the modal, which then stays open with the typed name
  const handleCreate = async () => {
    const name = newFolder.trim();
    await createTeamMailboxFolder(domain, mailbox, name);
    toast({ title: t("domains.folders.created") });
    setNewFolder("");
    await refresh();
  };

  const handleDelete = async (folderName: string) => {
    const confirmed = await confirm({
      header: t("domains.folders.deleteTitle"),
      destructive: true,
      confirmLabel: t("common.delete"),
      consequence: t("confirm.consequence.deleteMailbox", { mailbox: folderName }),
      typeToConfirm: folderName.toUpperCase() === "INBOX" ? folderName : undefined,
      message: t("domains.folders.deleteConfirm", { folderName }),
    });
    if (!confirmed) return;
    try {
      await deleteTeamMailboxFolder(domain, mailbox, folderName);
      toast({ title: t("domains.folders.deleted") });
      await refresh();
    } catch (err) {
      toast({
        title: t("domains.folders.errorDeleting"),
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        <SectionToggle open={open} onToggle={() => setOpen(!open)} controls={openContentId}>
          {t("domains.folders.title")}
          {folders && (
            <span className="text-sm font-normal text-gray-500">({sorted.length})</span>
          )}
        </SectionToggle>
        {canCreate && (
          <button
            onClick={() => { setOpen(true); setNewFolder(""); setShowCreate(true); }}
            className="p-1 rounded-md hover:bg-gray-200 transition"
            title={t("domains.folders.createTooltip")}
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div id={openContentId} className="mt-2">
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            </div>
          )}
          {error && <p className="text-red-500 mt-2">{t("common.errorPrefix", { message: error })}</p>}

          {folders && (
            <>
              {sorted.length > 0 && (
                <PaginationControls
                  onFirst={() => goToPage(1)}
                  onPrev={() => goToPage(page - 1)}
                  onNext={() => goToPage(page + 1)}
                  onLast={() => goToPage(totalPages)}
                  disabledPrev={page <= 1}
                  disabledNext={page >= totalPages}
                  label={t("common.page", { page, totalPages, total: sorted.length })}
                  total={sorted.length}
                />
              )}

              <div className="mt-2">
                {paginated.map((folder, index) => (
                  <div
                    key={folder.mailboxId}
                    className="space-y-1 p-4 bg-gray-50 rounded-2 my-2 flex flex-wrap justify-between items-center gap-2 transition-colors hover:bg-gray-100"
                  >
                    <div className="min-w-0 break-all">
                      <h4 className="text-sm font-medium leading-none">
                        <span className="text-gray-500 mr-2">{(page - 1) * PAGE_LIMIT + index + 1}/</span>
                        <Link
                          to={`/domains/domain/${encodeURIComponent(domain)}/team-mailbox/${encodeURIComponent(mailbox)}/folder/${encodeURIComponent(folder.mailboxName)}`}
                          className="hover:underline text-blue-600"
                        >
                          {folder.mailboxName}
                        </Link>
                      </h4>
                      <p className="text-xs text-gray-400 mt-1 ml-6">{folder.mailboxId}</p>
                    </div>
                    <span className="flex shrink-0 items-center gap-2">
                      <TeamMailboxFolderCounts domain={domain} mailbox={mailbox} folderName={folder.mailboxName} />
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(folder.mailboxName)}
                          className="p-2 rounded-md hover:bg-gray-200"
                          title={t("domains.folders.deleteTooltip")}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>

              {sorted.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">{t("domains.folders.empty")}</p>
              )}
            </>
          )}
        </div>
      )}

      <FormDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title={t("domains.folders.createTooltip")}
        submitLabel={t("common.create")}
        submitDisabled={!newFolder.trim()}
        onSubmit={handleCreate}
      >
        <div>
          <label htmlFor={fieldId} className="text-sm font-medium">{t("domains.folders.nameLabel")}</label>
          <input
            id={fieldId}
            type="text"
            autoFocus
            value={newFolder}
            onChange={(e) => setNewFolder(e.target.value)}
            placeholder={t("domains.folders.namePlaceholder")}
            className={FIELD_CLASS}
          />
        </div>
      </FormDialog>
    </div>
  );
}
