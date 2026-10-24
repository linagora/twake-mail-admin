import { useCallback, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Save, Loader2, Trash2 } from "lucide-react";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { useUserMappingsRevision } from "./user-mappings-revision";
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
import { useReturnFocus } from "@/hooks/use-return-focus";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SectionToggle, useSectionOpen } from "@/components/custom/collapsible-section";
import FormDialog, { FIELD_CLASS } from "@/components/custom/form-dialog";

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
  const idPrefix = useId();
  const canView = useIsAllowed("GET", "/users/{username}/identities");
  const canCreate = useIsAllowed("POST", "/users/{username}/identities");
  const canEdit = useIsAllowed("PUT", "/users/{username}/identities/{id}");
  const canDelete = useIsAllowed("DELETE", "/users/{username}/identities/{id}");

  const { revision } = useUserMappingsRevision();
  const fetchIdentities = useCallback(() => getUserIdentities(username), [username]);
  const { data: identities, isLoading, error, refresh } = useFetchData<JmapIdentity[]>(canView ? fetchIdentities : null, revision);

  const [open, setOpen, openContentId] = useSectionOpen("identities");
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<JmapIdentityCreatePayload>({ ...EMPTY_CREATE });

  // Detail modal (read-only)
  const [viewIdentity, setViewIdentity] = useState<JmapIdentity | null>(null);

  // Edit modal
  const [editIdentity, setEditIdentity] = useState<JmapIdentity | null>(null);
  const [editForm, setEditForm] = useState<JmapIdentityUpdatePayload>({});
  const [saving, setSaving] = useState(false);

  // Both modals are controlled: bring the focus back to the row control that opened them
  const { rememberFocus, restoreFocus } = useReturnFocus();

  if (!canView) return null;

  // A refusal throws: the modal shows it and keeps the typed values
  const handleCreate = async () => {
    await createUserIdentity(username, createForm);
    toast({ title: t("users.identities.created") });
    setCreateForm({ ...EMPTY_CREATE });
    await refresh();
  };

  const openView = (identity: JmapIdentity) => {
    rememberFocus();
    setViewIdentity(identity);
  };

  const openEditFromList = (identity: JmapIdentity) => {
    rememberFocus();
    openEdit(identity);
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
      destructive: true,
      confirmLabel: t("common.delete"),
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
        <SectionToggle open={open} onToggle={() => setOpen(!open)} controls={openContentId}>
          {t("users.identities.title")}
          {identities && (
            <span className="text-sm font-normal text-gray-500">
              ({identities.length})
            </span>
          )}
        </SectionToggle>
        {canCreate && (
          <button
            type="button"
            onClick={() => { setOpen(true); setCreateForm({ ...EMPTY_CREATE }); setShowCreate(true); }}
            className="p-1 rounded-md hover:bg-gray-200 transition"
            title={t("users.identities.createButton")}
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* The address is checked by the server, as before */}
      <FormDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title={t("users.identities.newTitle")}
        submitLabel={t("common.create")}
        submitDisabled={!createForm.name.trim() || !createForm.email.trim()}
        onSubmit={handleCreate}
      >
        <div>
          <label htmlFor={`${idPrefix}-create-name`} className="text-sm font-medium">{t("users.identities.name")}</label>
          <input
            autoFocus
            id={`${idPrefix}-create-name`}
            type="text"
            value={createForm.name}
            onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={t("users.identities.namePlaceholder")}
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-create-email`} className="text-sm font-medium">{t("users.identities.email")}</label>
          <input
            id={`${idPrefix}-create-email`}
            type="email"
            value={createForm.email}
            onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
            placeholder={t("users.identities.emailPlaceholder")}
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-create-text-signature`} className="text-sm font-medium">{t("users.identities.textSignature")}</label>
          <textarea
            id={`${idPrefix}-create-text-signature`}
            value={createForm.textSignature ?? ""}
            onChange={(e) => setCreateForm((f) => ({ ...f, textSignature: e.target.value }))}
            rows={2}
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-create-html-signature`} className="text-sm font-medium">{t("users.identities.htmlSignature")}</label>
          <textarea
            id={`${idPrefix}-create-html-signature`}
            value={createForm.htmlSignature ?? ""}
            onChange={(e) => setCreateForm((f) => ({ ...f, htmlSignature: e.target.value }))}
            rows={2}
            className={FIELD_CLASS}
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={`${idPrefix}-create-sort-order`} className="text-sm font-medium">{t("users.identities.sortOrder")}</label>
          <input
            id={`${idPrefix}-create-sort-order`}
            type="number"
            value={createForm.sortOrder ?? 0}
            onChange={(e) => setCreateForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
            className="w-20 px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </FormDialog>

      {open && (
        <div id={openContentId} className="mt-2">
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
                  onClick={() => openView(identity)}
                >
                  {/* min-w-0 lets an unbroken name or address wrap instead of widening the page */}
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-medium leading-none">
                      <span className="text-gray-500 mr-2">{index + 1}/</span>
                      {/* A real button (the row itself holds the edit and delete buttons) so the detail opens from the keyboard */}
                      <button
                        type="button"
                        className="text-left break-all rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        onClick={(e) => { e.stopPropagation(); openView(identity); }}
                      >
                        {identity.name} &lt;{identity.email}&gt;
                      </button>
                    </h4>
                    <div className="mt-1 text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
                      <span>{t("users.identities.sort")} {identity.sortOrder}</span>
                      <span>{t("users.identities.deletable")} {identity.mayDelete ? t("common.yes") : t("common.no")}</span>
                      {identity.replyTo?.length > 0 && (
                        <span className="break-all">Reply-To: {identity.replyTo.map((r) => r.mailAddress).join(", ")}</span>
                      )}
                      {identity.bcc?.length > 0 && (
                        <span className="break-all">BCC: {identity.bcc.map((b) => b.mailAddress).join(", ")}</span>
                      )}
                      {identity.textSignature && <span>{t("users.identities.hasTextSignature")}</span>}
                      {identity.htmlSignature && <span>{t("users.identities.hasHtmlSignature")}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {canEdit && (
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditFromList(identity); }}
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
        <DialogContent aria-describedby={undefined}
          className="max-w-lg"
          // Switching to the edit modal: the focus goes there, and back to the row once it closes
          onCloseAutoFocus={(e) => (editIdentity ? e.preventDefault() : restoreFocus(e))}
        >
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
        <DialogContent aria-describedby={undefined} className="max-w-lg" onCloseAutoFocus={restoreFocus}>
          <DialogHeader>
            <DialogTitle>{t("users.identities.editTitle", { name: editIdentity?.name })}</DialogTitle>
          </DialogHeader>
          {editIdentity && (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!saving) handleUpdate(); }}>
              <div>
                <label htmlFor={`${idPrefix}-edit-name`} className="text-sm font-medium">{t("users.identities.name")}</label>
                <input
                  id={`${idPrefix}-edit-name`}
                  type="text"
                  value={editForm.name ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor={`${idPrefix}-edit-sort-order`} className="text-sm font-medium">{t("users.identities.sortOrder")}</label>
                <input
                  id={`${idPrefix}-edit-sort-order`}
                  type="number"
                  value={editForm.sortOrder ?? 0}
                  onChange={(e) => setEditForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor={`${idPrefix}-edit-text-signature`} className="text-sm font-medium">{t("users.identities.textSignature")}</label>
                <textarea
                  id={`${idPrefix}-edit-text-signature`}
                  value={editForm.textSignature ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, textSignature: e.target.value }))}
                  rows={3}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor={`${idPrefix}-edit-html-signature`} className="text-sm font-medium">{t("users.identities.htmlSignature")}</label>
                <textarea
                  id={`${idPrefix}-edit-html-signature`}
                  value={editForm.htmlSignature ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, htmlSignature: e.target.value }))}
                  rows={3}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => { setEditIdentity(null); setEditForm({}); }}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                  {t("common.save")}
                </Button>
              </div>
            </form>
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
