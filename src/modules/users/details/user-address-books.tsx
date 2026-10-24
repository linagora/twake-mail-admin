import { useCallback, useId, useState } from "react";
import UserLink from "@/components/custom/user-link";
import { Contact, Plus, Minus, Pencil, Trash2, Save, Eye, EyeOff, Users, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TFunction } from "i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { createUserAddressBook, deleteUserAddressBook, exportUserAddressBook, getUserAddressBookContactCount, getUserAddressBooks, importUserAddressBook, setUserAddressBookPublicRight, updateUserAddressBook, updateUserAddressBookInvitees } from "../api-client";
import { AddressBookShareUpdate, CreateUserAddressBookPayload, GetUserAddressBooksResponseType, UpdateUserAddressBookPayload, UserAddressBook } from "../types";
import { addressBookKeys } from "./address-book-keys";
import { ADDRESS_BOOK_RIGHTS, AddressBookRight, SHARE_ACCESS_NO_ACCESS, rightToShareAccess } from "./address-book-share-access";
import { CurrentSharee, currentSharees, userEmailsById } from "./address-book-sharees";
import { ownerEmail, parseAddressBookSource } from "./address-book-source";
import { CollectionCountBadge, ExportCollectionButton, ImportCollectionButton } from "@/components/custom/dav-collection-actions";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { useCheckUserExists } from "@/hooks/use-check-user-exists";
import { useDomain } from "@/modules/domain-admin/domain-context";
import { getRegisteredUsers } from "@/modules/registered-users/api-client";
import { RegisteredUser } from "@/modules/registered-users/types";
import ErrorDisplayer from "@/components/custom/error-displayer";
import FormDialog, { FIELD_CLASS } from "@/components/custom/form-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SectionToggle, useSectionFact, useSectionOpen } from "@/components/custom/collapsible-section";
import SharedWithChip from "@/components/custom/shared-with-chip";
import { StagedChangesNotice, blocksSave, useDiscardGuard } from "@/components/custom/staged-changes";
import UserSuggestInput from "@/components/custom/user-suggest-input";

interface Props {
  username: string;
  // Open on a first visit of the page
  defaultOpen?: boolean;
}

const EMPTY_CREATE: CreateUserAddressBookPayload = {
  "dav:name": "",
  "carddav:description": "",
};

const PUBLIC_READ = "{DAV:}read";

const RIGHT_OPTIONS = ADDRESS_BOOK_RIGHTS;

function addressBookId(addressBook: UserAddressBook): string {
  const href = addressBook._links?.self?.href ?? "";
  const last = href.split("/").pop() ?? "";
  return last.replace(/\.json$/, "") || href;
}

// The sharee's mirror of a shared address book has no name of its own: the
// source one is more telling than the technical id of the mirror.
// Every user owns the "contacts" and "collected" address books, created by the
// DAV server: WebAdmin refuses to rename or delete them.
const SYSTEM_ADDRESS_BOOK_IDS = ["contacts", "collected"] as const;
type SystemAddressBookId = (typeof SYSTEM_ADDRESS_BOOK_IDS)[number];

function asSystemAddressBookId(id: string | undefined): SystemAddressBookId | null {
  return SYSTEM_ADDRESS_BOOK_IDS.find((systemId) => systemId === id) ?? null;
}

function systemAddressBookId(addressBook: UserAddressBook): SystemAddressBookId | null {
  if (!isOwned(addressBook)) return null;
  return asSystemAddressBookId(addressBookId(addressBook));
}

// A mirror without a name of its own is named as on its owner's page.
function sourceAddressBookName(addressBook: UserAddressBook, t: TFunction): string | null {
  const sourceId = parseAddressBookSource(addressBook["openpaas:source"])?.addressBookId;
  const systemId = asSystemAddressBookId(sourceId);
  if (systemId) return t(`users.addressBooks.system.${systemId}`);
  return sourceId ?? null;
}

function addressBookName(addressBook: UserAddressBook, t: TFunction): string {
  const systemId = systemAddressBookId(addressBook);
  if (systemId) return t(`users.addressBooks.system.${systemId}`);
  return addressBook["dav:name"]?.trim()
    || sourceAddressBookName(addressBook, t)
    || addressBookId(addressBook);
}

// A shared or subscribed address book is a mirror of its owner's one: it can be
// counted and read, but exporting or importing belongs to the owner.
function isOwned(addressBook: UserAddressBook): boolean {
  return addressBook["openpaas:source"] == null;
}

const SHARE_PRIVILEGES = ["{DAV:}share", "{DAV:}all"];

// Sharing an address book, or changing its visibility, takes the {DAV:}share
// privilege: the owner has it, the sharee of a mirror only through an
// "Administration" share, which the mirror ACL grants to the user principal.
function canManageSharing(addressBook: UserAddressBook): boolean {
  return isOwned(addressBook) || (addressBook.acl ?? []).some(
    (a) => a.principal?.startsWith("principals/users/") && SHARE_PRIVILEGES.includes(a.privilege)
  );
}

function isPublic(addressBook: UserAddressBook): boolean {
  return (addressBook.acl ?? []).some(
    (a) =>
      a.principal === "{DAV:}authenticated" &&
      (a.privilege === "{DAV:}read" || a.privilege === "{DAV:}write" || a.privilege === "{DAV:}all")
  );
}

interface AddressBookPermissions {
  edit: boolean;
  remove: boolean;
  publicRight: boolean;
  invitees: boolean;
  count: boolean;
  export: boolean;
  import: boolean;
}

function AddressBookRow({
  username,
  addressBook,
  owner,
  permissions,
  onEdit,
  onDelete,
  onPublicRight,
  onInvitees,
  sharees,
}: {
  username: string;
  addressBook: UserAddressBook;
  owner: string | null;
  permissions: AddressBookPermissions;
  onEdit: (addressBook: UserAddressBook) => void;
  onDelete: (addressBook: UserAddressBook) => void;
  onPublicRight: (addressBook: UserAddressBook) => void;
  onInvitees: (addressBook: UserAddressBook) => void;
  // Who an owned address book is shared with, as its Sharing dialog lists them
  sharees: CurrentSharee[];
}) {
  const { t } = useTranslation();
  const id = addressBookId(addressBook);
  const name = addressBookName(addressBook, t);
  const owned = isOwned(addressBook);
  const system = systemAddressBookId(addressBook) !== null;
  const sharingManageable = canManageSharing(addressBook);
  const isPublicAb = isPublic(addressBook);
  // Bumped once an import task is over: a new key re-reads the contact counter.
  const [countKey, setCountKey] = useState(0);

  return (
    // On a phone the actions wrap under the name together, instead of squeezing it into a word per line
    <div className="group flex flex-wrap items-start gap-3 py-1 -mx-2 px-2 rounded-md transition-colors hover:bg-gray-50">
      <div className="min-w-48 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <p className="font-medium min-w-0 break-words">{name}</p>
          {system && (
            <span
              className="px-1.5 py-0.5 rounded-sm bg-gray-100 text-xs text-gray-600"
              title={t("users.addressBooks.system.hint")}
            >
              {t("users.addressBooks.system.badge")}
            </span>
          )}
          {permissions.count && (
            <CollectionCountBadge
              key={countKey}
              owner={username}
              collectionId={id}
              count={getUserAddressBookContactCount}
              icon={Contact}
              title={t("users.addressBooks.contactCount")}
            />
          )}
          {owned && (
            <SharedWithChip
              sharees={sharees.map((sharee) => ({
                label: sharee.label,
                right: sharee.right ? t(`users.addressBooks.invitees.rights.${sharee.right}`) : "",
              }))}
              onOpen={sharingManageable && permissions.invitees ? () => onInvitees(addressBook) : undefined}
            />
          )}
        </div>
        {addressBook["carddav:description"] && (
          <p className="text-xs text-gray-400">{addressBook["carddav:description"]}</p>
        )}
        {owner && (
          <p className="text-xs text-gray-400">
            {t("users.addressBooks.ownerLabel")}{" "}
            <UserLink address={owner} known />
          </p>
        )}
      </div>
      <div className="flex items-center gap-3 ml-auto">
        {owned && permissions.export && (
          <ExportCollectionButton
            owner={username}
            collectionId={id}
            name={name}
            extension="vcf"
            exportCollection={exportUserAddressBook}
            title={t("users.addressBooks.exportTitle")}
            errorTitle={t("users.addressBooks.errorExport")}
          />
        )}
        {owned && permissions.import && (
          <ImportCollectionButton
            owner={username}
            collectionId={id}
            accept=".vcf,text/vcard"
            importCollection={importUserAddressBook}
            title={t("users.addressBooks.importTitle")}
            taskType="addressbook-import"
            errorTitle={t("users.addressBooks.errorImport")}
            onImported={() => setCountKey((key) => key + 1)}
          />
        )}
        {sharingManageable && permissions.invitees && (
          <button
            onClick={() => onInvitees(addressBook)}
            className="p-1.5 rounded-md hover:bg-gray-200 transition"
            title={t("users.addressBooks.invitees.title")}
          >
            <Users className="w-3.5 h-3.5 text-gray-600" />
          </button>
        )}
        {sharingManageable && permissions.publicRight && (
          <button
            onClick={() => onPublicRight(addressBook)}
            className="p-1.5 rounded-md hover:bg-gray-200 transition"
            title={isPublicAb ? t("users.addressBooks.publicRight.publicTitle") : t("users.addressBooks.publicRight.privateTitle")}
          >
            {isPublicAb
              ? <Eye className="w-3.5 h-3.5 text-green-600" />
              : <EyeOff className="w-3.5 h-3.5 text-gray-400" />}
          </button>
        )}
        {owned && !system && permissions.edit && (
          <button
            onClick={() => onEdit(addressBook)}
            className="p-1.5 rounded-md hover:bg-gray-200 transition"
            title={t("users.addressBooks.editTitle")}
          >
            <Pencil className="w-3.5 h-3.5 text-blue-600" />
          </button>
        )}
        {!system && permissions.remove && (
          <button
            onClick={() => onDelete(addressBook)}
            className="p-1.5 rounded-md hover:bg-gray-200 transition"
            title={t("users.addressBooks.deleteTitle")}
          >
            <Trash2 className="w-3.5 h-3.5 text-red-600" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function UserAddressBooks({ username, defaultOpen = false }: Props) {
  const { t } = useTranslation();
  const idPrefix = useId();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canView = useIsAllowed("GET", "/users/{username}/addressbooks");
  const canCreate = useIsAllowed("POST", "/users/{username}/addressbooks");
  const permissions: AddressBookPermissions = {
    edit: useIsAllowed("PATCH", "/users/{username}/addressbooks/{addressBookId}"),
    remove: useIsAllowed("DELETE", "/users/{username}/addressbooks/{addressBookId}"),
    publicRight: useIsAllowed("POST", "/users/{username}/addressbooks/{addressBookId}/publicRight"),
    invitees: useIsAllowed("POST", "/users/{username}/addressbooks/{addressBookId}/invitee"),
    count: useIsAllowed("GET", "/users/{username}/addressbooks/{addressBookId}/contactCount"),
    export: useIsAllowed("POST", "/users/{username}/addressbooks/{addressBookId}?action=export"),
    import: useIsAllowed("POST", "/users/{username}/addressbooks/{addressBookId}?action=import"),
  };

  const fetchAddressBooks = useCallback(() => getUserAddressBooks(username), [username]);
  const { data, isLoading, error, refresh } = useFetchData<GetUserAddressBooksResponseType>(
    canView ? fetchAddressBooks : null
  );
  // Registered users tell the e-mail of the owners of shared/subscribed address books, and of
  // the sharees, listed by technical user id.
  const domain = useDomain() || undefined;
  const canRegisteredUsers = useIsAllowed("GET", "/registeredUsers");
  const fetchRegisteredUsers = useCallback(() => getRegisteredUsers(domain), [domain]);
  const { data: registeredUsers } = useFetchData<RegisteredUser[]>(
    canView && canRegisteredUsers ? fetchRegisteredUsers : null
  );

  const [open, setOpen, openContentId] = useSectionOpen("address-books", defaultOpen);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserAddressBookPayload>({ ...EMPTY_CREATE });

  const [editAddressBook, setEditAddressBook] = useState<UserAddressBook | null>(null);
  const [editForm, setEditForm] = useState<UpdateUserAddressBookPayload>({});
  const [saving, setSaving] = useState(false);

  const [publicRightAddressBook, setPublicRightAddressBook] = useState<UserAddressBook | null>(null);
  const [publicRightValue, setPublicRightValue] = useState("");
  const [savingPublicRight, setSavingPublicRight] = useState(false);

  const [inviteesAddressBook, setInviteesAddressBook] = useState<UserAddressBook | null>(null);

  // Before the early return: a hook runs on every render
  useSectionFact("address-books", data?._embedded?.["dav:addressbook"]?.length ?? (data ? 0 : undefined));

  if (!canView) return null;

  const addressBooks = data?._embedded?.["dav:addressbook"] ?? [];
  const rowKeys = addressBookKeys(addressBooks);

  // A refusal throws: the modal shows it and keeps the typed values
  const handleCreate = async () => {
    const payload: CreateUserAddressBookPayload = { "dav:name": createForm["dav:name"].trim() };
    if (createForm["carddav:description"]?.trim()) payload["carddav:description"] = createForm["carddav:description"]!.trim();
    await createUserAddressBook(username, payload);
    toast({ title: t("users.addressBooks.created") });
    refresh();
  };

  const openEdit = (addressBook: UserAddressBook) => {
    setEditAddressBook(addressBook);
    setEditForm({
      "dav:name": addressBook["dav:name"] ?? "",
      "carddav:description": addressBook["carddav:description"] ?? "",
    });
  };

  const handleUpdate = async () => {
    if (!editAddressBook) return;
    const name = editForm["dav:name"]?.trim();
    if (!name) return;
    setSaving(true);
    try {
      const payload: UpdateUserAddressBookPayload = {
        "dav:name": name,
        "carddav:description": editForm["carddav:description"]?.trim() || "",
      };
      await updateUserAddressBook(username, addressBookId(editAddressBook), payload);
      toast({ title: t("users.addressBooks.updated") });
      setEditAddressBook(null);
      await refresh();
    } catch (err) {
      toast({ title: t("users.addressBooks.errorUpdate"), description: <ErrorDisplayer error={err} /> });
    } finally {
      setSaving(false);
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
      destructive: true,
      confirmLabel: t("common.delete"),
      message: t("users.addressBooks.deleteConfirm", { name: addressBookName(addressBook, t) }),
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
      {/* Like the other sections: the + sits next to the title, and opens the section */}
      <div className="flex items-center gap-2">
        <SectionToggle open={open} onToggle={() => setOpen(!open)} controls={openContentId}>
          {t("users.addressBooks.title")}
          {data && (
            <span className="text-sm font-normal text-gray-500">({addressBooks.length})</span>
          )}
        </SectionToggle>
        {canCreate && (
          <button
            onClick={() => { setOpen(true); setCreateForm({ ...EMPTY_CREATE }); setShowCreate(true); }}
            className="p-1 rounded-md hover:bg-gray-200 transition"
            title={t("users.addressBooks.createTitle")}
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div id={openContentId} className="mt-2 space-y-4">
          {isLoading && (
            <div className="h-[40px] rounded-2 animate-pulse bg-gray-200" />
          )}
          {error && <p className="text-red-500">{t("common.errorPrefix", { message: error })}</p>}

          {data && addressBooks.length === 0 && !canCreate && (
            <p className="text-sm text-gray-500">{t("users.addressBooks.empty")}</p>
          )}

          {data && (addressBooks.length > 0 || canCreate) && (
            <div>
              <div className="space-y-1">
                {addressBooks.map((ab, i) => (
                  <AddressBookRow
                    key={rowKeys[i]}
                    username={username}
                    addressBook={ab}
                    owner={ownerEmail(parseAddressBookSource(ab["openpaas:source"]), registeredUsers)}
                    permissions={permissions}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onPublicRight={openPublicRight}
                    onInvitees={setInviteesAddressBook}
                    sharees={isOwned(ab) ? currentSharees(ab, username, userEmailsById(registeredUsers)) : []}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create modal: Enter submits, and the focus goes back to the + once it closes */}
      <FormDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title={t("users.addressBooks.createTitle")}
        submitLabel={t("common.create")}
        submitDisabled={!createForm["dav:name"].trim()}
        onSubmit={handleCreate}
      >
        <div>
          <label htmlFor={`${idPrefix}-create-name`} className="text-sm font-medium">{t("users.addressBooks.name")} *</label>
          <input
            id={`${idPrefix}-create-name`}
            type="text"
            autoFocus
            value={createForm["dav:name"]}
            onChange={(e) => setCreateForm((f) => ({ ...f, "dav:name": e.target.value }))}
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-create-description`} className="text-sm font-medium">{t("users.addressBooks.description")}</label>
          <input
            id={`${idPrefix}-create-description`}
            type="text"
            value={createForm["carddav:description"] ?? ""}
            onChange={(e) => setCreateForm((f) => ({ ...f, "carddav:description": e.target.value }))}
            className={FIELD_CLASS}
          />
        </div>
      </FormDialog>

      {/* Edit modal */}
      <Dialog open={!!editAddressBook} onOpenChange={(v) => { if (!v) setEditAddressBook(null); }}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t("users.addressBooks.editTitle")} — {editAddressBook ? addressBookName(editAddressBook, t) : ""}</DialogTitle>
          </DialogHeader>
          {editAddressBook && (
            <div className="space-y-3">
              <div>
                <label htmlFor={`${idPrefix}-edit-name`} className="text-sm font-medium">{t("users.addressBooks.name")} *</label>
                <input
                  id={`${idPrefix}-edit-name`}
                  type="text"
                  value={editForm["dav:name"] ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, "dav:name": e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor={`${idPrefix}-edit-description`} className="text-sm font-medium">{t("users.addressBooks.description")}</label>
                <input
                  id={`${idPrefix}-edit-description`}
                  type="text"
                  value={editForm["carddav:description"] ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, "carddav:description": e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setEditAddressBook(null)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  size="sm"
                  onClick={handleUpdate}
                  disabled={saving || !editForm["dav:name"]?.trim()}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                  {t("common.save")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Public visibility modal */}
      <Dialog open={!!publicRightAddressBook} onOpenChange={(v) => { if (!v) setPublicRightAddressBook(null); }}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t("users.addressBooks.publicRight.title")} — {publicRightAddressBook ? addressBookName(publicRightAddressBook, t) : ""}</DialogTitle>
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
          owner={ownerEmail(parseAddressBookSource(inviteesAddressBook["openpaas:source"]), registeredUsers)}
          userEmails={userEmailsById(registeredUsers)}
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
  owner,
  userEmails,
  onClose,
  onSaved,
}: {
  username: string;
  addressBook: UserAddressBook;
  // The e-mail of the owner of a shared copy, null for an address book of the page user
  owner: string | null;
  userEmails: Record<string, string>;
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

  // The ACL of a shared copy only holds the page user: the sharees are listed on the source
  // address book, in the owner's listing.
  const source = isOwned(addressBook) ? null : parseAddressBookSource(addressBook["openpaas:source"]);
  const fetchOwnerAddressBooks = useCallback(() => getUserAddressBooks(owner ?? ""), [owner]);
  const { data: ownerAddressBooks, isLoading: loadingSource } = useFetchData<GetUserAddressBooksResponseType>(
    source && owner ? fetchOwnerAddressBooks : null
  );
  const sourceAddressBook = source && ownerAddressBooks?._embedded?.["dav:addressbook"]
    ?.find((ab) => addressBookId(ab) === source.addressBookId);
  const bookOwner = sourceAddressBook && owner ? owner : username;
  const existing = currentSharees(sourceAddressBook ?? addressBook, bookOwner, userEmails);

  const trimmedEmail = newEmail.trim();
  const isDuplicate =
    existing.some((i) => i.email === trimmedEmail && !(i.href && removals.has(i.href))) ||
    additions.some((a) => a.email === trimmedEmail);
  const isOwner = trimmedEmail.toLowerCase() === (owner ?? username).toLowerCase();
  const canAdd = status === "exists" && !isOwner && !isDuplicate;

  const toggleRemoval = (href: string) => {
    setRemovals((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  };

  const changeRight = (href: string, sharee: CurrentSharee, right: AddressBookRight) => {
    setChanges((prev) => {
      const next = { ...prev };
      if (right === sharee.right) delete next[href];
      else next[href] = right;
      return next;
    });
  };

  const changedHrefs = Object.keys(changes).filter((href) => !removals.has(href));
  const hasChanges = additions.length > 0 || removals.size > 0 || changedHrefs.length > 0;

  // An address typed but not added is added on Apply when valid, and blocks Apply otherwise
  const pending = canAdd ? [{ email: trimmedEmail, right: newRight }] : [];
  const stagedCount = additions.length + removals.size + changedHrefs.length;
  const blocking = blocksSave(newEmail, canAdd);
  const requestClose = useDiscardGuard(stagedCount + pending.length, onClose);

  const handleStageAdd = () => {
    if (!canAdd) return;
    setAdditions((prev) => [...prev, { email: trimmedEmail, right: newRight }]);
    setNewEmail("");
    setNewRight("read");
  };

  const handleApply = async () => {
    const sharees: AddressBookShareUpdate["dav:sharee"] = [
      ...[...additions, ...pending].map((a) => ({ "dav:href": `mailto:${a.email}`, "dav:share-access": rightToShareAccess(a.right) })),
      ...changedHrefs.map((href) => ({ "dav:href": href, "dav:share-access": rightToShareAccess(changes[href]) })),
      ...[...removals].map((href) => ({ "dav:href": href, "dav:share-access": SHARE_ACCESS_NO_ACCESS })),
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
    <Dialog open onOpenChange={(v) => { if (!v) requestClose(); }}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t("users.addressBooks.invitees.title")} — {addressBookName(addressBook, t)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            {loadingSource && (
              <p role="status" className="text-sm text-gray-500">{t("common.loading")}</p>
            )}
            {!loadingSource && existing.length === 0 && additions.length === 0 && (
              <p className="text-sm text-gray-500">{t("users.addressBooks.invitees.empty")}</p>
            )}
            {existing.map((sharee) => {
              const { href } = sharee;
              if (!href) return <UnresolvedShareeRow key={sharee.label} sharee={sharee} />;
              const removed = removals.has(href);
              const currentRight = changes[href] ?? sharee.right ?? "read";
              const changed = href in changes;
              return (
                <div key={href} className="flex items-center gap-2 py-1">
                  <span className={`flex-1 text-sm truncate ${removed ? "line-through text-gray-400" : ""}`}>
                    {sharee.label}
                  </span>
                  <select
                    value={currentRight}
                    aria-label={t("users.addressBooks.invitees.rightOf", { email: sharee.email })}
                    disabled={removed}
                    onChange={(e) => changeRight(href, sharee, e.target.value as AddressBookRight)}
                    className={`px-2 py-1 border rounded-md text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${changed ? "border-blue-400 text-blue-700" : ""}`}
                  >
                    {RIGHT_OPTIONS.map((r) => (
                      <option key={r} value={r}>{t(`users.addressBooks.invitees.rights.${r}`)}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => toggleRemoval(href)}
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
            {/* flex-wrap and min-w-0: on a phone the select and the + button move under the
                address instead of being pushed past the dialog's right edge. */}
            <div className="flex flex-wrap gap-2">
              <UserSuggestInput
                value={newEmail}
                onValueChange={setNewEmail}
                onKeyDown={(e) => e.key === "Enter" && handleStageAdd()}
                placeholder={t("users.addressBooks.invitees.placeholder")}
                aria-label={t("users.addressBooks.invitees.email")}
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500" wrapperClassName="flex-1 basis-48 min-w-0"
              />
              <select
                value={newRight}
                aria-label={t("users.addressBooks.invitees.right")}
                onChange={(e) => setNewRight(e.target.value as AddressBookRight)}
                className="max-w-full px-2 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                {RIGHT_OPTIONS.map((r) => (
                  <option key={r} value={r}>{t(`users.addressBooks.invitees.rights.${r}`)}</option>
                ))}
              </select>
              <Button size="sm" onClick={handleStageAdd} disabled={!canAdd} aria-label={t("users.addressBooks.invitees.add")}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="h-4">
              {trimmedEmail && status === "checking" && (
                <span className="text-xs text-gray-400">{t("common.checking")}</span>
              )}
              {trimmedEmail && status === "exists" && isOwner && (
                <span className="text-xs text-orange-500">{t("users.addressBooks.invitees.isOwner")}</span>
              )}
              {trimmedEmail && status === "exists" && !isOwner && isDuplicate && (
                <span className="text-xs text-orange-500">{t("users.addressBooks.invitees.alreadyShared")}</span>
              )}
              {trimmedEmail && status === "exists" && !isOwner && !isDuplicate && (
                <span className="text-xs text-green-600">{t("common.userExists")}</span>
              )}
              {trimmedEmail && status === "not_found" && (
                <span className="text-xs text-orange-500">{t("common.userNotFound")}</span>
              )}
              {trimmedEmail && status === "invalid" && (
                <span className="text-xs text-red-600">{t("common.invalidUsername")}</span>
              )}
            </div>
            <StagedChangesNotice count={stagedCount} blocking={blocking} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={requestClose}>
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleApply}
              disabled={saving || blocking || (!hasChanges && pending.length === 0)}
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

// A sharee whose e-mail is unknown cannot be addressed by the DAV server, which
// only resolves `mailto:` sharees: it is listed, but cannot be changed here.
function UnresolvedShareeRow({ sharee }: { sharee: CurrentSharee }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 py-1" title={t("users.addressBooks.invitees.unresolved")}>
      <span className="flex-1 text-sm truncate text-gray-500">{sharee.label}</span>
      <span className="text-xs text-gray-500 w-28 text-right">
        {sharee.right ? t(`users.addressBooks.invitees.rights.${sharee.right}`) : ""}
      </span>
    </div>
  );
}
