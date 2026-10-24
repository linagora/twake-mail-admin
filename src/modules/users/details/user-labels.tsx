import { useCallback, useId, useState } from "react";
import { Plus, Pencil, Trash2, Save, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getUserLabels, createUserLabel, updateUserLabel, deleteUserLabel } from "../api-client";
import { UserLabel, UserLabelCreatePayload, UserLabelUpdatePayload } from "../types";
import { buildLabelUpdatePayload, isColorClearAttempt } from "./user-label-update";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SectionToggle, useSectionOpen } from "@/components/custom/collapsible-section";
import FormDialog, { FIELD_CLASS } from "@/components/custom/form-dialog";

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
  const { t } = useTranslation();
  const idPrefix = useId();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canView = useIsAllowed("GET", "/users/{username}/labels");
  const canCreate = useIsAllowed("POST", "/users/{username}/labels");
  const canEdit = useIsAllowed("PATCH", "/users/{username}/labels/{labelId}");
  const canDelete = useIsAllowed("DELETE", "/users/{username}/labels/{labelId}");

  const fetchLabels = useCallback(() => getUserLabels(username), [username]);
  const { data: labels, isLoading, error, refresh } = useFetchData<UserLabel[]>(canView ? fetchLabels : null);

  const [open, setOpen, openContentId] = useSectionOpen("labels");
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<UserLabelCreatePayload>({ ...EMPTY_CREATE });

  const [editLabel, setEditLabel] = useState<UserLabel | null>(null);
  const [editForm, setEditForm] = useState<UserLabelUpdatePayload>({ displayName: "" });
  const [saving, setSaving] = useState(false);

  if (!canView) return null;

  // A refusal throws: the modal shows it and keeps the typed values
  const handleCreate = async () => {
    const payload: UserLabelCreatePayload = {
      displayName: createForm.displayName.trim(),
    };
    if (createForm.keyword?.trim()) payload.keyword = createForm.keyword.trim();
    if (createForm.color?.trim()) payload.color = createForm.color.trim();
    if (createForm.description?.trim()) payload.description = createForm.description.trim();
    await createUserLabel(username, payload);
    toast({ title: t("users.labels.created") });
    setCreateForm({ ...EMPTY_CREATE });
    await refresh();
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
      await updateUserLabel(username, editLabel.id, buildLabelUpdatePayload(editForm));
      toast({ title: t("users.labels.updated") });
      setEditLabel(null);
      await refresh();
    } catch (err) {
      toast({ title: t("users.labels.errorUpdating"), description: <ErrorDisplayer error={err} /> });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (label: UserLabel) => {
    const confirmed = await confirm({
      header: t("users.labels.deleteTitle"),
      destructive: true,
      confirmLabel: t("common.delete"),
      message: t("users.labels.deleteConfirm", { displayName: label.displayName }),
    });
    if (!confirmed) return;
    try {
      await deleteUserLabel(username, label.id);
      toast({ title: t("users.labels.deleted") });
      await refresh();
    } catch (err) {
      toast({ title: t("users.labels.errorDeleting"), description: <ErrorDisplayer error={err} /> });
    }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        <SectionToggle open={open} onToggle={() => setOpen(!open)} controls={openContentId}>
          {t("users.labels.title")}
          {labels && (
            <span className="text-sm font-normal text-gray-500">({labels.length})</span>
          )}
        </SectionToggle>
        {canCreate && (
          <button
            type="button"
            onClick={() => { setOpen(true); setCreateForm({ ...EMPTY_CREATE }); setShowCreate(true); }}
            className="p-1 rounded-md hover:bg-gray-200 transition"
            title={t("users.labels.createButton")}
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      <FormDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title={t("users.labels.newTitle")}
        submitLabel={t("common.create")}
        submitDisabled={!createForm.displayName.trim()}
        onSubmit={handleCreate}
      >
        <div>
          <label htmlFor={`${idPrefix}-create-displayName`} className="text-sm font-medium">{t("users.labels.displayNameLabel")}</label>
          <input
            autoFocus
            id={`${idPrefix}-create-displayName`}
            type="text"
            value={createForm.displayName}
            onChange={(e) => setCreateForm((f) => ({ ...f, displayName: e.target.value }))}
            placeholder={t("users.labels.displayNamePlaceholder")}
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-create-keyword`} className="text-sm font-medium">{t("users.labels.keyword")}</label>
          <input
            id={`${idPrefix}-create-keyword`}
            type="text"
            value={createForm.keyword ?? ""}
            onChange={(e) => setCreateForm((f) => ({ ...f, keyword: e.target.value }))}
            placeholder={t("users.labels.keywordHint")}
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-create-color`} className="text-sm font-medium">{t("users.labels.color")}</label>
          <div className="flex gap-2 mt-1 items-center">
            <input
              type="color"
              value={createForm.color?.trim() || "#000000"}
              onChange={(e) => setCreateForm((f) => ({ ...f, color: e.target.value }))}
              aria-label={t("users.labels.colorPicker")}
              className="h-9 w-12 cursor-pointer border rounded-md"
            />
            <input
              id={`${idPrefix}-create-color`}
              type="text"
              value={createForm.color ?? ""}
              onChange={(e) => setCreateForm((f) => ({ ...f, color: e.target.value }))}
              placeholder={t("users.labels.colorPlaceholder")}
              className="flex-1 px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-create-description`} className="text-sm font-medium">{t("users.labels.description")}</label>
          <input
            id={`${idPrefix}-create-description`}
            type="text"
            value={createForm.description ?? ""}
            onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
            placeholder={t("users.labels.descriptionPlaceholder")}
            className={FIELD_CLASS}
          />
        </div>
      </FormDialog>

      {open && (
        <div id={openContentId} className="mt-2">
          {isLoading && (
            <div className="grid grid-cols-1 gap-4 mt-2">
              <div className="h-[40px] rounded-2 animate-pulse bg-gray-200" />
            </div>
          )}
          {error && <p className="text-red-500 mt-2">{t("common.errorPrefix", { message: error })}</p>}

          {labels && (
            <div className="mt-2 overflow-x-auto">
              {labels.length === 0 ? (
                <p className="text-sm text-gray-500">{t("users.labels.empty")}</p>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-left text-xs text-gray-500 uppercase">
                      <th className="px-3 py-2 font-medium">{t("users.labels.displayName")}</th>
                      {/* On a phone, keyword, read-only and description move under the display name so the actions stay on screen */}
                      <th className="hidden md:table-cell px-3 py-2 font-medium">{t("users.labels.keywordLabel")}</th>
                      <th className="px-3 py-2 font-medium">{t("users.labels.colorLabel")}</th>
                      <th className="hidden md:table-cell px-3 py-2 font-medium">{t("users.labels.readOnly")}</th>
                      <th className="hidden md:table-cell px-3 py-2 font-medium">{t("users.labels.descriptionLabel")}</th>
                      <th className="px-3 py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {labels.map((label) => (
                      <tr key={label.id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <div className="font-medium break-all">{label.displayName}</div>
                          <div className="md:hidden mt-1 space-y-1 text-xs text-gray-600" data-testid="label-phone-details">
                            <div className="font-mono break-all">{label.keyword}</div>
                            {label.readOnly && <div className="text-orange-600 font-medium">{t("users.labels.readOnly")}</div>}
                            {label.description && <div className="break-words">{label.description}</div>}
                          </div>
                        </td>
                        <td className="hidden md:table-cell px-3 py-2 font-mono text-xs text-gray-600">{label.keyword}</td>
                        <td className="px-3 py-2">
                          {label.color ? (
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block w-4 h-4 rounded-full border border-gray-200 shrink-0"
                                style={{ backgroundColor: label.color }}
                              />
                              <span className="text-xs text-gray-600">{label.color}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="hidden md:table-cell px-3 py-2">
                          <span className={label.readOnly ? "text-orange-600 font-medium" : "text-gray-400"}>
                            {label.readOnly ? t("common.yes") : t("common.no")}
                          </span>
                        </td>
                        <td className="hidden md:table-cell px-3 py-2 text-gray-600">{label.description ?? <span className="text-gray-400">—</span>}</td>
                        <td className="px-3 py-2 w-px">
                          <div className="flex gap-1 justify-end">
                            {canEdit && (
                              <button
                                onClick={() => openEdit(label)}
                                className="p-1.5 rounded-md hover:bg-gray-200"
                                title={t("users.labels.editTooltip")}
                              >
                                <Pencil className="w-3.5 h-3.5 text-blue-600" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => handleDelete(label)}
                                className="p-1.5 rounded-md hover:bg-gray-200"
                                title={t("users.labels.deleteTooltip")}
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
            <DialogTitle>{t("users.labels.editTitle", { displayName: editLabel?.displayName })}</DialogTitle>
          </DialogHeader>
          {editLabel && (
            <form
              className="space-y-3"
              onSubmit={(e) => { e.preventDefault(); if (!saving && editForm.displayName.trim()) handleUpdate(); }}
            >
              <div>
                <label htmlFor={`${idPrefix}-edit-displayName`} className="text-sm font-medium">{t("users.labels.displayNameLabel")}</label>
                <input
                  id={`${idPrefix}-edit-displayName`}
                  type="text"
                  value={editForm.displayName}
                  onChange={(e) => setEditForm((f) => ({ ...f, displayName: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor={`${idPrefix}-edit-color`} className="text-sm font-medium">{t("users.labels.colorLabel")}</label>
                <div className="flex gap-2 mt-1 items-center">
                  <input
                    type="color"
                    value={editForm.color?.trim() || editLabel?.color || "#000000"}
                    onChange={(e) => setEditForm((f) => ({ ...f, color: e.target.value }))}
                    aria-label={t("users.labels.colorPicker")}
                    className="h-9 w-12 cursor-pointer border rounded-md"
                  />
                  <input
                    id={`${idPrefix}-edit-color`}
                    type="text"
                    value={editForm.color ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, color: e.target.value }))}
                    placeholder={t("users.labels.colorEdit")}
                    className="flex-1 px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {isColorClearAttempt(editLabel, editForm) && (
                  <p className="mt-1 text-xs text-orange-600">
                    {t("users.labels.colorCannotBeCleared", { color: editLabel.color })}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor={`${idPrefix}-edit-description`} className="text-sm font-medium">{t("users.labels.descriptionLabel")}</label>
                <input
                  id={`${idPrefix}-edit-description`}
                  type="text"
                  value={editForm.description ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder={t("users.labels.descriptionEdit")}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
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
                <label htmlFor="edit-readonly" className="text-sm font-medium">{t("users.labels.readOnly")}</label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditLabel(null)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={saving || !editForm.displayName.trim()}
                >
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
