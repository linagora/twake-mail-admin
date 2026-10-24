import { useCallback, useId, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { isSubmittableUserStatus, useCheckUserExists } from "@/hooks/use-check-user-exists";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { getTeamMailboxExtraSenders, addTeamMailboxExtraSender, removeTeamMailboxExtraSender } from "../api-client";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { PaginationControls } from "@/components/custom/pagination-controls";
import { SectionToggle, useSectionOpen } from "@/components/custom/collapsible-section";
import FormDialog, { FIELD_CLASS } from "@/components/custom/form-dialog";
import UserSuggestInput from "@/components/custom/user-suggest-input";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

interface Props {
  domain: string;
  mailbox: string;
}

export default function TeamMailboxExtraSenders({ domain, mailbox }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canView = useIsAllowed("GET", "/domains/{domain}/team-mailboxes/{mailbox}/extraSenders");
  const canAdd = useIsAllowed("PUT", "/domains/{domain}/team-mailboxes/{mailbox}/extraSenders/{username}");
  const canRemove = useIsAllowed("DELETE", "/domains/{domain}/team-mailboxes/{mailbox}/extraSenders/{username}");

  const fetchSenders = useCallback(
    () => getTeamMailboxExtraSenders(domain, mailbox),
    [domain, mailbox]
  );
  const { data: senders, isLoading, error, refresh } = useFetchData<string[]>(canView ? fetchSenders : null);

  const [open, setOpen, openContentId] = useSectionOpen("extra-senders", true);
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const fieldId = useId();
  const [newSender, setNewSender] = useState("");
  const senderStatus = useCheckUserExists(newSender);
  const canSubmit = !!newSender.trim() && isSubmittableUserStatus(senderStatus);

  const sorted = useMemo(() => {
    if (!senders) return [];
    return [...senders].sort((a, b) => a.localeCompare(b));
  }, [senders]);

  if (!canView) return null;

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_LIMIT));
  const paginated = sorted.slice((page - 1) * PAGE_LIMIT, page * PAGE_LIMIT);

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
  };

  const confirmUnknownUser = (username: string) =>
    confirm({
      header: t("common.unknownUserTitle"),
      message: t("common.unknownUserConfirm", { username }),
    });

  // A refusal is shown in the modal, which then stays open with the typed address
  const handleAdd = async () => {
    const username = newSender.trim();
    if (senderStatus === "not_found" && !(await confirmUnknownUser(username))) {
      // Declined: the modal stays open with the typed values
      return false;
    }
    await addTeamMailboxExtraSender(domain, mailbox, username);
    toast({ title: t("domains.extraSenders.added") });
    setNewSender("");
    await refresh();
  };

  const closeAdd = () => setShowAdd(false);

  const handleRemove = async (username: string) => {
    const confirmed = await confirm({
      header: t("domains.extraSenders.removeTitle"),
      destructive: true,
      confirmLabel: t("common.remove"),
      message: t("domains.extraSenders.removeConfirm", { username }),
    });
    if (!confirmed) return;
    try {
      await removeTeamMailboxExtraSender(domain, mailbox, username);
      toast({ title: t("domains.extraSenders.removed") });
      await refresh();
    } catch (err) {
      toast({ title: t("domains.extraSenders.errorRemoving"), description: <ErrorDisplayer error={err} /> });
    }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        <SectionToggle open={open} onToggle={() => setOpen(!open)} controls={openContentId}>
          {t("domains.extraSenders.title")}
          {senders && <span className="text-sm font-normal text-gray-500">({senders.length})</span>}
        </SectionToggle>
        {canAdd && (
          <button
            onClick={() => { setOpen(true); setNewSender(""); setShowAdd(true); }}
            className="p-1 rounded-md hover:bg-gray-200 transition"
            title={t("domains.extraSenders.addTooltip")}
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (<div id={openContentId}>
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
          </div>
        )}
        {error && <p className="text-red-500 mt-2">{t("common.errorPrefix", { message: error })}</p>}

        {/* Pagination */}
        {sorted.length > 0 && (
          <PaginationControls
            onFirst={() => goToPage(1)}
            onPrev={() => goToPage(page - 1)}
            onNext={() => goToPage(page + 1)}
            onLast={() => goToPage(totalPages)}
            disabledPrev={page <= 1}
            disabledNext={page >= totalPages}
            label={t("common.page", { page, totalPages, total: sorted.length })}
            total={sorted.length}
          />
        )}

        {/* Sender list */}
        <div>
          {paginated.map((username, index) => (
            <div
              key={username}
              className="space-y-1 p-4 bg-gray-50 rounded-2 my-2 flex justify-between items-center gap-2 transition-colors hover:bg-gray-100"
            >
              <h4 className="min-w-0 text-sm font-medium leading-none break-all">
                <span className="text-gray-500 mr-2">{(page - 1) * PAGE_LIMIT + index + 1}/</span>
                {username}
              </h4>
              {canRemove && (
                <button
                  onClick={() => handleRemove(username)}
                  className="shrink-0 p-2 rounded-md hover:bg-gray-200"
                  title={t("domains.extraSenders.removeTooltip")}
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              )}
            </div>
          ))}
          {senders && senders.length === 0 && (
            <p className="mt-2 text-sm text-gray-500">{t("domains.extraSenders.empty")}</p>
          )}
        </div>
      </div>)}

      <FormDialog
        open={showAdd}
        onClose={closeAdd}
        title={t("domains.extraSenders.addTooltip")}
        submitLabel={t("common.add")}
        submitDisabled={!canSubmit}
        onSubmit={handleAdd}
      >
        <div>
          <label htmlFor={fieldId} className="text-sm font-medium">{t("domains.teamMailbox.user")}</label>
          <UserSuggestInput
            id={fieldId}
            autoFocus
            value={newSender}
            onValueChange={setNewSender}
            placeholder="user@domain.tld"
            className={FIELD_CLASS}
          />
          {/* Reserved height: the status appearing does not resize the modal */}
          <p className="h-4 mt-1 text-xs">
            {senderStatus === "checking" && <span className="text-gray-400">{t("common.checking")}</span>}
            {senderStatus === "exists" && <span className="text-green-700">{t("common.userExists")}</span>}
            {senderStatus === "not_found" && <span className="text-orange-600">{t("common.userNotFound")}</span>}
            {senderStatus === "invalid" && <span className="text-red-600">{t("common.invalidUsername")}</span>}
          </p>
        </div>
      </FormDialog>
    </div>
  );
}
