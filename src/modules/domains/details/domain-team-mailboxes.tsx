import { useCallback, useId, useMemo, useState } from "react";
import { Link } from "react-router";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getTeamMailboxes, createTeamMailbox, deleteTeamMailbox } from "../api-client";
import { GetTeamMailboxesResponseType, TeamMailbox } from "../types";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useSearchPagination } from "@/hooks/use-search-pagination";
import { ListSearchPagination } from "@/components/custom/list-search-pagination";
import { SectionToggle, useSectionOpen } from "@/components/custom/collapsible-section";
import FormDialog, { FIELD_CLASS } from "@/components/custom/form-dialog";

const searchable = (mb: TeamMailbox) => [mb.name, mb.emailAddress];

interface Props {
  domain: string;
  defaultOpen?: boolean;
}

export default function DomainTeamMailboxes({ domain, defaultOpen }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canView = useIsAllowed("GET", "/domains/{domain}/team-mailboxes");
  const canCreate = useIsAllowed("PUT", "/domains/{domain}/team-mailboxes/{name}");
  const canDelete = useIsAllowed("DELETE", "/domains/{domain}/team-mailboxes/{name}");

  const fetchMailboxes = useCallback(() => getTeamMailboxes(domain), [domain]);
  const {
    data: mailboxes,
    isLoading,
    error,
    refresh,
  } = useFetchData<GetTeamMailboxesResponseType>(canView ? fetchMailboxes : null);

  const [open, setOpen, openContentId] = useSectionOpen("team-mailboxes", defaultOpen ?? false);
  const [newName, setNewName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const fieldId = useId();

  const sorted = useMemo(() => {
    if (!mailboxes) return [];
    return [...mailboxes].sort((a, b) => a.name.localeCompare(b.name));
  }, [mailboxes]);
  const { search, setSearch, filtered, paginated, page, totalPages, offset, goToPage } = useSearchPagination(sorted, searchable);

  if (!canView) return null;

  // A refusal is shown in the modal, which then stays open with the typed name
  const handleAdd = async () => {
    const name = newName.trim();
    await createTeamMailbox(domain, name);
    toast({ title: t("domains.teamMailboxes.created") });
    setNewName("");
    await refresh();
  };

  const handleRemove = async (name: string) => {
    const confirmed = await confirm({
      header: t("domains.teamMailboxes.deleteTitle"),
      destructive: true,
      confirmLabel: t("common.delete"),
      message: t("domains.teamMailboxes.deleteConfirm", { name, domain }),
    });
    if (!confirmed) return;
    try {
      await deleteTeamMailbox(domain, name);
      toast({ title: t("domains.teamMailboxes.deleted") });
      await refresh();
    } catch (err) {
      toast({
        title: t("domains.teamMailboxes.errorDeleting"),
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        <SectionToggle open={open} onToggle={() => setOpen(!open)} controls={openContentId}>
          {t("domains.teamMailboxes.title")}
          {mailboxes && (
            <span className="text-sm font-normal text-gray-500">
              ({mailboxes.length})
            </span>
          )}
        </SectionToggle>
        {canCreate && (
          <button
            onClick={() => { setOpen(true); setNewName(""); setShowCreate(true); }}
            className="p-1 rounded-md hover:bg-gray-200 transition"
            title={t("domains.teamMailboxes.addTooltip")}
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
            </div>
          )}
          {error && <p className="text-red-500 mt-2">{t("common.errorPrefix", { message: error })}</p>}

          {mailboxes && (
            <div>
              <ListSearchPagination
                search={search}
                onSearch={setSearch}
                placeholder={t("domains.teamMailboxes.searchPlaceholder")}
                page={page}
                totalPages={totalPages}
                total={filtered.length}
                goToPage={goToPage}
              />
              {paginated.map((mb, index) => (
                <div
                  key={mb.name}
                  className="space-y-1 p-4 bg-gray-50 rounded-2 my-2 flex justify-between items-center gap-2 transition-colors hover:bg-gray-100"
                >
                  <h4 className="min-w-0 text-sm font-medium leading-none break-all">
                    {/* Text separators, not only margins: the heading is read as one string */}
                    <span className="text-gray-500 mr-1">{offset + index + 1}/</span>{" "}
                    <Link
                      to={`/domains/domain/${encodeURIComponent(domain)}/team-mailbox/${encodeURIComponent(mb.name)}`}
                      className="text-blue-600 hover:underline"
                    >
                      {mb.name}
                    </Link>{" "}
                    <span className="sr-only">— </span>
                    <span className="text-xs text-muted-foreground ml-1">{mb.emailAddress}</span>
                  </h4>
                  {canDelete && (
                    <button
                      onClick={(e) => { e.preventDefault(); handleRemove(mb.name); }}
                      className="shrink-0 p-2 rounded-md hover:bg-gray-200"
                      title={t("domains.teamMailboxes.deleteTooltip")}
                      aria-label={t("domains.teamMailboxes.deleteNamed", { item: mb.name })}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  )}
                </div>
              ))}
              {mailboxes.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">{t("domains.teamMailboxes.empty")}</p>
              )}
              {mailboxes.length > 0 && filtered.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">{t("common.noSearchResults")}</p>
              )}
            </div>
          )}
        </div>
      )}

      <FormDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title={t("domains.teamMailboxes.addTooltip")}
        submitLabel={t("common.add")}
        submitDisabled={!newName.trim()}
        onSubmit={handleAdd}
      >
        <div>
          <label htmlFor={fieldId} className="text-sm font-medium">{t("domains.teamMailboxes.nameLabel")}</label>
          <input
            id={fieldId}
            type="text"
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("domains.teamMailboxes.namePlaceholder")}
            className={FIELD_CLASS}
          />
        </div>
      </FormDialog>
    </div>
  );
}
