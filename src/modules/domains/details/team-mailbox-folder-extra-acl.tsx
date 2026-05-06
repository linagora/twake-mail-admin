import { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { useCheckUserExists } from "@/hooks/use-check-user-exists";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import {
  getTeamMailboxFolderExtraAcl,
  setTeamMailboxFolderExtraAclEntry,
  removeTeamMailboxFolderExtraAclEntry,
  clearTeamMailboxFolderExtraAcl,
} from "../api-client";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Button } from "@/components/ui/button";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

const RIGHTS: { key: string; label: string }[] = [
  { key: "l", label: "Lookup" },
  { key: "r", label: "Read" },
  { key: "s", label: "Write Seen Flag" },
  { key: "w", label: "Write" },
  { key: "i", label: "Insert" },
  { key: "p", label: "Post" },
  { key: "k", label: "Create Mailbox" },
  { key: "t", label: "Delete Messages" },
  { key: "e", label: "Perform Expunge" },
  { key: "x", label: "Delete Mailbox" },
  { key: "a", label: "Administer" },
];

const RIGHTS_ORDER = RIGHTS.map((r) => r.key);

function rightsToLabels(rights: string): string[] {
  return RIGHTS_ORDER.filter((k) => rights.includes(k)).map(
    (k) => RIGHTS.find((r) => r.key === k)!.label
  );
}

interface Props {
  domain: string;
  mailbox: string;
  folder: string;
}

export default function TeamMailboxFolderExtraAcl({ domain, mailbox, folder }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canViewAcl = useIsAllowed("GET", "/domains/{domain}/team-mailboxes/{mailbox}/mailboxes/{folderName}/extraAcl");
  const canAddAcl = useIsAllowed("PUT", "/domains/{domain}/team-mailboxes/{mailbox}/mailboxes/{folderName}/extraAcl/{username}");
  const canRemoveAcl = useIsAllowed("DELETE", "/domains/{domain}/team-mailboxes/{mailbox}/mailboxes/{folderName}/extraAcl/{username}");
  const canClearAcl = useIsAllowed("DELETE", "/domains/{domain}/team-mailboxes/{mailbox}/mailboxes/{folderName}/extraAcl");

  const fetchAcl = useCallback(
    () => getTeamMailboxFolderExtraAcl(domain, mailbox, folder),
    [domain, mailbox, folder]
  );
  const { data: acl, isLoading, error, refresh } = useFetchData<Record<string, string>>(canViewAcl ? fetchAcl : null);

  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState("");
  const [selectedRights, setSelectedRights] = useState<Set<string>>(new Set(["l", "r"]));
  const userStatus = useCheckUserExists(newUser);

  const entries = useMemo(() => {
    if (!acl) return [];
    return Object.entries(acl).sort(([a], [b]) => a.localeCompare(b));
  }, [acl]);

  if (!canViewAcl) return null;

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_LIMIT));
  const paginated = entries.slice((page - 1) * PAGE_LIMIT, page * PAGE_LIMIT);

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
  };

  const toggleRight = (key: string) => {
    setSelectedRights((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const rightsString = RIGHTS_ORDER.filter((k) => selectedRights.has(k)).join("");

  const handleAdd = async () => {
    const username = newUser.trim();
    if (!username || !rightsString) return;
    try {
      await setTeamMailboxFolderExtraAclEntry(domain, mailbox, folder, username, rightsString);
      toast({ title: "ACL entry set" });
      setNewUser("");
      setSelectedRights(new Set(["l", "r"]));
      setShowAddForm(false);
      await refresh();
    } catch (err) {
      toast({ title: "Error setting ACL entry", description: <ErrorDisplayer error={err} /> });
    }
  };

  const handleRemove = async (username: string) => {
    const confirmed = await confirm({
      header: t("domains.extraAcl.removeTitle"),
      message: t("domains.extraAcl.removeConfirm", { username }),
    });
    if (!confirmed) return;
    try {
      await removeTeamMailboxFolderExtraAclEntry(domain, mailbox, folder, username);
      toast({ title: "ACL entry removed" });
      await refresh();
    } catch (err) {
      toast({ title: "Error removing ACL entry", description: <ErrorDisplayer error={err} /> });
    }
  };

  const handleClearAll = async () => {
    const confirmed = await confirm({
      header: t("domains.extraAcl.clearTitle"),
      message: t("domains.extraAcl.clearConfirm"),
    });
    if (!confirmed) return;
    try {
      await clearTeamMailboxFolderExtraAcl(domain, mailbox, folder);
      toast({ title: "All extra ACL entries removed" });
      await refresh();
    } catch (err) {
      toast({ title: "Error clearing ACL entries", description: <ErrorDisplayer error={err} /> });
    }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1 text-md font-semibold w-full text-left"
        >
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          Extra ACL
          {acl && (
            <span className="text-sm font-normal text-gray-500">({entries.length})</span>
          )}
        </button>
        {open && (
          <div className="flex items-center gap-1 shrink-0">
            {canAddAcl && (
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="p-1 rounded-md hover:bg-gray-200 transition"
                title="Add ACL entry"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
            {canClearAcl && entries.length > 0 && (
              <button
                onClick={handleClearAll}
                className="p-1 rounded-md hover:bg-gray-200 transition"
                title="Clear all extra ACL entries"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            )}
          </div>
        )}
      </div>

      {open && (
        <div className="mt-2">
          {/* Add form */}
          {showAddForm && (
            <div className="p-4 bg-gray-50 rounded-2 mb-4 space-y-3">
              {/* Username input */}
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={newUser}
                  onChange={(e) => setNewUser(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  placeholder="user@domain.tld"
                  className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {userStatus === "checking" && (
                  <span className="text-xs text-gray-400 whitespace-nowrap">Checking...</span>
                )}
                {userStatus === "exists" && (
                  <span className="flex items-center gap-1 text-xs text-green-600 whitespace-nowrap">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                    User exists
                  </span>
                )}
                {userStatus === "not_found" && (
                  <span className="flex items-center gap-1 text-xs text-orange-500 whitespace-nowrap">
                    <span className="inline-block w-2 h-2 rounded-full bg-orange-400" />
                    User not found
                  </span>
                )}
                {userStatus === "invalid" && (
                  <span className="flex items-center gap-1 text-xs text-red-600 whitespace-nowrap">
                    <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                    Invalid username
                  </span>
                )}
              </div>

              {/* Rights checkboxes */}
              <div className="flex flex-wrap gap-2">
                {RIGHTS.map(({ key, label }) => (
                  <label
                    key={key}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-pointer text-sm transition-colors select-none ${
                      selectedRights.has(key)
                        ? "bg-blue-100 border-blue-400 text-blue-800"
                        : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={selectedRights.has(key)}
                      onChange={() => toggleRight(key)}
                    />
                    <span className="font-mono text-xs font-bold">{key}</span>
                    {label}
                  </label>
                ))}
              </div>

              {rightsString && (
                <p className="text-xs text-gray-400">
                  Rights string: <span className="font-mono font-semibold text-gray-600">{rightsString}</span>
                </p>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={handleAdd}
                  disabled={!newUser.trim() || !rightsString}
                  className="rounded-sm"
                >
                  Add
                </Button>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            </div>
          )}
          {error && <p className="text-red-500 mt-2">Error: {error}</p>}

          {acl && (
            <>
              {entries.length > 0 && (
                <div className="mt-2 flex justify-between items-center">
                  <button
                    onClick={() => goToPage(1)}
                    disabled={page <= 1}
                    className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t("common.first")}
                  </button>
                  <button
                    onClick={() => goToPage(page - 1)}
                    disabled={page <= 1}
                    className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t("common.previous")}
                  </button>
                  <span className="text-sm font-medium text-center">
                    {t("common.page", { page, totalPages, total: entries.length })}
                  </span>
                  <button
                    onClick={() => goToPage(page + 1)}
                    disabled={page >= totalPages}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t("common.next")}
                  </button>
                  <button
                    onClick={() => goToPage(totalPages)}
                    disabled={page >= totalPages}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t("common.last")}
                  </button>
                </div>
              )}

              <div className="mt-2">
                {paginated.map(([username, rights], index) => (
                  <div
                    key={username}
                    className="p-4 bg-gray-50 rounded-2 my-2 flex justify-between items-center gap-4"
                  >
                    <div className="min-w-0">
                      <h4 className="text-sm font-medium leading-none mb-2">
                        <span className="text-gray-500 mr-2">{(page - 1) * PAGE_LIMIT + index + 1}/</span>
                        {username}
                      </h4>
                      <div className="flex flex-wrap gap-1 ml-6">
                        {rightsToLabels(rights).map((label) => (
                          <span
                            key={label}
                            className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-medium"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                    {canRemoveAcl && (
                      <button
                        onClick={() => handleRemove(username)}
                        className="p-2 rounded-md hover:bg-gray-200 shrink-0"
                        title="Remove ACL entry"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {entries.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">No extra ACL entries.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
