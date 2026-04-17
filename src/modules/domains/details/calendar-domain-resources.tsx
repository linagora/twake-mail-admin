import { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getResources, createResource, deleteResource } from "../api-client";
import { Resource } from "../types";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { useCheckUserExists } from "@/hooks/use-check-user-exists";
import ResourceIconPicker from "@/components/custom/resource-icon-picker";
import ErrorDisplayer from "@/components/custom/error-displayer";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

interface Props {
  domain: string;
  defaultOpen?: boolean;
  resourceLink?: (resourceId: string) => string;
}

export default function CalendarDomainResources({ domain, defaultOpen = false, resourceLink }: Props) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const canView = useIsAllowed("GET", "/domains/{domain}/resources");
  const canCreate = useIsAllowed("POST", "/domains/{domain}/resources");
  const canDelete = useIsAllowed("DELETE", "/domains/{domain}/resources/{resourceId}");

  const fetchResources = useCallback(() => getResources(domain), [domain]);
  const { data: resources, isLoading, error, refresh } = useFetchData<Resource[]>(fetchResources);

  const [open, setOpen] = useState(defaultOpen);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newIcon, setNewIcon] = useState("home");
  const [newCreator, setNewCreator] = useState("");
  const creatorStatus = useCheckUserExists(newCreator);
  const [newAdminInput, setNewAdminInput] = useState("");
  const adminInputStatus = useCheckUserExists(newAdminInput);
  const [newAdministrators, setNewAdministrators] = useState<{ email: string }[]>([]);
  const [page, setPage] = useState(1);

  const active = useMemo(() => {
    if (!resources) return [];
    return resources.filter((r) => !r.deleted).sort((a, b) => a.name.localeCompare(b.name));
  }, [resources]);

  if (!canView) return null;

  const totalPages = Math.max(1, Math.ceil(active.length / PAGE_LIMIT));
  const paginated = active.slice((page - 1) * PAGE_LIMIT, page * PAGE_LIMIT);

  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

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

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name || !newCreator.trim() || creatorStatus !== "exists") return;
    try {
      await createResource({
        name,
        description: newDescription.trim(),
        icon: newIcon.trim(),
        domain,
        creator: newCreator.trim(),
        administrators: newAdministrators,
      });
      toast({ title: "Resource created" });
      setNewName("");
      setNewDescription("");
      setNewIcon("home");
      setNewCreator("");
      setNewAdminInput("");
      setNewAdministrators([]);
      setShowCreate(false);
      await refresh();
    } catch (err) {
      toast({ title: "Error creating resource", description: <ErrorDisplayer error={err} /> });
    }
  };

  const handleRemove = async (resource: Resource) => {
    const confirmed = await confirm({
      header: "Delete Resource",
      message: `Delete resource "${resource.name}"?`,
    });
    if (!confirmed) return;
    try {
      await deleteResource(domain, resource.id);
      toast({ title: "Resource deleted" });
      await refresh();
    } catch (err) {
      toast({ title: "Error deleting resource", description: <ErrorDisplayer error={err} /> });
    }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-md font-semibold hover:text-blue-600 transition"
        >
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          Resources
          {active.length > 0 && (
            <span className="text-sm font-normal text-gray-500">({active.length})</span>
          )}
        </button>
        {open && canCreate && (
          <button onClick={() => setShowCreate(!showCreate)} className="p-1 rounded-md hover:bg-gray-200 transition" title="Add resource">
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2">
          {showCreate && (
            <div className="p-4 bg-blue-50 rounded-2 mb-2 space-y-2">
              <h5 className="text-sm font-semibold">New Resource</h5>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name"
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="text" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Description (optional)"
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div>
                <label className="text-xs font-medium text-gray-500">Icon</label>
                <div className="mt-1"><ResourceIconPicker value={newIcon} onChange={setNewIcon} /></div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Creator <span className="text-red-500">*</span></label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="text" value={newCreator} onChange={(e) => setNewCreator(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()} placeholder="user@domain.tld"
                    className="flex-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  {creatorStatus === "checking" && <span className="text-xs text-gray-400 whitespace-nowrap">Checking...</span>}
                  {creatorStatus === "exists" && <span className="flex items-center gap-1 text-xs text-green-600 whitespace-nowrap"><span className="inline-block w-2 h-2 rounded-full bg-green-500" />User exists</span>}
                  {creatorStatus === "not_found" && <span className="flex items-center gap-1 text-xs text-orange-500 whitespace-nowrap"><span className="inline-block w-2 h-2 rounded-full bg-orange-400" />User not found</span>}
                  {creatorStatus === "invalid" && <span className="flex items-center gap-1 text-xs text-red-600 whitespace-nowrap"><span className="inline-block w-2 h-2 rounded-full bg-red-500" />Invalid username</span>}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Administrators</label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="text" value={newAdminInput} onChange={(e) => setNewAdminInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddAdmin()} placeholder="user@domain.tld"
                    className="flex-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  {adminInputStatus === "checking" && <span className="text-xs text-gray-400 whitespace-nowrap">Checking...</span>}
                  {adminInputStatus === "exists" && <span className="flex items-center gap-1 text-xs text-green-600 whitespace-nowrap"><span className="inline-block w-2 h-2 rounded-full bg-green-500" />User exists</span>}
                  {adminInputStatus === "not_found" && <span className="flex items-center gap-1 text-xs text-orange-500 whitespace-nowrap"><span className="inline-block w-2 h-2 rounded-full bg-orange-400" />User not found</span>}
                  {adminInputStatus === "invalid" && <span className="flex items-center gap-1 text-xs text-red-600 whitespace-nowrap"><span className="inline-block w-2 h-2 rounded-full bg-red-500" />Invalid username</span>}
                  <button onClick={handleAddAdmin} disabled={adminInputStatus !== "exists"}
                    className="px-3 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed">Add</button>
                </div>
                {newAdministrators.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {newAdministrators.map((a) => (
                      <div key={a.email} className="flex items-center justify-between px-3 py-1.5 bg-white border rounded-md text-sm">
                        <span>{a.email}</span>
                        <button onClick={() => handleRemoveNewAdmin(a.email)} className="p-1 rounded-md hover:bg-gray-100" title="Remove">
                          <Trash2 className="w-3 h-3 text-red-600" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowCreate(false)}
                  className="px-4 py-2 border rounded-md text-sm hover:bg-gray-100 transition">Cancel</button>
                <button onClick={handleAdd} disabled={!newName.trim() || creatorStatus !== "exists"}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed">Create</button>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            </div>
          )}
          {error && <p className="text-red-500 mt-2">Error: {error}</p>}

          {active.length > PAGE_LIMIT && (
            <div className="mt-2 flex justify-between items-center">
              <button onClick={() => goToPage(1)} disabled={page <= 1}
                className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed">First</button>
              <button onClick={() => goToPage(page - 1)} disabled={page <= 1}
                className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
              <span className="text-sm font-medium text-center">Page {page} / {totalPages} — Total: {active.length}</span>
              <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
              <button onClick={() => goToPage(totalPages)} disabled={page >= totalPages}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed">Last</button>
            </div>
          )}

          {resources && (
            <div>
              {paginated.map((resource, index) => (
                <div key={resource.id} className="space-y-1 p-4 bg-gray-50 rounded-2 my-2 flex justify-between items-center">
                  <h4 className="text-sm font-medium leading-none">
                    <span className="text-gray-500 mr-2">{(page - 1) * PAGE_LIMIT + index + 1}/</span>
                    <a href={resourceLink ? resourceLink(resource.id) : `/domains/domain/${encodeURIComponent(domain)}/resource/${encodeURIComponent(resource.id)}`}
                      className="text-blue-600 hover:underline">{resource.name}</a>
                    {resource.description && (
                      <span className="text-xs text-muted-foreground ml-2">{resource.description}</span>
                    )}
                  </h4>
                  {canDelete && (
                    <button onClick={(e) => { e.preventDefault(); handleRemove(resource); }}
                      className="p-2 rounded-md hover:bg-gray-200" title="Delete resource">
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  )}
                </div>
              ))}
              {active.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">No resources configured.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
