import { useCallback, useId, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useSearchPagination } from "@/hooks/use-search-pagination";
import { ListSearchPagination } from "@/components/custom/list-search-pagination";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getResources, createResource, deleteResource, getResourceEventCount, exportResource, importResource, setResourcePublicRight } from "../api-client";
import { Resource } from "../types";
import { compareResourcesByDisplayName, resourceDisplayName } from "../resource-display";
import DomainCalendarControls, { DomainCalendarApi } from "./domain-calendar-controls";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { useCheckUserExists } from "@/hooks/use-check-user-exists";
import ResourceIconPicker from "@/components/custom/resource-icon-picker";
import ErrorDisplayer from "@/components/custom/error-displayer";
import FormDialog, { FIELD_CLASS } from "@/components/custom/form-dialog";
import { useTranslation } from "react-i18next";
import { SectionToggle, useSectionFact, useSectionOpen } from "@/components/custom/collapsible-section";
import { StagedChangesNotice, blocksSave } from "@/components/custom/staged-changes";
import UserSuggestInput from "@/components/custom/user-suggest-input";
import SharedWithChip from "@/components/custom/shared-with-chip";

const searchable = (resource: Resource) => [resourceDisplayName(resource), resource.description];

const CONTENT_API: DomainCalendarApi = {
  count: getResourceEventCount,
  exportCalendar: exportResource,
  importCalendar: importResource,
  setPublicRight: setResourcePublicRight,
};

interface Props {
  domain: string;
  defaultOpen?: boolean;
  resourceLink?: (resourceId: string) => string;
}

export default function CalendarDomainResources({ domain, defaultOpen = false, resourceLink }: Props) {
  const { t } = useTranslation();
  const idPrefix = useId();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canView = useIsAllowed("GET", "/domains/{domain}/resources");
  const canCreate = useIsAllowed("POST", "/domains/{domain}/resources");
  const canDelete = useIsAllowed("DELETE", "/domains/{domain}/resources/{resourceId}");
  const contentPermissions = {
    count: useIsAllowed("GET", "/domains/{domain}/resources/{resourceId}/eventCount"),
    export: useIsAllowed("POST", "/domains/{domain}/resources/{resourceId}?action=export"),
    import: useIsAllowed("POST", "/domains/{domain}/resources/{resourceId}?action=import"),
    publicRight: useIsAllowed("POST", "/domains/{domain}/resources/{resourceId}/publicRight"),
  };

  const fetchResources = useCallback(() => getResources(domain), [domain]);
  const { data: resources, isLoading, error, refresh } = useFetchData<Resource[]>(canView ? fetchResources : null);

  const [open, setOpen, openContentId] = useSectionOpen("resources", defaultOpen);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newIcon, setNewIcon] = useState("home");
  const [newCreator, setNewCreator] = useState("");
  const creatorStatus = useCheckUserExists(newCreator);
  const [newAdminInput, setNewAdminInput] = useState("");
  const adminInputStatus = useCheckUserExists(newAdminInput);
  const [newAdministrators, setNewAdministrators] = useState<{ email: string }[]>([]);

  const active = useMemo(() => {
    if (!resources) return [];
    return resources.filter((r) => !r.deleted).sort(compareResourcesByDisplayName);
  }, [resources]);
  const { search, setSearch, filtered, paginated, page, totalPages, offset, goToPage } = useSearchPagination(active, searchable);
  // For the summary of the page
  useSectionFact("resources", resources ? active.length : undefined);

  if (!canView) return null;

  const resourcePage = (resourceId: string) =>
    resourceLink ? resourceLink(resourceId) : `/domains/domain/${encodeURIComponent(domain)}/resource/${encodeURIComponent(resourceId)}`;

  const handleAddAdmin = () => {
    const email = newAdminInput.trim();
    if (!email || adminInputStatus !== "exists") return;
    if (newAdministrators.some((a) => a.email === email)) return;
    setNewAdministrators((prev) => [...prev, { email }]);
    setNewAdminInput("");
  };

  const handleRemoveNewAdmin = (email: string) => {
    setNewAdministrators((prev) => prev.filter((a) => a.email !== email));
  };

  // An administrator typed but not added is added on Create when it exists, and blocks Create otherwise
  const pendingAdmin = newAdminInput.trim();
  const pendingAdminAddable = adminInputStatus === "exists" && pendingAdmin !== "";
  const pendingAdminBlocks = blocksSave(newAdminInput, pendingAdminAddable);

  const resetCreate = () => {
    setShowCreate(false);
    setNewName("");
    setNewDescription("");
    setNewIcon("home");
    setNewCreator("");
    setNewAdminInput("");
    setNewAdministrators([]);
  };

  // Throws on a refusal: the modal shows it and keeps the typed values
  const handleAdd = async () => {
    const name = newName.trim();
    if (!name || !newCreator.trim() || creatorStatus !== "exists" || pendingAdminBlocks) return;
    const administrators = pendingAdminAddable && !newAdministrators.some((a) => a.email === pendingAdmin)
      ? [...newAdministrators, { email: pendingAdmin }]
      : newAdministrators;
    await createResource({
      name,
      description: newDescription.trim(),
      icon: newIcon.trim(),
      domain,
      creator: newCreator.trim(),
      administrators,
    });
    toast({ title: t("domains.calendarResources.created") });
    resetCreate();
    await refresh();
  };

  const handleRemove = async (resource: Resource) => {
    const confirmed = await confirm({
      header: t("domains.calendarResources.deleteTitle"),
      destructive: true,
      confirmLabel: t("common.delete"),
      message: t("domains.calendarResources.deleteConfirm", { name: resourceDisplayName(resource) }),
    });
    if (!confirmed) return;
    try {
      await deleteResource(domain, resource.id);
      toast({ title: t("domains.calendarResources.deleted") });
      await refresh();
    } catch (err) {
      toast({ title: t("domains.calendarResources.errorDeleting"), description: <ErrorDisplayer error={err} /> });
    }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        <SectionToggle open={open} onToggle={() => setOpen(!open)} controls={openContentId}>
          {t("domains.calendarResources.title")}
          {resources && (
            <span className="text-sm font-normal text-gray-500">({active.length})</span>
          )}
        </SectionToggle>
        {canCreate && (
          <button
            onClick={() => { setOpen(true); setShowCreate(true); }} className="p-1 rounded-md hover:bg-gray-200 transition" title={t("domains.calendarResources.addTooltip")}>
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

          {resources && (
            <div>
              <ListSearchPagination
                search={search}
                onSearch={setSearch}
                placeholder={t("domains.calendarResources.searchPlaceholder")}
                page={page}
                totalPages={totalPages}
                total={filtered.length}
                goToPage={goToPage}
              />
              {paginated.map((resource, index) => (
                <div key={resource.id} className="p-4 bg-gray-50 rounded-2 my-2 flex flex-wrap justify-between items-center gap-2 transition-colors hover:bg-gray-100">
                  {/* Wide enough to stay readable: on a phone the actions wrap under the name instead of squeezing it */}
                  <h4 className="flex-1 min-w-48 text-sm font-medium leading-snug break-words">
                    <span className="text-gray-500 mr-2">{offset + index + 1}/</span>
                    <a href={resourcePage(resource.id)} className="text-blue-600 hover:underline">{resourceDisplayName(resource)}</a>
                    {resource.description && (
                      <span className="text-xs text-muted-foreground ml-2">{resource.description}</span>
                    )}
                    {/* Who manages it, without opening its page; the chip opens it */}
                    <span className="ml-2 align-middle">
                      <SharedWithChip
                        sharees={(resource.administrators ?? []).map((admin) => ({ label: admin.email, right: "" }))}
                        text={t("domains.calendarResources.administeredBy", { count: resource.administrators?.length ?? 0 })}
                        href={resourcePage(resource.id)}
                      />
                    </span>
                  </h4>
                  <div className="flex items-center gap-1 shrink-0 ml-auto">
                    <DomainCalendarControls
                      domain={domain}
                      calendarId={resource.id}
                      name={resourceDisplayName(resource)}
                      permissions={contentPermissions}
                      api={CONTENT_API}
                      labels="domains.calendarResources"
                    />
                    {canDelete && (
                      <button onClick={(e) => { e.preventDefault(); handleRemove(resource); }}
                        className="p-2 rounded-md hover:bg-gray-200" title={t("domains.calendarResources.deleteTooltip")}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {active.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">{t("domains.calendarResources.empty")}</p>
              )}
              {active.length > 0 && filtered.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">{t("common.noSearchResults")}</p>
              )}
            </div>
          )}
        </div>
      )}
      <FormDialog
        open={showCreate}
        onClose={resetCreate}
        title={t("domains.calendarResources.newTitle")}
        submitLabel={t("common.create")}
        submitDisabled={!newName.trim() || creatorStatus !== "exists" || pendingAdminBlocks}
        onSubmit={handleAdd}
      >
        <div>
          <label htmlFor={`${idPrefix}-name`} className="text-sm font-medium">{t("domains.calendarResources.fieldName")} <span className="text-red-500">*</span></label>
          <input id={`${idPrefix}-name`} autoFocus type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder={t("domains.calendarResources.namePlaceholder")} className={FIELD_CLASS} />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-description`} className="text-sm font-medium">{t("domains.calendarResources.fieldDescription")}</label>
          <input id={`${idPrefix}-description`} type="text" value={newDescription} onChange={(e) => setNewDescription(e.target.value)}
            placeholder={t("domains.calendarResources.descriptionPlaceholder")} className={FIELD_CLASS} />
        </div>
        <div>
          <label id={`${idPrefix}-icon-label`} className="text-sm font-medium">{t("domains.calendarResources.iconLabel")}</label>
          <div className="mt-1"><ResourceIconPicker value={newIcon} onChange={setNewIcon} labelId={`${idPrefix}-icon-label`} /></div>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-creator`} className="text-sm font-medium">{t("domains.calendarResources.creatorLabel")} <span className="text-red-500">*</span></label>
          <UserSuggestInput id={`${idPrefix}-creator`} value={newCreator} required onValueChange={setNewCreator}
            placeholder="user@domain.tld" className={FIELD_CLASS} />
          {/* Reserved height: the status appearing does not move the fields below */}
          <p className="h-4 mt-1 text-xs">
            {creatorStatus === "checking" && <span className="text-gray-400">{t("common.checking")}</span>}
            {creatorStatus === "exists" && <span className="text-green-700">{t("common.userExists")}</span>}
            {creatorStatus === "not_found" && <span className="text-orange-600">{t("common.userNotFound")}</span>}
            {creatorStatus === "invalid" && <span className="text-red-600">{t("common.invalidUsername")}</span>}
          </p>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-administrators`} className="text-sm font-medium">{t("domains.calendarResources.administratorsLabel")}</label>
          <div className="flex items-center gap-2 mt-1">
            {/* Enter adds the typed administrator to the list rather than creating the resource */}
            <UserSuggestInput id={`${idPrefix}-administrators`} value={newAdminInput} onValueChange={setNewAdminInput}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddAdmin(); } }} placeholder="user@domain.tld"
              className="w-full px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500" wrapperClassName="flex-1 min-w-0" />
            <button type="button" onClick={handleAddAdmin} disabled={adminInputStatus !== "exists"}
              className="px-3 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed">{t("common.add")}</button>
          </div>
          <p className="h-4 mt-1 text-xs">
            {adminInputStatus === "checking" && <span className="text-gray-400">{t("common.checking")}</span>}
            {adminInputStatus === "exists" && <span className="text-green-700">{t("common.userExists")}</span>}
            {adminInputStatus === "not_found" && <span className="text-orange-600">{t("common.userNotFound")}</span>}
            {adminInputStatus === "invalid" && <span className="text-red-600">{t("common.invalidUsername")}</span>}
          </p>
          <StagedChangesNotice count={0} blocking={pendingAdminBlocks} />
          {newAdministrators.length > 0 && (
            <div className="mt-2 space-y-1">
              {newAdministrators.map((a) => (
                <div key={a.email} className="flex items-center justify-between px-3 py-1.5 bg-white border rounded-md text-sm">
                  <span className="min-w-0 break-all">{a.email}</span>
                  <button type="button" onClick={() => handleRemoveNewAdmin(a.email)} className="p-1 rounded-md hover:bg-gray-100" title={t("domains.calendarResources.removeAdminTooltip")}>
                    <Trash2 className="w-3 h-3 text-red-600" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </FormDialog>
    </div>
  );
}
