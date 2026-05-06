import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canView = useIsAllowed("GET", "/users/{username}/identities");
  const canCreate = useIsAllowed("POST", "/users/{username}/identities");
  const canEdit = useIsAllowed("PUT", "/users/{username}/identities/{id}");
  const canDelete = useIsAllowed("DELETE", "/users/{username}/identities/{id}");

  const fetchIdentities = useCallback(() => getUserIdentities(username), [username]);
  const { data: identities, isLoading, error, refresh } = useFetchData<JmapIdentity[]>(canView ? fetchIdentities : null);

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
      toast({ title: t("users.identities.created") });
      setCreateForm({ ...EMPTY_CREATE });
      setShowCreate(false);
      await refresh();
    } catch (err) {
      toast({
        title: t("users.identities.errorCreating"),
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
      toast({ title: t("users.identities.updated") });
      setEditIdentity(null);
      setEditForm({});
      await refresh();
    } catch (err) {
      toast({
        title: t("users.identities.errorUpdating"),
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (identity: JmapIdentity) => {
    const confirmed = await confirm({
      header: t("users.identities.deleteTitle"),
      message: t("users.identities.deleteConfirm", { name: identity.name, email: identity.email }),
    });
    if (!confirmed) return;
    try {
      await deleteUserIdentity(username, identity.id);
      toast({ title: t("users.identities.deleted") });
      setViewIdentity(null);
      await refresh();
    } catch (err) {
      toast({
        title: t("users.identities.errorDeleting"),
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
          {t("users.identities.title")}
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
            title={t("users.identities.createButton")}
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2">
          {showCreate && (
            <div className="p-4 bg-blue-50 rounded-2 mb-2 space-y-2">
              <h5 className="text-sm font-semibold">{t("users.identities.newTitle")}</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={t("users.identities.namePlaceholder")}
                  className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder={t("users.identities.emailPlaceholder")}
                  className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500">{t("users.identities.textSignature")}</label>
                  <textarea
                    value={createForm.textSignature ?? ""}
                    onChange={(e) => setCreateForm((f) => ({ ...f, textSignature: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">{t("users.identities.htmlSignature")}</label>
                  <textarea
                    value={createForm.htmlSignature ?? ""}
                    onChange={(e) => setCreateForm((f) => ({ ...f, htmlSignature: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">{t("users.identities.sortOrder")}</label>
                <input
                  type="number"
                  value={createForm.sortOrder ?? 0}
                  onChange={(e) => setCreateForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                  className="w-20 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={creating || !createForm.name.trim() || !createForm.email.trim()}
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                  {t("common.create")}
                </Button>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            </div>
          )}
          {error && <p className="text-red-500 mt-2">{t("common.errorPrefix", { message: error })}</p>}

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
                      <span>{t("users.identities.sort")} {identity.sortOrder}</span>
                      <span>{t("users.identities.deletable")} {identity.mayDelete ? t("common.yes") : t("common.no")}</span>
                      {identity.replyTo?.length > 0 && (
                        <span>Reply-To: {identity.replyTo.map((r) => r.mailAddress).join(", ")}</span>
                      )}
                      {identity.bcc?.length > 0 && (
                        <span>BCC: {identity.bcc.map((b) => b.mailAddress).join(", ")}</span>
                      )}
                      {identity.textSignature && <span>{t("users.identities.hasTextSignature")}</span>}
                      {identity.htmlSignature && <span>{t("users.identities.hasHtmlSignature")}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {canEdit && (
                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(identity); }}
                        className="p-2 rounded-md hover:bg-gray-200"
                        title={t("users.identities.editTooltip")}
                      >
                        <Pencil className="w-4 h-4 text-blue-600" />
                      </button>
                    )}
                    {canDelete && identity.mayDelete && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(identity); }}
                        className="p-2 rounded-md hover:bg-gray-200"
                        title={t("users.identities.deleteTooltip")}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {identities.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">{t("users.identities.empty")}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Detail (read-only) modal */}
      <Dialog open={!!viewIdentity} onOpenChange={(v) => !v && setViewIdentity(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("users.identities.viewTitle", { name: viewIdentity?.name })}</DialogTitle>
          </DialogHeader>
          {viewIdentity && (
            <div className="space-y-3 text-sm">
              <Row label={t("users.identities.id")} value={viewIdentity.id} />
              <Row label={t("users.identities.name")} value={viewIdentity.name} />
              <Row label={t("users.identities.email")} value={viewIdentity.email} />
              <Row label={t("users.identities.sortOrder")} value={String(viewIdentity.sortOrder)} />
              <Row label={t("users.identities.mayDelete")} value={viewIdentity.mayDelete ? t("common.yes") : t("common.no")} />
              {viewIdentity.replyTo?.length > 0 && (
                <Row
                  label={t("users.identities.replyTo")}
                  value={viewIdentity.replyTo.map((r) => `${r.emailerName} <${r.mailAddress}>`).join(", ")}
                />
              )}
              {viewIdentity.bcc?.length > 0 && (
                <Row
                  label={t("users.identities.bcc")}
                  value={viewIdentity.bcc.map((b) => `${b.emailerName} <${b.mailAddress}>`).join(", ")}
                />
              )}
              {viewIdentity.textSignature && (
                <div>
                  <span className="text-gray-500 font-medium">{t("users.identities.textSignature")}</span>
                  <pre className="mt-1 p-2 bg-gray-50 rounded text-xs whitespace-pre-wrap">{viewIdentity.textSignature}</pre>
                </div>
              )}
              {viewIdentity.htmlSignature && (
                <div>
                  <span className="text-gray-500 font-medium">{t("users.identities.htmlSignature")}</span>
                  <pre className="mt-1 p-2 bg-gray-50 rounded text-xs whitespace-pre-wrap">{viewIdentity.htmlSignature}</pre>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                {canDelete && viewIdentity.mayDelete && (
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(viewIdentity)}>
                    <Trash2 className="w-4 h-4 mr-1" />
                    {t("common.delete")}
                  </Button>
                )}
                {canEdit && (
                  <Button size="sm" onClick={() => openEdit(viewIdentity)}>
                    <Pencil className="w-4 h-4 mr-1" />
                    {t("common.edit")}
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
            <DialogTitle>{t("users.identities.editTitle", { email: editIdentity?.email })}</DialogTitle>
          </DialogHeader>
          {editIdentity && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">{t("users.identities.name")}</label>
                <input
                  type="text"
                  value={editForm.name ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t("users.identities.sortOrder")}</label>
                <input
                  type="number"
                  value={editForm.sortOrder ?? 0}
                  onChange={(e) => setEditForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t("users.identities.textSignature")}</label>
                <textarea
                  value={editForm.textSignature ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, textSignature: e.target.value }))}
                  rows={3}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t("users.identities.htmlSignature")}</label>
                <textarea
                  value={editForm.htmlSignature ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, htmlSignature: e.target.value }))}
                  rows={3}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => { setEditIdentity(null); setEditForm({}); }}>
                  {t("common.cancel")}
                </Button>
                <Button size="sm" onClick={handleUpdate} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                  {t("common.save")}
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
