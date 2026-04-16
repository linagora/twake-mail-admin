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

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

export default function CalendarResourceDetail() {
  const { domain, resourceId } = useParams();
  const { toast } = useToast();
  const confirm = useConfirm();

  const fetchResource = useCallback(() => getResource(resourceId!), [resourceId]);
  const { data: resource, isLoading, error, refresh } = useFetchData<Resource>(fetchResource);

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
      toast({ title: "Administrator already exists" });
      return;
    }
    try {
      await updateResource(resource.id, {
        administrators: [...resource.administrators, { email }],
      });
      toast({ title: "Administrator added" });
      setNewAdmin("");
      await refresh();
    } catch (err) {
      toast({ title: "Error adding administrator", description: <ErrorDisplayer error={err} /> });
    }
  };

  const handleRemoveAdmin = async (email: string) => {
    if (!resource) return;
    const confirmed = await confirm({
      header: "Remove Administrator",
      message: `Remove "${email}" from resource "${resource.name}"?`,
    });
    if (!confirmed) return;
    try {
      await updateResource(resource.id, {
        administrators: resource.administrators.filter((a) => a.email !== email),
      });
      toast({ title: "Administrator removed" });
      await refresh();
    } catch (err) {
      toast({ title: "Error removing administrator", description: <ErrorDisplayer error={err} /> });
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
      await updateResource(resource.id, {
        name: editName.trim(),
        description: editDescription.trim(),
        icon: editIcon.trim(),
      });
      toast({ title: "Resource updated" });
      setEditing(false);
      await refresh();
    } catch (err) {
      toast({ title: "Error updating resource", description: <ErrorDisplayer error={err} /> });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 p-4 bg-white rounded-2">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Resource Details</h3>
        {resource && !editing && (
          <button onClick={startEdit}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50 transition">
            <Pencil className="w-4 h-4" />
            Edit
          </button>
        )}
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
          <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
        </div>
      )}
      {error && <p className="text-red-500 mt-2">Error: {error}</p>}

      {resource && (
        <>
          {editing ? (
            <div className="mt-2 space-y-2">
              <div>
                <label className="text-sm font-medium text-gray-500">Name</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Description</label>
                <input type="text" value={editDescription} onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Icon</label>
                <div className="mt-1"><ResourceIconPicker value={editIcon} onChange={setEditIcon} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setEditing(false)}
                  className="px-4 py-2 border rounded-md text-sm hover:bg-gray-100 transition">Cancel</button>
                <button onClick={handleSave} disabled={saving || !editName.trim()}
                  className="flex items-center gap-1 px-4 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed">
                  <Save className="w-4 h-4" />
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2 space-y-1 text-sm">
              <p><span className="text-gray-500 font-medium">Name:</span> {resource.name}</p>
              <p><span className="text-gray-500 font-medium">Domain:</span> {domain}</p>
              {resource.description && (
                <p><span className="text-gray-500 font-medium">Description:</span> {resource.description}</p>
              )}
              {resource.icon && (
                <p className="flex items-center gap-2">
                  <span className="text-gray-500 font-medium">Icon:</span>
                  <img src={`/icons/resources/${resource.icon}.svg`} alt={resource.icon} className="w-5 h-5 inline-block" />
                  {resource.icon}
                </p>
              )}
              {resource.creator && (
                <p><span className="text-gray-500 font-medium">Creator:</span> {resource.creator}</p>
              )}
            </div>
          )}

          <div className="mt-6">
            <h4 className="text-md font-semibold">Administrators</h4>
            <div className="flex gap-2 mt-3 mb-4">
              <input type="text" value={newAdmin} onChange={(e) => setNewAdmin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddAdmin()} placeholder="admin@domain.tld"
                className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {adminStatus === "checking" && <span className="flex items-center text-xs text-gray-400 whitespace-nowrap">Checking...</span>}
              {adminStatus === "exists" && <span className="flex items-center gap-1 text-xs text-green-600 whitespace-nowrap"><span className="inline-block w-2 h-2 rounded-full bg-green-500" />User exists</span>}
              {adminStatus === "not_found" && <span className="flex items-center gap-1 text-xs text-orange-500 whitespace-nowrap"><span className="inline-block w-2 h-2 rounded-full bg-orange-400" />User not found</span>}
              {adminStatus === "invalid" && <span className="flex items-center gap-1 text-xs text-red-600 whitespace-nowrap"><span className="inline-block w-2 h-2 rounded-full bg-red-500" />Invalid username</span>}
              <button onClick={handleAddAdmin} disabled={adminStatus !== "exists"}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed">Add</button>
            </div>

            {admins.length > PAGE_LIMIT && (
              <div className="mt-2 flex justify-between items-center">
                <button onClick={() => goToPage(1)} disabled={page <= 1}
                  className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed">First</button>
                <button onClick={() => goToPage(page - 1)} disabled={page <= 1}
                  className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
                <span className="text-sm font-medium text-center">Page {page} / {totalPages} — Total: {admins.length}</span>
                <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
                <button onClick={() => goToPage(totalPages)} disabled={page >= totalPages}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed">Last</button>
              </div>
            )}

            <div>
              {paginated.map((admin, index) => (
                <div key={admin.email} className="space-y-1 p-4 bg-gray-50 rounded-2 my-2 flex justify-between items-center">
                  <h4 className="text-sm font-medium leading-none">
                    <span className="text-gray-500 mr-2">{(page - 1) * PAGE_LIMIT + index + 1}/</span>
                    {admin.email}
                  </h4>
                  <button onClick={() => handleRemoveAdmin(admin.email)} className="p-2 rounded-md hover:bg-gray-200" title="Remove administrator">
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
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
