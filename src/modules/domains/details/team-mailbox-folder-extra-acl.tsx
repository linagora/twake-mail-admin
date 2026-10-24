import { useCallback, useId, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { isSubmittableUserStatus, useCheckUserExists } from "@/hooks/use-check-user-exists";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import {
  getTeamMailboxFolderExtraAcl,
  setTeamMailboxFolderExtraAclEntry,
  removeTeamMailboxFolderExtraAclEntry,
  clearTeamMailboxFolderExtraAcl,
} from "../api-client";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { SectionToggle, useSectionOpen } from "@/components/custom/collapsible-section";
import FormDialog, { FIELD_CLASS } from "@/components/custom/form-dialog";
import { PaginationControls } from "@/components/custom/pagination-controls";
import UserSuggestInput from "@/components/custom/user-suggest-input";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

// The i18n key of the label of each right, under domains.extraAcl
const RIGHTS: { key: string; label: string }[] = [
  { key: "l", label: "lookup" },
  { key: "r", label: "read" },
  { key: "s", label: "writeSeenFlag" },
  { key: "w", label: "write" },
  { key: "i", label: "insert" },
  { key: "p", label: "post" },
  { key: "k", label: "createMailbox" },
  { key: "t", label: "deleteMessages" },
  { key: "e", label: "performExpunge" },
  { key: "x", label: "deleteMailbox" },
  { key: "a", label: "administer" },
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

  const [open, setOpen, openContentId] = useSectionOpen("folder-extra-acl");
  const [page, setPage] = useState(1);

  const [showAddForm, setShowAddForm] = useState(false);
  const fieldId = useId();
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
  const canSubmit = !!newUser.trim() && !!rightsString && isSubmittableUserStatus(userStatus);

  const confirmUnknownUser = (username: string) =>
    confirm({
      header: t("common.unknownUserTitle"),
      message: t("common.unknownUserConfirm", { username }),
    });

  // A refusal is shown in the modal, which then stays open with the typed values
  const handleAdd = async () => {
    const username = newUser.trim();
    if (userStatus === "not_found" && !(await confirmUnknownUser(username))) {
      // Declined: the modal stays open with the typed values
      return false;
    }
    await setTeamMailboxFolderExtraAclEntry(domain, mailbox, folder, username, rightsString);
    toast({ title: t("domains.extraAcl.entrySet") });
    setNewUser("");
    setSelectedRights(new Set(["l", "r"]));
    await refresh();
  };

  const closeAdd = () => setShowAddForm(false);

  const handleRemove = async (username: string) => {
    const confirmed = await confirm({
      header: t("domains.extraAcl.removeTitle"),
      destructive: true,
      confirmLabel: t("common.remove"),
      message: t("domains.extraAcl.removeConfirm", { username }),
    });
    if (!confirmed) return;
    try {
      await removeTeamMailboxFolderExtraAclEntry(domain, mailbox, folder, username);
      toast({ title: t("domains.extraAcl.entryRemoved") });
      await refresh();
    } catch (err) {
      toast({ title: t("domains.extraAcl.errorRemoving"), description: <ErrorDisplayer error={err} /> });
    }
  };

  const handleClearAll = async () => {
    const confirmed = await confirm({
      header: t("domains.extraAcl.clearTitle"),
      destructive: true,
      confirmLabel: t("confirm.clear"),
      message: t("domains.extraAcl.clearConfirm"),
    });
    if (!confirmed) return;
    try {
      await clearTeamMailboxFolderExtraAcl(domain, mailbox, folder);
      toast({ title: t("domains.extraAcl.allRemoved") });
      await refresh();
    } catch (err) {
      toast({ title: t("domains.extraAcl.errorClearing"), description: <ErrorDisplayer error={err} /> });
    }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        <SectionToggle open={open} onToggle={() => setOpen(!open)} controls={openContentId}>
          {t("domains.extraAcl.title")}
          {acl && (
            <span className="text-sm font-normal text-gray-500">({entries.length})</span>
          )}
        </SectionToggle>
        {canAddAcl && (
          <button
            onClick={() => { setOpen(true); setNewUser(""); setSelectedRights(new Set(["l", "r"])); setShowAddForm(true); }}
            className="p-1 rounded-md hover:bg-gray-200 transition"
            title={t("domains.extraAcl.addEntry")}
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
        {open && canClearAcl && entries.length > 0 && (
          <button
            onClick={handleClearAll}
            className="p-1 rounded-md hover:bg-gray-200 transition"
            title={t("domains.extraAcl.clearAll")}
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        )}
      </div>

      {open && (
        <div id={openContentId} className="mt-2">
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            </div>
          )}
          {error && <p className="text-red-500 mt-2">{t("common.errorPrefix", { message: error })}</p>}

          {acl && (
            <>
              {entries.length > 0 && (
                <PaginationControls
                  onFirst={() => goToPage(1)}
                  onPrev={() => goToPage(page - 1)}
                  onNext={() => goToPage(page + 1)}
                  onLast={() => goToPage(totalPages)}
                  disabledPrev={page <= 1}
                  disabledNext={page >= totalPages}
                  label={t("common.page", { page, totalPages, total: entries.length })}
                  total={entries.length}
                />
              )}

              <div className="mt-2">
                {paginated.map(([username, rights], index) => (
                  <div
                    key={username}
                    className="p-4 bg-gray-50 rounded-2 my-2 flex justify-between items-center gap-4 transition-colors hover:bg-gray-100"
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
                            {t(`domains.extraAcl.${label}`)}
                          </span>
                        ))}
                      </div>
                    </div>
                    {canRemoveAcl && (
                      <button
                        onClick={() => handleRemove(username)}
                        className="p-2 rounded-md hover:bg-gray-200 shrink-0"
                        title={t("domains.extraAcl.removeTooltip")}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {entries.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">{t("domains.extraAcl.empty")}</p>
              )}
            </>
          )}
        </div>
      )}

      <FormDialog
        open={showAddForm}
        onClose={closeAdd}
        title={t("domains.extraAcl.addEntry")}
        submitLabel={t("common.add")}
        submitDisabled={!canSubmit}
        onSubmit={handleAdd}
        className="max-w-xl"
      >
        <div>
          <label htmlFor={fieldId} className="text-sm font-medium">{t("domains.teamMailbox.user")}</label>
          <UserSuggestInput
            id={fieldId}
            autoFocus
            value={newUser}
            onValueChange={setNewUser}
            placeholder="user@domain.tld"
            className={FIELD_CLASS}
          />
          {/* Reserved height: the status appearing does not resize the modal */}
          <p className="h-4 mt-1 text-xs">
            {userStatus === "checking" && <span className="text-gray-400">{t("common.checking")}</span>}
            {userStatus === "exists" && <span className="text-green-700">{t("common.userExists")}</span>}
            {userStatus === "not_found" && <span className="text-orange-600">{t("common.userNotFound")}</span>}
            {userStatus === "invalid" && <span className="text-red-600">{t("common.invalidUsername")}</span>}
          </p>
        </div>

        {/* Rights checkboxes */}
        <div className="flex flex-wrap gap-2">
          {RIGHTS.map(({ key, label }) => (
            <label
              key={key}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-pointer text-sm transition-colors select-none has-focus-visible:ring-2 has-focus-visible:ring-blue-500 ${
                selectedRights.has(key)
                  ? "bg-blue-100 border-blue-400 text-blue-800"
                  : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {/* sr-only rather than hidden: keeps the checkbox focusable and announced */}
              <input
                type="checkbox"
                className="sr-only"
                checked={selectedRights.has(key)}
                onChange={() => toggleRight(key)}
              />
              <span className="font-mono text-xs font-bold">{key}</span>
              {t(`domains.extraAcl.${label}`)}
            </label>
          ))}
        </div>

        <p className="h-4 text-xs text-gray-400">
          {rightsString && (
            <>
              {t("domains.extraAcl.rightsString")} <span className="font-mono font-semibold text-gray-600">{rightsString}</span>
            </>
          )}
        </p>
      </FormDialog>
    </div>
  );
}
