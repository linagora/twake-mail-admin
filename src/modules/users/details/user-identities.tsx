import { useCallback, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Pencil, Save, Loader2, Trash2 } from "lucide-react";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import {
  getUserIdentities,
  createUserIdentity,
  updateUserIdentity,
  deleteUserIdentity,
  JmapIdentity,
  JmapIdentityCreatePayload,
  JmapIdentityUpdatePayload,
} from "../api-client";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  username: string;
}

const EMPTY_CREATE: JmapIdentityCreatePayload = {
  name: "",
  email: "",
  textSignature: "",
  htmlSignature: "",
  sortOrder: 0,
};

export default function UserIdentities({ username }: Props) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const canView = useIsAllowed("GET", "/users/{username}/identities");
  const canCreate = useIsAllowed("POST", "/users/{username}/identities");
  const canEdit = useIsAllowed("PUT", "/users/{username}/identities/{id}");
  const canDelete = useIsAllowed("DELETE", "/users/{username}/identities/{id}");

  const fetchIdentities = useCallback(() => getUserIdentities(username), [username]);
  const { data: identities, isLoading, error, refresh } = useFetchData<JmapIdentity[]>(fetchIdentities);

  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<JmapIdentityCreatePayload>({ ...EMPTY_CREATE });
  const [creating, setCreating] = useState(false);

  // Detail modal (read-only)
  const [viewIdentity, setViewIdentity] = useState<JmapIdentity | null>(null);

  // Edit modal
  const [editIdentity, setEditIdentity] = useState<JmapIdentity | null>(null);
  const [editForm, setEditForm] = useState<JmapIdentityUpdatePayload>({});
  const [saving, setSaving] = useState(false);

  if (!canView) return null;

  const handleCreate = async () => {
    if (!createForm.name.trim() || !createForm.email.trim()) return;
    setCreating(true);
    try {
      await createUserIdentity(username, createForm);
      toast({ title: "Identity created" });
      setCreateForm({ ...EMPTY_CREATE });
      setShowCreate(false);
      await refresh();
    } catch (err) {
      toast({
        title: "Error creating identity",
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (identity: JmapIdentity) => {
    setViewIdentity(null);
    setEditIdentity(identity);
    setEditForm({
      name: identity.name,
      textSignature: identity.textSignature,
      htmlSignature: identity.htmlSignature,
      sortOrder: identity.sortOrder,
    });
  };

  const handleUpdate = async () => {
    if (!editIdentity) return;
    setSaving(true);
    try {
      await updateUserIdentity(username, editIdentity.id, editForm);
      toast({ title: "Identity updated" });
      setEditIdentity(null);
      setEditForm({});
      await refresh();
    } catch (err) {
      toast({
        title: "Error updating identity",
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (identity: JmapIdentity) => {
    const confirmed = await confirm({
      header: "Delete Identity",
      message: `Delete identity "${identity.name} <${identity.email}>"?`,
    });
    if (!confirmed) return;
    try {
      await deleteUserIdentity(username, identity.id);
      toast({ title: "Identity deleted" });
      setViewIdentity(null);
      await refresh();
    } catch (err) {
      toast({
        title: "Error deleting identity",
        description: <ErrorDisplayer error={err} />,
      });
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
          JMAP Identities
          {identities && (
            <span className="text-sm font-normal text-gray-500">
              ({identities.length})
            </span>
          )}
        </button>
        {open && canCreate && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="p-1 rounded-md hover:bg-gray-200 transition"
            title="Create identity"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2">
          {showCreate && (
            <div className="p-4 bg-blue-50 rounded-2 mb-2 space-y-2">
              <h5 className="text-sm font-semibold">New Identity</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Name"
                  className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="email@domain.tld"
                  className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500">Text Signature</label>
                  <textarea
                    value={createForm.textSignature ?? ""}
                    onChange={(e) => setCreateForm((f) => ({ ...f, textSignature: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">HTML Signature</label>
                  <textarea
                    value={createForm.htmlSignature ?? ""}
                    onChange={(e) => setCreateForm((f) => ({ ...f, htmlSignature: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Sort Order</label>
                <input
                  type="number"
                  value={createForm.sortOrder ?? 0}
                  onChange={(e) => setCreateForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                  className="w-20 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={creating || !createForm.name.trim() || !createForm.email.trim()}
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                  Create
                </Button>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            </div>
          )}
          {error && <p className="text-red-500 mt-2">Error: {error}</p>}

          {identities && (
            <div>
              {identities.map((identity, index) => (
                <div
                  key={identity.id}
                  className="p-4 bg-gray-50 rounded-2 my-2 flex justify-between items-start cursor-pointer hover:bg-gray-100 transition"
                  onClick={() => setViewIdentity(identity)}
                >
                  <div>
                    <h4 className="text-sm font-medium leading-none">
                      <span className="text-gray-500 mr-2">{index + 1}/</span>
                      {identity.name} &lt;{identity.email}&gt;
                    </h4>
                    <div className="mt-1 text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
                      <span>Sort: {identity.sortOrder}</span>
                      <span>Deletable: {identity.mayDelete ? "Yes" : "No"}</span>
                      {identity.replyTo?.length > 0 && (
                        <span>Reply-To: {identity.replyTo.map((r) => r.mailAddress).join(", ")}</span>
                      )}
                      {identity.bcc?.length > 0 && (
                        <span>BCC: {identity.bcc.map((b) => b.mailAddress).join(", ")}</span>
                      )}
                      {identity.textSignature && <span>Has text signature</span>}
                      {identity.htmlSignature && <span>Has HTML signature</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {canEdit && (
                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(identity); }}
                        className="p-2 rounded-md hover:bg-gray-200"
                        title="Edit identity"
                      >
                        <Pencil className="w-4 h-4 text-blue-600" />
                      </button>
                    )}
                    {canDelete && identity.mayDelete && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(identity); }}
                        className="p-2 rounded-md hover:bg-gray-200"
                        title="Delete identity"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {identities.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">No JMAP identities.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Detail (read-only) modal */}
      <Dialog open={!!viewIdentity} onOpenChange={(v) => !v && setViewIdentity(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Identity — {viewIdentity?.name}</DialogTitle>
          </DialogHeader>
          {viewIdentity && (
            <div className="space-y-3 text-sm">
              <Row label="ID" value={viewIdentity.id} />
              <Row label="Name" value={viewIdentity.name} />
              <Row label="Email" value={viewIdentity.email} />
              <Row label="Sort Order" value={String(viewIdentity.sortOrder)} />
              <Row label="May Delete" value={viewIdentity.mayDelete ? "Yes" : "No"} />
              {viewIdentity.replyTo?.length > 0 && (
                <Row
                  label="Reply-To"
                  value={viewIdentity.replyTo.map((r) => `${r.emailerName} <${r.mailAddress}>`).join(", ")}
                />
              )}
              {viewIdentity.bcc?.length > 0 && (
                <Row
                  label="BCC"
                  value={viewIdentity.bcc.map((b) => `${b.emailerName} <${b.mailAddress}>`).join(", ")}
                />
              )}
              {viewIdentity.textSignature && (
                <div>
                  <span className="text-gray-500 font-medium">Text Signature</span>
                  <pre className="mt-1 p-2 bg-gray-50 rounded text-xs whitespace-pre-wrap">{viewIdentity.textSignature}</pre>
                </div>
              )}
              {viewIdentity.htmlSignature && (
                <div>
                  <span className="text-gray-500 font-medium">HTML Signature</span>
                  <pre className="mt-1 p-2 bg-gray-50 rounded text-xs whitespace-pre-wrap">{viewIdentity.htmlSignature}</pre>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                {canDelete && viewIdentity.mayDelete && (
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(viewIdentity)}>
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                )}
                {canEdit && (
                  <Button size="sm" onClick={() => openEdit(viewIdentity)}>
                    <Pencil className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      <Dialog open={!!editIdentity} onOpenChange={(v) => { if (!v) { setEditIdentity(null); setEditForm({}); } }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Identity — {editIdentity?.email}</DialogTitle>
          </DialogHeader>
          {editIdentity && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Name</label>
                <input
                  type="text"
                  value={editForm.name ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Sort Order</label>
                <input
                  type="number"
                  value={editForm.sortOrder ?? 0}
                  onChange={(e) => setEditForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Text Signature</label>
                <textarea
                  value={editForm.textSignature ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, textSignature: e.target.value }))}
                  rows={3}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium">HTML Signature</label>
                <textarea
                  value={editForm.htmlSignature ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, htmlSignature: e.target.value }))}
                  rows={3}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => { setEditIdentity(null); setEditForm({}); }}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleUpdate} disabled={saving}>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-500 font-medium min-w-[100px]">{label}:</span>
      <span className="break-all">{value}</span>
    </div>
  );
}
