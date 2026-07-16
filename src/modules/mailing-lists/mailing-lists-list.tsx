import { Fragment, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { useFetchData } from "@/hooks/use-fetch-data";
import { useConfirm } from "@/hooks/use-confirm";
import { useToast } from "@/hooks/use-toast";
import {
  addMailingListMember,
  addMailingListOwner,
  createMailingList,
  deleteMailingList,
  getMailingListDetail,
  getMailingLists,
  removeMailingListMember,
  removeMailingListOwner,
} from "./api-client";
import {
  BUSINESS_CATEGORIES,
  BusinessCategory,
  MailingListAddresses,
  MailingListDetail,
} from "./types";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { PaginationControls } from "@/components/custom/pagination-controls";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

// Radix selects cannot hold an empty value, so a sentinel represents "unset"
// (businessCategory is optional on the create route).
const NO_CATEGORY = "__none__";

interface Props {
  /** When set, only mailing lists of this domain are listed (domain admin mode). */
  domain?: string;
}

/** Input + button appending an address to a locally edited list of addresses. */
function AddressAdder({
  value,
  onChange,
  onAdd,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  placeholder: string;
  label: string;
}) {
  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onAdd();
          }
        }}
        placeholder={placeholder}
        className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        onClick={onAdd}
        disabled={!value.trim()}
        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {label}
      </button>
    </div>
  );
}

/** Removable chips showing the addresses staged in the create form. */
function AddressChips({
  addresses,
  onRemove,
}: {
  addresses: string[];
  onRemove: (address: string) => void;
}) {
  if (addresses.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {addresses.map((address) => (
        <span
          key={address}
          className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-md text-sm"
        >
          {address}
          <button onClick={() => onRemove(address)} className="text-gray-500 hover:text-red-600">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

function CreateMailingListForm({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [category, setCategory] = useState<string>(NO_CATEGORY);
  const [members, setMembers] = useState<string[]>([]);
  const [owners, setOwners] = useState<string[]>([]);
  const [newMember, setNewMember] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const stage = (
    raw: string,
    current: string[],
    setList: (l: string[]) => void,
    clearInput: () => void
  ) => {
    const value = raw.trim();
    if (!value || current.includes(value)) return;
    setList([...current, value]);
    clearInput();
  };

  const resetForm = () => {
    setAddress("");
    setCategory(NO_CATEGORY);
    setMembers([]);
    setOwners([]);
    setNewMember("");
    setNewOwner("");
  };

  const handleCreate = async () => {
    const mail = address.trim();
    if (!mail || members.length === 0) return;
    setSubmitting(true);
    try {
      await createMailingList(mail, {
        businessCategory:
          category === NO_CATEGORY ? undefined : (category as BusinessCategory),
        members,
        owners: owners.length > 0 ? owners : undefined,
      });
      toast({ title: t("mailingLists.created", { address: mail }) });
      resetForm();
      setOpen(false);
      onCreated();
    } catch (err) {
      toast({
        title: t("mailingLists.errorCreating"),
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-md font-semibold"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <Plus className="w-4 h-4" />
        {t("mailingLists.createTitle")}
      </button>

      {open && (
        <div className="flex flex-col gap-3 mt-3 p-4 bg-gray-50 rounded-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{t("mailingLists.address")}</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="sales@lists.domain.tld"
              className="px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{t("mailingLists.businessCategory")}</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CATEGORY}>{t("mailingLists.noBusinessCategory")}</SelectItem>
                {BUSINESS_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">
              {t("mailingLists.members")} <span className="text-red-600">*</span>
            </label>
            <AddressAdder
              value={newMember}
              onChange={setNewMember}
              onAdd={() => stage(newMember, members, setMembers, () => setNewMember(""))}
              placeholder="user@domain.tld"
              label={t("common.add")}
            />
            <AddressChips
              addresses={members}
              onRemove={(m) => setMembers(members.filter((x) => x !== m))}
            />
            {members.length === 0 && (
              <p className="text-xs text-gray-500">{t("mailingLists.membersRequired")}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{t("mailingLists.owners")}</label>
            <AddressAdder
              value={newOwner}
              onChange={setNewOwner}
              onAdd={() => stage(newOwner, owners, setOwners, () => setNewOwner(""))}
              placeholder="user@domain.tld"
              label={t("common.add")}
            />
            <AddressChips
              addresses={owners}
              onRemove={(o) => setOwners(owners.filter((x) => x !== o))}
            />
          </div>

          <div>
            <button
              onClick={handleCreate}
              disabled={submitting || !address.trim() || members.length === 0}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("common.create")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Add/remove controls over a member or owner list of an existing mailing list. */
function EditableAddresses({
  title,
  addresses,
  emptyLabel,
  canAdd,
  canRemove,
  onAdd,
  onRemove,
  removeTooltip,
}: {
  title: string;
  addresses: string[];
  emptyLabel: string;
  canAdd: boolean;
  canRemove: boolean;
  /** Resolves to true when the address was actually added. */
  onAdd: (address: string) => Promise<boolean>;
  onRemove: (address: string) => Promise<void>;
  removeTooltip: string;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");

  const handleAdd = async () => {
    const address = value.trim();
    if (!address) return;
    if (await onAdd(address)) setValue("");
  };

  return (
    <div>
      <p className="font-medium mb-1">
        {title} ({addresses.length})
      </p>
      {addresses.length ? (
        <ul className="text-gray-700">
          {addresses.map((a) => (
            <li key={a} className="flex items-center gap-2">
              <span>{a}</span>
              {canRemove && (
                <button
                  onClick={() => onRemove(a)}
                  className="p-1 rounded-md hover:bg-gray-200"
                  title={removeTooltip}
                >
                  <Trash2 className="w-3 h-3 text-red-600" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500">{emptyLabel}</p>
      )}
      {canAdd && (
        <div className="mt-2 max-w-md">
          <AddressAdder
            value={value}
            onChange={setValue}
            onAdd={handleAdd}
            placeholder="user@domain.tld"
            label={t("common.add")}
          />
        </div>
      )}
    </div>
  );
}

function MailingListDetailRow({ address }: { address: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canAddMember = useIsAllowed("PUT", "/mailingLists/{address}/members/{member}");
  const canRemoveMember = useIsAllowed("DELETE", "/mailingLists/{address}/members/{member}");
  const canAddOwner = useIsAllowed("PUT", "/mailingLists/{address}/owners/{owner}");
  const canRemoveOwner = useIsAllowed("DELETE", "/mailingLists/{address}/owners/{owner}");

  const fetcher = useCallback(() => getMailingListDetail(address), [address]);
  const { data, isLoading, error, refresh } = useFetchData<MailingListDetail>(fetcher);

  const run = async (
    action: () => Promise<void>,
    successTitle: string,
    errorTitle: string
  ): Promise<boolean> => {
    try {
      await action();
      toast({ title: successTitle });
      await refresh();
      return true;
    } catch (err) {
      toast({ title: errorTitle, description: <ErrorDisplayer error={err} /> });
      return false;
    }
  };

  // Only skeleton on the initial load: refreshing after an edit keeps the
  // rendered lists (and the add inputs) in place.
  if (isLoading && !data) {
    return (
      <div className="h-6 w-64 rounded animate-pulse bg-gray-200" />
    );
  }
  if (error) {
    return <p className="text-red-500 text-sm">{error}</p>;
  }
  if (!data) {
    return <p className="text-gray-500 text-sm">{t("mailingLists.detailEmpty")}</p>;
  }

  const members = data.members ?? [];
  const owners = data.owners ?? [];

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div>
        <span className="font-medium">{t("mailingLists.businessCategory")}: </span>
        {data.businessCategory ? (
          <span>{data.businessCategory}</span>
        ) : (
          <span className="text-gray-500">{t("mailingLists.noBusinessCategory")}</span>
        )}
      </div>
      <EditableAddresses
        title={t("mailingLists.members")}
        addresses={members}
        emptyLabel={t("mailingLists.noMembers")}
        canAdd={canAddMember}
        canRemove={canRemoveMember}
        removeTooltip={t("mailingLists.removeMemberTooltip")}
        onAdd={(member) =>
          run(
            () => addMailingListMember(address, member),
            t("mailingLists.memberAdded", { member }),
            t("mailingLists.errorAddingMember")
          )
        }
        onRemove={async (member) => {
          const confirmed = await confirm({
            header: t("mailingLists.removeMemberTitle"),
            message: t("mailingLists.removeMemberConfirm", { member, address }),
          });
          if (!confirmed) return;
          await run(
            () => removeMailingListMember(address, member),
            t("mailingLists.memberRemoved", { member }),
            t("mailingLists.errorRemovingMember")
          );
        }}
      />
      <EditableAddresses
        title={t("mailingLists.owners")}
        addresses={owners}
        emptyLabel={t("mailingLists.noOwners")}
        canAdd={canAddOwner}
        canRemove={canRemoveOwner}
        removeTooltip={t("mailingLists.removeOwnerTooltip")}
        onAdd={(owner) =>
          run(
            () => addMailingListOwner(address, owner),
            t("mailingLists.ownerAdded", { owner }),
            t("mailingLists.errorAddingOwner")
          )
        }
        onRemove={async (owner) => {
          const confirmed = await confirm({
            header: t("mailingLists.removeOwnerTitle"),
            message: t("mailingLists.removeOwnerConfirm", { owner, address }),
          });
          if (!confirmed) return;
          await run(
            () => removeMailingListOwner(address, owner),
            t("mailingLists.ownerRemoved", { owner }),
            t("mailingLists.errorRemovingOwner")
          );
        }}
      />
    </div>
  );
}

export default function MailingListsList({ domain }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canCreate = useIsAllowed("PUT", "/mailingLists/{address}");
  const canDelete = useIsAllowed("DELETE", "/mailingLists/{address}");

  const fetcher = useCallback(() => getMailingLists(domain), [domain]);
  const { data, isLoading, error, refresh } = useFetchData<MailingListAddresses>(fetcher);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const addresses = useMemo(() => {
    const list = Array.isArray(data) ? [...data] : [];
    list.sort((a, b) => a.localeCompare(b));
    return list;
  }, [data]);

  const filtered = useMemo(() => {
    if (!search) return addresses;
    const lower = search.toLowerCase();
    return addresses.filter((a) => a.toLowerCase().includes(lower));
  }, [addresses, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_LIMIT));
  const paginated = filtered.slice((page - 1) * PAGE_LIMIT, page * PAGE_LIMIT);

  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  const toggle = (address: string) => {
    setExpanded((cur) => (cur === address ? null : address));
  };

  const handleDelete = async (address: string) => {
    const confirmed = await confirm({
      header: t("mailingLists.deleteTitle"),
      message: t("mailingLists.deleteConfirm", { address }),
    });
    if (!confirmed) return;
    try {
      await deleteMailingList(address);
      toast({ title: t("mailingLists.deleted", { address }) });
      if (expanded === address) setExpanded(null);
      await refresh();
    } catch (err) {
      toast({
        title: t("mailingLists.errorDeleting"),
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  return (
    <div>
      {canCreate && <CreateMailingListForm onCreated={refresh} />}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
          <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
          <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
        </div>
      )}
      {error && <p className="text-red-500 mt-4">Error: {error}</p>}
      <input
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        placeholder={t("mailingLists.searchPlaceholder")}
        className="mt-4 w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {filtered.length > 0 && (
        <PaginationControls
          onFirst={() => goToPage(1)}
          onPrev={() => goToPage(page - 1)}
          onNext={() => goToPage(page + 1)}
          onLast={() => goToPage(totalPages)}
          disabledPrev={page <= 1}
          disabledNext={page >= totalPages}
          label={t("common.page", { page, totalPages, total: filtered.length })}
        />
      )}
      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left px-4 py-2 text-sm font-medium">#</th>
            <th className="text-left px-4 py-2 text-sm font-medium">{t("mailingLists.address")}</th>
            <th className="text-left px-4 py-2 text-sm font-medium">{t("mailingLists.details")}</th>
            {canDelete && <th className="text-left px-4 py-2 text-sm font-medium" />}
          </tr>
        </thead>
        <tbody>
          {paginated.map((address, index) => {
            const isOpen = expanded === address;
            return (
              <Fragment key={address}>
                <tr
                  className="border-b hover:bg-gray-50 cursor-pointer"
                  onClick={() => toggle(address)}
                >
                  <td className="px-4 py-2 text-sm text-gray-500">
                    {(page - 1) * PAGE_LIMIT + index + 1}
                  </td>
                  <td className="px-4 py-2 text-sm">{address}</td>
                  <td className="px-4 py-2 text-sm">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggle(address); }}
                      className="flex items-center gap-1 text-blue-500 hover:underline"
                    >
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      {isOpen ? t("mailingLists.hideDetails") : t("mailingLists.showDetails")}
                    </button>
                  </td>
                  {canDelete && (
                    <td className="px-4 py-2 text-sm">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(address); }}
                        className="p-2 rounded-md hover:bg-gray-200"
                        title={t("mailingLists.deleteTitle")}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </td>
                  )}
                </tr>
                {isOpen && (
                  <tr className="border-b bg-gray-50">
                    <td />
                    <td colSpan={canDelete ? 3 : 2} className="px-4 py-3">
                      <MailingListDetailRow address={address} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {!isLoading && filtered.length === 0 && (
        <p className="mt-4 text-gray-500 text-sm">{t("mailingLists.empty")}</p>
      )}
    </div>
  );
}
