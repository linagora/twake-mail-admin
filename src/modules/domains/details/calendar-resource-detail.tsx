import { useCallback, useId, useMemo, useState } from "react";
import { useParams } from "react-router";
import { Pencil, Plus, Save, Trash2 } from "lucide-react";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getResource, updateResource } from "../api-client";
import { Resource } from "../types";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { useCheckUserExists } from "@/hooks/use-check-user-exists";
import ResourceIconPicker from "@/components/custom/resource-icon-picker";
import { Button } from "@/components/ui/button";
import { isKnownResourceIcon, resourceDisplayName } from "../resource-display";
import ErrorDisplayer from "@/components/custom/error-displayer";
import FormDialog, { FIELD_CLASS } from "@/components/custom/form-dialog";
import { useDomain } from "@/modules/domain-admin/domain-context";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useTranslation } from "react-i18next";
import Header from "@/components/custom/header";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { PaginationControls } from "@/components/custom/pagination-controls";
import UserSuggestInput from "@/components/custom/user-suggest-input";
import UserLink from "@/components/custom/user-link";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

// The icon the edit form starts from: the resource's own, even one the console does not list
const initialIcon = (resource: Resource) => resource.icon || "home";

export default function CalendarResourceDetail() {
  const { t } = useTranslation();
  const idPrefix = useId();
  const { domain: domainParam, resourceId } = useParams();
  const domainContext = useDomain();
  // In GLOBAL mode domain comes from the URL; in DOMAIN mode it comes from context.
  const domain = domainParam || domainContext;
  const breadcrumbs = useBreadcrumbs();
  const { toast } = useToast();
  const confirm = useConfirm();

  const fetchResource = useCallback(() => getResource(domain, resourceId!), [domain, resourceId]);
  const { data: resource, isLoading, error, refresh } = useFetchData<Resource>(fetchResource);

  const canEdit = useIsAllowed("PATCH", "/domains/{domain}/resources/{resourceId}");

  const [page, setPage] = useState(1);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newAdmin, setNewAdmin] = useState("");
  const adminStatus = useCheckUserExists(newAdmin);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [saving, setSaving] = useState(false);

  const admins = useMemo(() => {
    if (!resource?.administrators) return [];
    return [...resource.administrators].sort((a, b) => a.email.localeCompare(b.email));
  }, [resource]);

  const totalPages = Math.max(1, Math.ceil(admins.length / PAGE_LIMIT));
  const paginated = admins.slice((page - 1) * PAGE_LIMIT, page * PAGE_LIMIT);

  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  const trimmedAdmin = newAdmin.trim();
  const isAlreadyAdmin = !!resource && resource.administrators.some((a) => a.email === trimmedAdmin);
  const canAddAdmin = !!trimmedAdmin && !isAlreadyAdmin && adminStatus === "exists";

  const closeAddAdmin = () => {
    setShowAddAdmin(false);
    setNewAdmin("");
  };

  // Throws on a refusal: the modal shows it and keeps the typed address
  const handleAddAdmin = async () => {
    if (!resource || !canAddAdmin) return;
    await updateResource(domain, resource.id, {
      administrators: [...resource.administrators, { email: trimmedAdmin }],
    });
    toast({ title: t("domains.calendarResources.adminAdded") });
    closeAddAdmin();
    await refresh();
  };

  const handleRemoveAdmin = async (email: string) => {
    if (!resource) return;
    const confirmed = await confirm({
      header: t("domains.calendarResources.removeAdminTitle"),
      destructive: true,
      confirmLabel: t("common.remove"),
      message: t("domains.calendarResources.removeAdminConfirm", { email }),
    });
    if (!confirmed) return;
    try {
      await updateResource(domain, resource.id, {
        administrators: resource.administrators.filter((a) => a.email !== email),
      });
      toast({ title: t("domains.calendarResources.adminRemoved") });
      await refresh();
    } catch (err) {
      toast({ title: t("domains.calendarResources.errorRemovingAdmin"), description: <ErrorDisplayer error={err} /> });
    }
  };

  const startEdit = () => {
    if (!resource) return;
    setEditName(resource.name ?? "");
    setEditDescription(resource.description || "");
    setEditIcon(initialIcon(resource));
    setEditing(true);
  };

  const handleSave = async () => {
    if (!resource) return;
    setSaving(true);
    try {
      await updateResource(domain, resource.id, {
        name: editName.trim(),
        description: editDescription.trim(),
        // Only when picked: an edit of the name keeps an icon the console does not know
        ...(editIcon !== initialIcon(resource) && { icon: editIcon }),
      });
      toast({ title: t("domains.calendarResources.updated") });
      setEditing(false);
      await refresh();
    } catch (err) {
      toast({ title: t("domains.calendarResources.errorUpdating"), description: <ErrorDisplayer error={err} /> });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <Header
      headerTitle={resource ? resourceDisplayName(resource) : resourceId}
      headerSubTitle={t("domains.calendarResources.detailKind")}
      breadcrumb={breadcrumbs.resources(domain)}
      actions={resource && !editing && canEdit && (
        <Button variant="outline" size="sm" onClick={startEdit}>
          <Pencil className="w-4 h-4" aria-hidden="true" />
          {t("common.edit")}
        </Button>
      )}
    />
    <div className="mt-4 p-4 bg-white rounded-2">

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
          <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
        </div>
      )}
      {error && <p className="text-red-500 mt-2">{t("common.errorPrefix", { message: error })}</p>}

      {resource && (
        <>
          {editing ? (
            <div className="mt-2 space-y-2">
              <div>
                <label htmlFor={`${idPrefix}-name`} className="text-sm font-medium text-gray-500">{t("domains.calendarResources.fieldName")}</label>
                <input id={`${idPrefix}-name`} type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label htmlFor={`${idPrefix}-description`} className="text-sm font-medium text-gray-500">{t("domains.calendarResources.fieldDescription")}</label>
                <input id={`${idPrefix}-description`} type="text" value={editDescription} onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label id={`${idPrefix}-icon-label`} className="text-sm font-medium text-gray-500">{t("domains.calendarResources.iconLabel")}</label>
                <div className="mt-1"><ResourceIconPicker value={editIcon} onChange={setEditIcon} labelId={`${idPrefix}-icon-label`} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setEditing(false)}
                  className="px-4 py-2 border rounded-md text-sm hover:bg-gray-100 transition">{t("common.cancel")}</button>
                <button onClick={handleSave} disabled={saving || !editName.trim()}
                  className="flex items-center gap-1 px-4 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed">
                  <Save className="w-4 h-4" />
                  {saving ? t("domains.calendarResources.saving") : t("common.save")}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2 space-y-1 text-sm">
              <p><span className="text-gray-500 font-medium">{t("domains.calendarResources.fieldName")}:</span> {resource.name}</p>
              <p><span className="text-gray-500 font-medium">{t("domains.calendarResources.fieldResourceId")}:</span> {resource.id}</p>
              <p><span className="text-gray-500 font-medium">{t("domains.calendarResources.fieldDomain")}:</span> {domain}</p>
              {resource.description && (
                <p><span className="text-gray-500 font-medium">{t("domains.calendarResources.fieldDescription")}:</span> {resource.description}</p>
              )}
              {resource.icon && (
                <p className="flex items-center gap-2">
                  <span className="text-gray-500 font-medium">{t("domains.calendarResources.iconLabel")}:</span>
                  {isKnownResourceIcon(resource.icon) && (
                    <img src={`/icons/resources/${resource.icon}.svg`} alt="" className="w-5 h-5 inline-block" />
                  )}
                  {/* The name the picker gives it; an icon the console does not know, under its key */}
                  {t(`resourceIcons.${resource.icon}`, { defaultValue: resource.icon })}
                </p>
              )}
              {resource.creator && (
                <p><span className="text-gray-500 font-medium">{t("domains.calendarResources.fieldCreator")}:</span> <UserLink address={resource.creator} /></p>
              )}
            </div>
          )}

          <div className="mt-6">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="text-md font-semibold">{t("domains.calendarResources.administratorsLabel")}</h4>
              {canEdit && (
                <button onClick={() => setShowAddAdmin(true)} className="p-1 rounded-md hover:bg-gray-200 transition" title={t("domains.calendarResources.addAdminTooltip")}>
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>

            {admins.length > PAGE_LIMIT && (
              <PaginationControls
                onFirst={() => goToPage(1)}
                onPrev={() => goToPage(page - 1)}
                onNext={() => goToPage(page + 1)}
                onLast={() => goToPage(totalPages)}
                disabledPrev={page <= 1}
                disabledNext={page >= totalPages}
                label={t("common.page", { page, totalPages, total: admins.length })}
                total={admins.length}
              />
            )}

            <div>
              {paginated.map((admin, index) => (
                <div key={admin.email} className="space-y-1 p-4 bg-gray-50 rounded-2 my-2 flex justify-between items-center transition-colors hover:bg-gray-100">
                  <h4 className="text-sm font-medium leading-none">
                    <span className="text-gray-500 mr-2">{(page - 1) * PAGE_LIMIT + index + 1}/</span>
                    <UserLink address={admin.email} />
                  </h4>
                  {canEdit && (
                    <button onClick={() => handleRemoveAdmin(admin.email)} className="p-2 rounded-md hover:bg-gray-200" title={t("domains.calendarResources.removeAdminTooltip")}>
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  )}
                </div>
              ))}
              {admins.length === 0 && <p className="mt-2 text-sm text-gray-500">{t("domains.calendarResources.noAdmins")}</p>}
            </div>
          </div>
        </>
      )}
    </div>

    <FormDialog
      open={showAddAdmin}
      onClose={closeAddAdmin}
      title={t("domains.calendarResources.addAdminTooltip")}
      submitLabel={t("common.add")}
      submitDisabled={!canAddAdmin}
      onSubmit={handleAddAdmin}
    >
      <div>
        {/* The only field: named by the action, the modal title */}
        <UserSuggestInput autoFocus value={newAdmin} aria-label={t("domains.calendarResources.addAdminTooltip")} onValueChange={setNewAdmin}
          placeholder="admin@domain.tld" className={FIELD_CLASS} />
        {/* Reserved height: the status appearing does not resize the modal */}
        <p className="h-4 mt-1 text-xs">
          {trimmedAdmin && adminStatus === "checking" && <span className="text-gray-400">{t("common.checking")}</span>}
          {isAlreadyAdmin && <span className="text-orange-600">{t("domains.calendarResources.adminAlreadyExists")}</span>}
          {!isAlreadyAdmin && adminStatus === "exists" && <span className="text-green-700">{t("common.userExists")}</span>}
          {adminStatus === "not_found" && <span className="text-orange-600">{t("common.userNotFound")}</span>}
          {adminStatus === "invalid" && <span className="text-red-600">{t("common.invalidUsername")}</span>}
        </p>
      </div>
    </FormDialog>
    </>
  );
}
