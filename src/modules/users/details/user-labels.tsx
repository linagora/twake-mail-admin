import { useCallback, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, Save, Loader2 } from "lucide-react";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getUserLabels, createUserLabel, updateUserLabel, deleteUserLabel } from "../api-client";
import { UserLabel, UserLabelCreatePayload, UserLabelUpdatePayload } from "../types";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  username: string;
}

const EMPTY_CREATE: UserLabelCreatePayload = {
  displayName: "",
  keyword: "",
  color: "",
  description: "",
};

export default function UserLabels({ username }: Props) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const canView = useIsAllowed("GET", "/users/{username}/labels");
  const canCreate = useIsAllowed("POST", "/users/{username}/labels");
  const canEdit = useIsAllowed("PATCH", "/users/{username}/labels/{labelId}");
  const canDelete = useIsAllowed("DELETE", "/users/{username}/labels/{labelId}");

  const fetchLabels = useCallback(() => getUserLabels(username), [username]);
  const { data: labels, isLoading, error, refresh } = useFetchData<UserLabel[]>(fetchLabels);

  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<UserLabelCreatePayload>({ ...EMPTY_CREATE });
  const [creating, setCreating] = useState(false);

  const [editLabel, setEditLabel] = useState<UserLabel | null>(null);
  const [editForm, setEditForm] = useState<UserLabelUpdatePayload>({ displayName: "" });
  const [saving, setSaving] = useState(false);

  if (!canView) return null;

  const handleCreate = async () => {
    if (!createForm.displayName.trim()) return;
    setCreating(true);
    try {
      const payload: UserLabelCreatePayload = {
        displayName: createForm.displayName.trim(),
      };
      if (createForm.keyword?.trim()) payload.keyword = createForm.keyword.trim();
      if (createForm.color?.trim()) payload.color = createForm.color.trim();
      if (createForm.description?.trim()) payload.description = createForm.description.trim();
      await createUserLabel(username, payload);
      toast({ title: "Label created" });
      setCreateForm({ ...EMPTY_CREATE });
      setShowCreate(false);
      await refresh();
    } catch (err) {
      toast({ title: "Error creating label", description: <ErrorDisplayer error={err} /> });
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (label: UserLabel) => {
    setEditLabel(label);
    setEditForm({
      displayName: label.displayName,
      color: label.color ?? "",
      description: label.description ?? "",
      readOnly: label.readOnly,
    });
  };

  const handleUpdate = async () => {
    if (!editLabel) return;
    setSaving(true);
    try {
      const payload: UserLabelUpdatePayload = {
        displayName: editForm.displayName,
        color: editForm.color?.trim() || null,
        description: editForm.description?.trim() || null,
        readOnly: editForm.readOnly,
      };
      await updateUserLabel(username, editLabel.id, payload);
      toast({ title: "Label updated" });
      setEditLabel(null);
      await refresh();
    } catch (err) {
      toast({ title: "Error updating label", description: <ErrorDisplayer error={err} /> });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (label: UserLabel) => {
    const confirmed = await confirm({
      header: "Delete Label",
      message: `Delete label "${label.displayName}"?`,
    });
    if (!confirmed) return;
    try {
      await deleteUserLabel(username, label.id);
      toast({ title: "Label deleted" });
      await refresh();
    } catch (err) {
      toast({ title: "Error deleting label", description: <ErrorDisplayer error={err} /> });
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
          Labels
          {labels && (
            <span className="text-sm font-normal text-gray-500">({labels.length})</span>
          )}
        </button>
        {open && canCreate && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="p-1 rounded-md hover:bg-gray-200 transition"
            title="Create label"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2">
          {showCreate && (
            <div className="p-4 bg-blue-50 rounded-2 mb-2 space-y-2">
              <h5 className="text-sm font-semibold">New Label</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500">Display Name *</label>
                  <input
                    type="text"
                    value={createForm.displayName}
                    onChange={(e) => setCreateForm((f) => ({ ...f, displayName: e.target.value }))}
                    placeholder="Work"
                    className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Keyword (optional)</label>
                  <input
                    type="text"
                    value={createForm.keyword ?? ""}
                    onChange={(e) => setCreateForm((f) => ({ ...f, keyword: e.target.value }))}
                    placeholder="auto-generated if empty"
                    className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500">Color (optional)</label>
                  <div className="flex gap-2 mt-1 items-center">
                    <input
                      type="color"
                      value={createForm.color?.trim() || "#000000"}
                      onChange={(e) => setCreateForm((f) => ({ ...f, color: e.target.value }))}
                      className="h-9 w-12 cursor-pointer border rounded-md"
                    />
                    <input
                      type="text"
                      value={createForm.color ?? ""}
                      onChange={(e) => setCreateForm((f) => ({ ...f, color: e.target.value }))}
                      placeholder="#ff0000"
                      className="flex-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Description (optional)</label>
                  <input
                    type="text"
                    value={createForm.description ?? ""}
                    onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Work emails"
                    className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => { setShowCreate(false); setCreateForm({ ...EMPTY_CREATE }); }}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={creating || !createForm.displayName.trim()}
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                  Create
                </Button>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="grid grid-cols-1 gap-4 mt-2">
              <div className="h-[40px] rounded-2 animate-pulse bg-gray-200" />
            </div>
          )}
          {error && <p className="text-red-500 mt-2">Error: {error}</p>}

          {labels && (
            <div className="mt-2 overflow-x-auto">
              {labels.length === 0 ? (
                <p className="text-sm text-gray-500">No labels configured.</p>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-left text-xs text-gray-500 uppercase">
                      <th className="px-3 py-2 font-medium">Display Name</th>
                      <th className="px-3 py-2 font-medium">Keyword</th>
                      <th className="px-3 py-2 font-medium">Color</th>
                      <th className="px-3 py-2 font-medium">Read Only</th>
                      <th className="px-3 py-2 font-medium">Description</th>
                      <th className="px-3 py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {labels.map((label) => (
                      <tr key={label.id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{label.displayName}</td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-600">{label.keyword}</td>
                        <td className="px-3 py-2">
                          {label.color ? (
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block w-4 h-4 rounded-full border border-gray-200 flex-shrink-0"
                                style={{ backgroundColor: label.color }}
                              />
                              <span className="text-xs text-gray-600">{label.color}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span className={label.readOnly ? "text-orange-600 font-medium" : "text-gray-400"}>
                            {label.readOnly ? "Yes" : "No"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600">{label.description ?? <span className="text-gray-400">—</span>}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1 justify-end">
                            {canEdit && (
                              <button
                                onClick={() => openEdit(label)}
                                className="p-1.5 rounded-md hover:bg-gray-200"
                                title="Edit label"
                              >
                                <Pencil className="w-3.5 h-3.5 text-blue-600" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => handleDelete(label)}
                                className="p-1.5 rounded-md hover:bg-gray-200"
                                title="Delete label"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* Edit modal */}
      <Dialog open={!!editLabel} onOpenChange={(v) => { if (!v) setEditLabel(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Label — {editLabel?.displayName}</DialogTitle>
          </DialogHeader>
          {editLabel && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Display Name *</label>
                <input
                  type="text"
                  value={editForm.displayName}
                  onChange={(e) => setEditForm((f) => ({ ...f, displayName: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Color</label>
                <div className="flex gap-2 mt-1 items-center">
                  <input
                    type="color"
                    value={editForm.color?.trim() || "#000000"}
                    onChange={(e) => setEditForm((f) => ({ ...f, color: e.target.value }))}
                    className="h-9 w-12 cursor-pointer border rounded-md"
                  />
                  <input
                    type="text"
                    value={editForm.color ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, color: e.target.value }))}
                    placeholder="#ff0000 (vide pour effacer)"
                    className="flex-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <input
                  type="text"
                  value={editForm.description ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="(vide pour effacer)"
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-readonly"
                  checked={editForm.readOnly ?? false}
                  onChange={(e) => setEditForm((f) => ({ ...f, readOnly: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="edit-readonly" className="text-sm font-medium">Read Only</label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setEditLabel(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleUpdate}
                  disabled={saving || !editForm.displayName.trim()}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                  Save
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
