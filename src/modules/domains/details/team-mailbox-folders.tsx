import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getTeamMailboxFolders, createTeamMailboxFolder, deleteTeamMailboxFolder } from "../api-client";
import { GetTeamMailboxFoldersResponseType } from "../types";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
import TeamMailboxFolderCounts from "./team-mailbox-folder-counts";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

const INVALID_FOLDER_PATTERN = /[%*]|^#/;

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

  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [newFolder, setNewFolder] = useState("");
  const [showCreateInput, setShowCreateInput] = useState(false);

  const sorted = useMemo(() => {
    if (!folders) return [];
    return [...folders].sort((a, b) => a.mailboxName.localeCompare(b.mailboxName));
  }, [folders]);

  if (!canView) return null;

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_LIMIT));
  const paginated = sorted.slice((page - 1) * PAGE_LIMIT, page * PAGE_LIMIT);

  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  const handleCreate = async () => {
    const name = newFolder.trim();
    if (!name) return;
    if (INVALID_FOLDER_PATTERN.test(name)) {
      toast({
        title: t("domains.folders.invalidName"),
        description: t("domains.folders.invalidNameDesc"),
      });
      return;
    }
    try {
      await createTeamMailboxFolder(domain, mailbox, name);
      toast({ title: t("domains.folders.created") });
      setNewFolder("");
      setShowCreateInput(false);
      await refresh();
    } catch (err) {
      toast({
        title: t("domains.folders.errorCreating"),
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  const handleDelete = async (folderName: string) => {
    const confirmed = await confirm({
      header: t("domains.folders.deleteTitle"),
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
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1 text-md font-semibold w-full text-left"
        >
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {t("domains.folders.title")}
          {folders && (
            <span className="text-sm font-normal text-gray-500">({folders.length})</span>
          )}
        </button>
        {open && canCreate && (
          <button
            onClick={() => setShowCreateInput(!showCreateInput)}
            className="p-1 rounded-md hover:bg-gray-200 transition"
            title={t("domains.folders.createTooltip")}
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
                value={newFolder}
                onChange={(e) => setNewFolder(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder={t("domains.folders.namePlaceholder")}
                className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleCreate}
                disabled={!newFolder.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("common.create")}
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

          {folders && (
            <>
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

              <div className="mt-2">
                {paginated.map((folder, index) => (
                  <div
                    key={folder.mailboxId}
                    className="space-y-1 p-4 bg-gray-50 rounded-2 my-2 flex justify-between items-center"
                  >
                    <div>
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
                    <span className="flex items-center gap-2">
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
    </div>
  );
}
