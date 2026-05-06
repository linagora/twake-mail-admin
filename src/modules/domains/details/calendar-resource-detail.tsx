import { useCallback, useMemo, useState } from "react";
import { useParams } from "react-router";
import { Pencil, Save, Trash2 } from "lucide-react";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getResource, updateResource } from "../api-client";
import { Resource } from "../types";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { useCheckUserExists } from "@/hooks/use-check-user-exists";
import ResourceIconPicker, { RESOURCE_ICONS } from "@/components/custom/resource-icon-picker";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { useDomain } from "@/modules/domain-admin/domain-context";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useTranslation } from "react-i18next";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

export default function CalendarResourceDetail() {
  const { t } = useTranslation();
  const { domain: domainParam, resourceId } = useParams();
  const domainContext = useDomain();
  // In GLOBAL mode domain comes from the URL; in DOMAIN mode it comes from context.
  const domain = domainParam || domainContext;
  const { toast } = useToast();
  const confirm = useConfirm();

  const fetchResource = useCallback(() => getResource(domain, resourceId!), [domain, resourceId]);
  const { data: resource, isLoading, error, refresh } = useFetchData<Resource>(fetchResource);

  const canEdit = useIsAllowed("PATCH", "/domains/{domain}/resources/{resourceId}");

  const [page, setPage] = useState(1);
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

  const handleAddAdmin = async () => {
    const email = newAdmin.trim();
    if (!email || !resource) return;
    const alreadyExists = resource.administrators.some((a) => a.email === email);
    if (alreadyExists) {
      toast({ title: t("domains.calendarResources.adminAlreadyExists") });
      return;
    }
    try {
      await updateResource(domain, resource.id, {
        administrators: [...resource.administrators, { email }],
      });
      toast({ title: t("domains.calendarResources.adminAdded") });
      setNewAdmin("");
      await refresh();
    } catch (err) {
      toast({ title: t("domains.calendarResources.errorAddingAdmin"), description: <ErrorDisplayer error={err} /> });
    }
  };

  const handleRemoveAdmin = async (email: string) => {
    if (!resource) return;
    const confirmed = await confirm({
      header: t("domains.calendarResources.removeAdminTitle"),
      message: t("domains.calendarResources.removeAdminConfirm", { email, name: resource.name }),
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
    setEditName(resource.name);
    setEditDescription(resource.description || "");
    setEditIcon(RESOURCE_ICONS.includes(resource.icon) ? resource.icon : "home");
    setEditing(true);
  };

  const handleSave = async () => {
    if (!resource) return;
    setSaving(true);
    try {
      await updateResource(domain, resource.id, {
        name: editName.trim(),
        description: editDescription.trim(),
        icon: editIcon.trim(),
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
    <div className="mt-4 p-4 bg-white rounded-2">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t("domains.calendarResources.detailTitle")}</h3>
        {resource && !editing && canEdit && (
          <button onClick={startEdit}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50 transition">
            <Pencil className="w-4 h-4" />
            {t("common.edit")}
          </button>
        )}
      </div>

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
                <label className="text-sm font-medium text-gray-500">{t("domains.calendarResources.fieldName")}</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">{t("domains.calendarResources.fieldDescription")}</label>
                <input type="text" value={editDescription} onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">{t("domains.calendarResources.iconLabel")}</label>
                <div className="mt-1"><ResourceIconPicker value={editIcon} onChange={setEditIcon} /></div>
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
                  <img src={`/icons/resources/${resource.icon}.svg`} alt={resource.icon} className="w-5 h-5 inline-block" />
                  {resource.icon}
                </p>
              )}
              {resource.creator && (
                <p><span className="text-gray-500 font-medium">{t("domains.calendarResources.fieldCreator")}:</span> {resource.creator}</p>
              )}
            </div>
          )}

          <div className="mt-6">
            <h4 className="text-md font-semibold">{t("domains.calendarResources.administratorsLabel")}</h4>
            {canEdit && (
            <div className="flex gap-2 mt-3 mb-4">
              <input type="text" value={newAdmin} onChange={(e) => setNewAdmin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddAdmin()} placeholder="admin@domain.tld"
                className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {adminStatus === "checking" && <span className="flex items-center text-xs text-gray-400 whitespace-nowrap">{t("common.checking")}</span>}
              {adminStatus === "exists" && <span className="flex items-center gap-1 text-xs text-green-600 whitespace-nowrap"><span className="inline-block w-2 h-2 rounded-full bg-green-500" />{t("common.userExists")}</span>}
              {adminStatus === "not_found" && <span className="flex items-center gap-1 text-xs text-orange-500 whitespace-nowrap"><span className="inline-block w-2 h-2 rounded-full bg-orange-400" />{t("common.userNotFound")}</span>}
              {adminStatus === "invalid" && <span className="flex items-center gap-1 text-xs text-red-600 whitespace-nowrap"><span className="inline-block w-2 h-2 rounded-full bg-red-500" />{t("common.invalidUsername")}</span>}
              <button onClick={handleAddAdmin} disabled={adminStatus !== "exists"}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed">{t("common.add")}</button>
            </div>
          )}

            {admins.length > PAGE_LIMIT && (
              <div className="mt-2 flex justify-between items-center">
                <button onClick={() => goToPage(1)} disabled={page <= 1}
                  className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed">{t("common.first")}</button>
                <button onClick={() => goToPage(page - 1)} disabled={page <= 1}
                  className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed">{t("common.previous")}</button>
                <span className="text-sm font-medium text-center">{t("common.page", { page, totalPages, total: admins.length })}</span>
                <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed">{t("common.next")}</button>
                <button onClick={() => goToPage(totalPages)} disabled={page >= totalPages}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed">{t("common.last")}</button>
              </div>
            )}

            <div>
              {paginated.map((admin, index) => (
                <div key={admin.email} className="space-y-1 p-4 bg-gray-50 rounded-2 my-2 flex justify-between items-center">
                  <h4 className="text-sm font-medium leading-none">
                    <span className="text-gray-500 mr-2">{(page - 1) * PAGE_LIMIT + index + 1}/</span>
                    {admin.email}
                  </h4>
                  {canEdit && (
                    <button onClick={() => handleRemoveAdmin(admin.email)} className="p-2 rounded-md hover:bg-gray-200" title="Remove administrator">
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  )}
                </div>
              ))}
              {admins.length === 0 && <p className="mt-2 text-sm text-gray-500">No administrators.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
