import { useCallback, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useSearchPagination } from "@/hooks/use-search-pagination";
import { ListSearchPagination } from "@/components/custom/list-search-pagination";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getDomainAdmins, addDomainAdmin, removeDomainAdmin } from "../api-client";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { useCheckUserExists } from "@/hooks/use-check-user-exists";
import ErrorDisplayer from "@/components/custom/error-displayer";
import FormDialog, { FIELD_CLASS } from "@/components/custom/form-dialog";
import { useTranslation } from "react-i18next";
import { SectionToggle, useSectionFact, useSectionOpen } from "@/components/custom/collapsible-section";
import UserSuggestInput from "@/components/custom/user-suggest-input";

const searchable = (admin: string) => [admin];

const isListedAdmin = (admins: string[], username: string) =>
  admins.some((admin) => admin.toLowerCase() === username.toLowerCase());

interface Props {
  domain: string;
  defaultOpen?: boolean;
}

export default function CalendarDomainAdmins({ domain, defaultOpen = false }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canView = useIsAllowed("GET", "/domains/{domain}/admins");
  const canAdd = useIsAllowed("PUT", "/domains/{domain}/admins/{username}");
  const canRemove = useIsAllowed("DELETE", "/domains/{domain}/admins/{username}");

  const fetchAdmins = useCallback(() => getDomainAdmins(domain), [domain]);
  const { data: admins, isLoading, error, refresh } = useFetchData<string[]>(canView ? fetchAdmins : null);

  const [open, setOpen, openContentId] = useSectionOpen("admins", defaultOpen);
  // For the summary of the page
  useSectionFact("admins", admins?.length);
  const [showAddInput, setShowAddInput] = useState(false);
  const [newAdmin, setNewAdmin] = useState("");
  const adminStatus = useCheckUserExists(newAdmin);

  const sorted = useMemo(() => {
    if (!admins) return [];
    return [...admins].sort((a, b) => a.localeCompare(b));
  }, [admins]);
  const { search, setSearch, filtered, paginated, page, totalPages, offset, goToPage } = useSearchPagination(sorted, searchable);

  if (!canView) return null;

  const trimmedAdmin = newAdmin.trim();
  const isAlreadyAdmin = isListedAdmin(admins ?? [], trimmedAdmin);
  const canSubmit = !!trimmedAdmin && !isAlreadyAdmin && adminStatus === "exists";

  const closeAdd = () => {
    setShowAddInput(false);
    setNewAdmin("");
  };

  // Throws on a refusal: the modal shows it and keeps the typed address
  const handleAdd = async () => {
    if (!canSubmit) return;
    await addDomainAdmin(domain, trimmedAdmin);
    toast({ title: t("domains.calendarAdmins.added") });
    closeAdd();
    await refresh();
  };

  const handleRemove = async (username: string) => {
    const confirmed = await confirm({
      header: t("domains.calendarAdmins.removeTitle"),
      destructive: true,
      confirmLabel: t("common.remove"),
      message: t("domains.calendarAdmins.removeConfirm", { username, domain }),
    });
    if (!confirmed) return;
    try {
      await removeDomainAdmin(domain, username);
      toast({ title: t("domains.calendarAdmins.removed") });
      await refresh();
    } catch (err) {
      toast({
        title: t("domains.calendarAdmins.errorRemoving"),
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        <SectionToggle open={open} onToggle={() => setOpen(!open)} controls={openContentId}>
          {t("domains.calendarAdmins.title")}
          {admins && (
            <span className="text-sm font-normal text-gray-500">
              ({admins.length})
            </span>
          )}
        </SectionToggle>
        {canAdd && (
          <button
            onClick={() => { setOpen(true); setShowAddInput(true); }}
            className="p-1 rounded-md hover:bg-gray-200 transition"
            title={t("domains.calendarAdmins.addTooltip")}
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

          <p className="mt-2 mb-2 text-sm text-gray-500 italic">
            {t("domains.calendarAdmins.roleNote")}
          </p>

          {admins && (
            <div>
              <ListSearchPagination
                search={search}
                onSearch={setSearch}
                placeholder={t("domains.calendarAdmins.searchPlaceholder")}
                page={page}
                totalPages={totalPages}
                total={filtered.length}
                goToPage={goToPage}
              />
              {paginated.map((admin, index) => (
                <div key={admin} className="space-y-1 p-4 bg-gray-50 rounded-2 my-2 flex justify-between items-center gap-2 transition-colors hover:bg-gray-100">
                  <h4 className="min-w-0 text-sm font-medium leading-none break-all">
                    <span className="text-gray-500 mr-2">{offset + index + 1}/</span>
                    {admin}
                  </h4>
                  {canRemove && (
                    <button onClick={() => handleRemove(admin)} className="shrink-0 p-2 rounded-md hover:bg-gray-200" title={t("domains.calendarAdmins.removeTooltip")}>
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  )}
                </div>
              ))}
              {admins.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">{t("domains.calendarAdmins.empty")}</p>
              )}
              {admins.length > 0 && filtered.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">{t("common.noSearchResults")}</p>
              )}
            </div>
          )}
        </div>
      )}
      <FormDialog
        open={showAddInput}
        onClose={closeAdd}
        title={t("domains.calendarAdmins.addTooltip")}
        submitLabel={t("common.add")}
        submitDisabled={!canSubmit}
        onSubmit={handleAdd}
      >
        <div>
          {/* The only field: named by the action, the modal title */}
          <UserSuggestInput
            autoFocus
            aria-label={t("domains.calendarAdmins.addTooltip")}
            value={newAdmin}
            onValueChange={setNewAdmin}
            placeholder={t("domains.calendarAdmins.addPlaceholder")}
            className={FIELD_CLASS}
          />
          {/* Reserved height: the status appearing does not resize the modal */}
          <p className="h-4 mt-1 text-xs">
            {trimmedAdmin && adminStatus === "checking" && <span className="text-gray-400">{t("common.checking")}</span>}
            {isAlreadyAdmin && <span className="text-orange-600">{t("domains.calendarAdmins.alreadyAdmin")}</span>}
            {!isAlreadyAdmin && adminStatus === "exists" && <span className="text-green-700">{t("common.userExists")}</span>}
            {adminStatus === "not_found" && <span className="text-orange-600">{t("common.userNotFound")}</span>}
            {adminStatus === "invalid" && <span className="text-red-600">{t("common.invalidUsername")}</span>}
          </p>
        </div>
      </FormDialog>
    </div>
  );
}
