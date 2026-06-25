import { useCallback, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Minus, Trash2, Save, Eye, EyeOff, Users, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { createUserAddressBook, deleteUserAddressBook, getUserAddressBooks, setUserAddressBookPublicRight, updateUserAddressBookInvitees } from "../api-client";
import { AddressBookShareUpdate, CreateUserAddressBookPayload, GetUserAddressBooksResponseType, UserAddressBook } from "../types";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { useCheckUserExists } from "@/hooks/use-check-user-exists";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  username: string;
}

const EMPTY_CREATE: CreateUserAddressBookPayload = {
  "dav:name": "",
  "carddav:description": "",
};

const PUBLIC_READ = "{DAV:}read";

type AddressBookRight = "read" | "read-write" | "administration";

const RIGHT_OPTIONS: AddressBookRight[] = ["read", "read-write", "administration"];

// dav:share-access values per WebDAV sharing spec
function rightToShareAccess(right: AddressBookRight): number {
  if (right === "read") return 2;
  if (right === "read-write") return 3;
  return 4;
}

function shareAccessToRight(access: number): AddressBookRight | null {
  if (access === 2) return "read";
  if (access === 3) return "read-write";
  if (access === 4) return "administration";
  return null;
}

function addressBookId(addressBook: UserAddressBook): string {
  const href = addressBook._links?.self?.href ?? "";
  const last = href.split("/").pop() ?? "";
  return last.replace(/\.json$/, "") || href;
}

function isPublic(addressBook: UserAddressBook): boolean {
  return (addressBook.acl ?? []).some(
    (a) =>
      a.principal === "{DAV:}authenticated" &&
      (a.privilege === "{DAV:}read" || a.privilege === "{DAV:}write" || a.privilege === "{DAV:}all")
  );
}

interface CurrentSharee {
  href: string;
  email: string;
  right: AddressBookRight | null;
}

function currentSharees(addressBook: UserAddressBook): CurrentSharee[] {
  return (addressBook.invite ?? [])
    .filter((i) => i.href?.startsWith("mailto:"))
    .map((i) => ({
      href: i.href,
      email: i.href.replace(/^mailto:/, ""),
      right: shareAccessToRight(i.access),
    }));
}

export default function UserAddressBooks({ username }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canView = useIsAllowed("GET", "/users/{username}/addressbooks");
  const canCreate = useIsAllowed("POST", "/users/{username}/addressbooks");
  const canDelete = useIsAllowed("DELETE", "/users/{username}/addressbooks/{addressBookId}");
  const canPublicRight = useIsAllowed("POST", "/users/{username}/addressbooks/{addressBookId}/publicRight");
  const canInvitees = useIsAllowed("POST", "/users/{username}/addressbooks/{addressBookId}/invitee");

  const fetchAddressBooks = useCallback(() => getUserAddressBooks(username), [username]);
  const { data, isLoading, error, refresh } = useFetchData<GetUserAddressBooksResponseType>(
    canView ? fetchAddressBooks : null
  );

  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserAddressBookPayload>({ ...EMPTY_CREATE });
  const [creating, setCreating] = useState(false);

  const [publicRightAddressBook, setPublicRightAddressBook] = useState<UserAddressBook | null>(null);
  const [publicRightValue, setPublicRightValue] = useState("");
  const [savingPublicRight, setSavingPublicRight] = useState(false);

  const [inviteesAddressBook, setInviteesAddressBook] = useState<UserAddressBook | null>(null);

  if (!canView) return null;

  const addressBooks = data?._embedded?.["dav:addressbook"] ?? [];

  const handleCreate = async () => {
    const name = createForm["dav:name"].trim();
    if (!name) return;
    setCreating(true);
    try {
      const payload: CreateUserAddressBookPayload = { "dav:name": name };
      if (createForm["carddav:description"]?.trim()) payload["carddav:description"] = createForm["carddav:description"]!.trim();
      await createUserAddressBook(username, payload);
      toast({ title: t("users.addressBooks.created") });
      setCreateForm({ ...EMPTY_CREATE });
      setShowCreate(false);
      await refresh();
    } catch (err) {
      toast({ title: t("users.addressBooks.errorCreate"), description: <ErrorDisplayer error={err} /> });
    } finally {
      setCreating(false);
    }
  };

  const openPublicRight = (addressBook: UserAddressBook) => {
    setPublicRightAddressBook(addressBook);
    setPublicRightValue(isPublic(addressBook) ? PUBLIC_READ : "");
  };

  const handleSavePublicRight = async () => {
    if (!publicRightAddressBook) return;
    setSavingPublicRight(true);
    try {
      await setUserAddressBookPublicRight(username, addressBookId(publicRightAddressBook), publicRightValue);
      toast({ title: t("users.addressBooks.publicRight.updated") });
      setPublicRightAddressBook(null);
      await refresh();
    } catch (err) {
      toast({ title: t("users.addressBooks.publicRight.errorUpdate"), description: <ErrorDisplayer error={err} /> });
    } finally {
      setSavingPublicRight(false);
    }
  };

  const handleDelete = async (addressBook: UserAddressBook) => {
    const confirmed = await confirm({
      header: t("users.addressBooks.deleteTitle"),
      message: t("users.addressBooks.deleteConfirm", { name: addressBook["dav:name"] }),
    });
    if (!confirmed) return;
    try {
      await deleteUserAddressBook(username, addressBookId(addressBook));
      toast({ title: t("users.addressBooks.deleted") });
      await refresh();
    } catch (err) {
      toast({ title: t("users.addressBooks.errorDelete"), description: <ErrorDisplayer error={err} /> });
    }
  };

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-md font-semibold hover:text-blue-600 transition"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {t("users.addressBooks.title")}
        {data && (
          <span className="text-sm font-normal text-gray-500">({addressBooks.length})</span>
        )}
      </button>

      {open && (
        <div className="mt-2 space-y-4">
          {isLoading && (
            <div className="h-[40px] rounded-2 animate-pulse bg-gray-200" />
          )}
          {error && <p className="text-red-500">Error: {error}</p>}

          {data && addressBooks.length === 0 && !canCreate && (
            <p className="text-sm text-gray-500">{t("users.addressBooks.empty")}</p>
          )}

          {data && (addressBooks.length > 0 || canCreate) && (
            <div>
              {canCreate && (
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => setShowCreate(true)}
                    className="p-1 rounded-md hover:bg-gray-200 transition"
                    title={t("users.addressBooks.createTitle")}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div className="space-y-1">
                {addressBooks.map((ab) => {
                  const isPublicAb = isPublic(ab);
                  return (
                    <div key={addressBookId(ab)} className="group flex items-start gap-3 py-1">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{ab["dav:name"]}</p>
                        {ab["carddav:description"] && (
                          <p className="text-xs text-gray-400">{ab["carddav:description"]}</p>
                        )}
                      </div>
                      {canInvitees && (
                        <button
                          onClick={() => setInviteesAddressBook(ab)}
                          className="p-1.5 rounded-md hover:bg-gray-200 transition"
                          title={t("users.addressBooks.invitees.title")}
                        >
                          <Users className="w-3.5 h-3.5 text-gray-600" />
                        </button>
                      )}
                      {canPublicRight && (
                        <button
                          onClick={() => openPublicRight(ab)}
                          className="p-1.5 rounded-md hover:bg-gray-200 transition"
                          title={isPublicAb ? t("users.addressBooks.publicRight.publicTitle") : t("users.addressBooks.publicRight.privateTitle")}
                        >
                          {isPublicAb
                            ? <Eye className="w-3.5 h-3.5 text-green-600" />
                            : <EyeOff className="w-3.5 h-3.5 text-gray-400" />}
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(ab)}
                          className="p-1.5 rounded-md hover:bg-gray-200 transition"
                          title={t("users.addressBooks.deleteTitle")}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create modal */}
      <Dialog open={showCreate} onOpenChange={(v) => { if (!v) { setShowCreate(false); setCreateForm({ ...EMPTY_CREATE }); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("users.addressBooks.createTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">{t("users.addressBooks.name")} *</label>
              <input
                type="text"
                value={createForm["dav:name"]}
                onChange={(e) => setCreateForm((f) => ({ ...f, "dav:name": e.target.value }))}
                className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t("users.addressBooks.description")}</label>
              <input
                type="text"
                value={createForm["carddav:description"] ?? ""}
                onChange={(e) => setCreateForm((f) => ({ ...f, "carddav:description": e.target.value }))}
                className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => { setShowCreate(false); setCreateForm({ ...EMPTY_CREATE }); }}>
                {t("common.cancel")}
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={creating || !createForm["dav:name"].trim()}
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                {t("common.create")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Public visibility modal */}
      <Dialog open={!!publicRightAddressBook} onOpenChange={(v) => { if (!v) setPublicRightAddressBook(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("users.addressBooks.publicRight.title")} — {publicRightAddressBook?.["dav:name"]}</DialogTitle>
          </DialogHeader>
          {publicRightAddressBook && (
            <div className="space-y-3">
              <label className="flex items-start gap-2 p-2 rounded-md hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name="ab-public-right"
                  className="mt-1"
                  checked={publicRightValue === ""}
                  onChange={() => setPublicRightValue("")}
                />
                <div>
                  <p className="text-sm font-medium">{t("users.addressBooks.publicRight.private")}</p>
                  <p className="text-xs text-gray-400">{t("users.addressBooks.publicRight.privateDesc")}</p>
                </div>
              </label>
              <label className="flex items-start gap-2 p-2 rounded-md hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name="ab-public-right"
                  className="mt-1"
                  checked={publicRightValue === PUBLIC_READ}
                  onChange={() => setPublicRightValue(PUBLIC_READ)}
                />
                <div>
                  <p className="text-sm font-medium">{t("users.addressBooks.publicRight.public")}</p>
                  <p className="text-xs text-gray-400">{t("users.addressBooks.publicRight.publicDesc")}</p>
                </div>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setPublicRightAddressBook(null)}>
                  {t("common.cancel")}
                </Button>
                <Button size="sm" onClick={handleSavePublicRight} disabled={savingPublicRight}>
                  {savingPublicRight ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                  {t("common.save")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Invitees (sharing) modal */}
      {inviteesAddressBook && (
        <InviteesModal
          username={username}
          addressBook={inviteesAddressBook}
          onClose={() => setInviteesAddressBook(null)}
          onSaved={async () => { setInviteesAddressBook(null); await refresh(); }}
        />
      )}
    </div>
  );
}

function InviteesModal({
  username,
  addressBook,
  onClose,
  onSaved,
}: {
  username: string;
  addressBook: UserAddressBook;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [removals, setRemovals] = useState<Set<string>>(new Set());
  const [changes, setChanges] = useState<Record<string, AddressBookRight>>({});
  const [additions, setAdditions] = useState<{ email: string; right: AddressBookRight }[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newRight, setNewRight] = useState<AddressBookRight>("read");
  const [saving, setSaving] = useState(false);

  const status = useCheckUserExists(newEmail);
  const existing = currentSharees(addressBook);

  const trimmedEmail = newEmail.trim();
  const isDuplicate =
    existing.some((i) => i.email === trimmedEmail && !removals.has(i.href)) ||
    additions.some((a) => a.email === trimmedEmail);
  const canAdd = status === "exists" && !isDuplicate;

  const toggleRemoval = (href: string) => {
    setRemovals((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  };

  const changeRight = (sharee: CurrentSharee, right: AddressBookRight) => {
    setChanges((prev) => {
      const next = { ...prev };
      if (right === sharee.right) delete next[sharee.href];
      else next[sharee.href] = right;
      return next;
    });
  };

  const changedHrefs = Object.keys(changes).filter((href) => !removals.has(href));
  const hasChanges = additions.length > 0 || removals.size > 0 || changedHrefs.length > 0;

  const handleStageAdd = () => {
    if (!canAdd) return;
    setAdditions((prev) => [...prev, { email: trimmedEmail, right: newRight }]);
    setNewEmail("");
    setNewRight("read");
  };

  const handleApply = async () => {
    // access code 5 = no access (revoke)
    const sharees: AddressBookShareUpdate["dav:sharee"] = [
      ...additions.map((a) => ({ "dav:href": `mailto:${a.email}`, "dav:share-access": rightToShareAccess(a.right) })),
      ...changedHrefs.map((href) => ({ "dav:href": href, "dav:share-access": rightToShareAccess(changes[href]) })),
      ...[...removals].map((href) => ({ "dav:href": href, "dav:share-access": 5 })),
    ];

    if (!sharees.length) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      await updateUserAddressBookInvitees(username, addressBookId(addressBook), { "dav:sharee": sharees });
      toast({ title: t("users.addressBooks.invitees.updated") });
      await onSaved();
    } catch (err) {
      toast({ title: t("users.addressBooks.invitees.errorUpdate"), description: <ErrorDisplayer error={err} /> });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("users.addressBooks.invitees.title")} — {addressBook["dav:name"]}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            {existing.length === 0 && additions.length === 0 && (
              <p className="text-sm text-gray-500">{t("users.addressBooks.invitees.empty")}</p>
            )}
            {existing.map((sharee) => {
              const removed = removals.has(sharee.href);
              const currentRight = changes[sharee.href] ?? sharee.right ?? "read";
              const changed = sharee.href in changes;
              return (
                <div key={sharee.href} className="flex items-center gap-2 py-1">
                  <span className={`flex-1 text-sm truncate ${removed ? "line-through text-gray-400" : ""}`}>
                    {sharee.email}
                  </span>
                  <select
                    value={currentRight}
                    disabled={removed}
                    onChange={(e) => changeRight(sharee, e.target.value as AddressBookRight)}
                    className={`px-2 py-1 border rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${changed ? "border-blue-400 text-blue-700" : ""}`}
                  >
                    {RIGHT_OPTIONS.map((r) => (
                      <option key={r} value={r}>{t(`users.addressBooks.invitees.rights.${r}`)}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => toggleRemoval(sharee.href)}
                    className="p-1.5 rounded-md hover:bg-gray-200 transition"
                    title={removed ? t("users.addressBooks.invitees.undoRemove") : t("users.addressBooks.invitees.remove")}
                  >
                    {removed
                      ? <Plus className="w-3.5 h-3.5 text-gray-500" />
                      : <Minus className="w-3.5 h-3.5 text-red-600" />}
                  </button>
                </div>
              );
            })}
            {additions.map((addition, index) => (
              <div key={`add-${addition.email}-${index}`} className="flex items-center gap-2 py-1">
                <span className="flex-1 text-sm truncate text-green-700">{addition.email}</span>
                <span className="text-xs text-gray-500 w-28 text-right">
                  {t(`users.addressBooks.invitees.rights.${addition.right}`)}
                </span>
                <button
                  onClick={() => setAdditions((prev) => prev.filter((_, i) => i !== index))}
                  className="p-1.5 rounded-md hover:bg-gray-200 transition"
                  title={t("users.addressBooks.invitees.remove")}
                >
                  <Minus className="w-3.5 h-3.5 text-red-600" />
                </button>
              </div>
            ))}
          </div>

          <div className="border-t pt-3 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleStageAdd()}
                placeholder={t("users.addressBooks.invitees.placeholder")}
                className="flex-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={newRight}
                onChange={(e) => setNewRight(e.target.value as AddressBookRight)}
                className="px-2 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {RIGHT_OPTIONS.map((r) => (
                  <option key={r} value={r}>{t(`users.addressBooks.invitees.rights.${r}`)}</option>
                ))}
              </select>
              <Button size="sm" onClick={handleStageAdd} disabled={!canAdd}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="h-4">
              {trimmedEmail && status === "checking" && (
                <span className="text-xs text-gray-400">{t("common.checking")}</span>
              )}
              {trimmedEmail && status === "exists" && isDuplicate && (
                <span className="text-xs text-orange-500">{t("users.addressBooks.invitees.alreadyShared")}</span>
              )}
              {trimmedEmail && status === "exists" && !isDuplicate && (
                <span className="text-xs text-green-600">{t("common.userExists")}</span>
              )}
              {trimmedEmail && status === "not_found" && (
                <span className="text-xs text-orange-500">{t("common.userNotFound")}</span>
              )}
              {trimmedEmail && status === "invalid" && (
                <span className="text-xs text-red-600">{t("common.invalidUsername")}</span>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleApply}
              disabled={saving || !hasChanges}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              {t("users.addressBooks.invitees.apply")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
