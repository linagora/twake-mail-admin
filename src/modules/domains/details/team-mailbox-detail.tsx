import { useCallback, useId, useMemo, useState } from "react";
import UserLink from "@/components/custom/user-link";
import { useParams } from "react-router";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getTeamMailboxMembers, addTeamMailboxMember, removeTeamMailboxMember, searchTeamMailboxDeletedMessages, restoreTeamMailboxDeletedMessages } from "../api-client";
import { GetTeamMailboxMembersResponseType } from "../types";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { isSubmittableUserStatus, useCheckUserExists } from "@/hooks/use-check-user-exists";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { PaginationControls } from "@/components/custom/pagination-controls";
import TeamMailboxFolders from "./team-mailbox-folders";
import TeamMailboxQuota from "./team-mailbox-quota";
import TeamMailboxExtraSenders from "./team-mailbox-extra-senders";
import TeamMailboxSpace from "./team-mailbox-space";
import UserDeletedMessageVault from "@/modules/users/details/user-deleted-message-vault";
import Header from "@/components/custom/header";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { SectionToggle, useSectionOpen } from "@/components/custom/collapsible-section";
import { ExpandCollapseAll, SectionsProvider } from "@/components/custom/collapsible-section";
import FormDialog, { FIELD_CLASS } from "@/components/custom/form-dialog";
import UserSuggestInput from "@/components/custom/user-suggest-input";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

// The provider wraps the whole page, so that Expand all / Collapse all also reach the members section
export default function TeamMailboxDetail() {
  return (
    <SectionsProvider page="teamMailbox">
      <TeamMailboxDetailContent />
    </SectionsProvider>
  );
}

function TeamMailboxDetailContent() {
  const { t } = useTranslation();
  const { domain, mailbox } = useParams();
  const breadcrumbs = useBreadcrumbs();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canAddMember = useIsAllowed("PUT", "/domains/{domain}/team-mailboxes/{mailbox}/members/{username}");
  const canRemoveMember = useIsAllowed("DELETE", "/domains/{domain}/team-mailboxes/{mailbox}/members/{username}");
  const canSearch = useIsAllowed("POST", "/deletedMessages/users/{mailbox}/messages?force=true");
  const canRestore = useIsAllowed("POST", "/deletedMessages/teamMailbox/{mailbox}?action=restore");

  const fetchMembers = useCallback(
    () => getTeamMailboxMembers(domain!, mailbox!),
    [domain, mailbox]
  );
  const { data: members, isLoading, error, refresh } = useFetchData<GetTeamMailboxMembersResponseType>(fetchMembers);

  const [membersOpen, setMembersOpen, membersOpenContentId] = useSectionOpen("members", true);
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const fieldId = useId();
  const [newMember, setNewMember] = useState("");
  const [role, setRole] = useState<"member" | "manager">("member");
  const memberStatus = useCheckUserExists(newMember);
  const canSubmit = !!newMember.trim() && isSubmittableUserStatus(memberStatus);

  const sorted = useMemo(() => {
    if (!members) return [];
    return [...members].sort((a, b) => a.username.localeCompare(b.username));
  }, [members]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_LIMIT));
  const paginated = sorted.slice((page - 1) * PAGE_LIMIT, page * PAGE_LIMIT);

  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  const confirmUnknownUser = (username: string) =>
    confirm({
      header: t("common.unknownUserTitle"),
      message: t("common.unknownUserConfirm", { username }),
    });

  // A refusal is shown in the modal, which then stays open with the typed values
  const handleAdd = async () => {
    const username = newMember.trim();
    if (memberStatus === "not_found" && !(await confirmUnknownUser(username))) {
      // Declined: the modal stays open with the typed values
      return false;
    }
    await addTeamMailboxMember(domain!, mailbox!, username, role);
    toast({ title: t("domains.teamMailbox.memberAdded") });
    setNewMember("");
    setRole("member");
    await refresh();
  };

  const closeAdd = () => setShowAdd(false);

  const handleRemove = async (username: string) => {
    const confirmed = await confirm({
      header: t("domains.teamMailbox.removeMemberTitle"),
      destructive: true,
      confirmLabel: t("common.remove"),
      message: t("domains.teamMailbox.removeMemberConfirm", { username, mailbox, domain }),
    });
    if (!confirmed) return;
    try {
      await removeTeamMailboxMember(domain!, mailbox!, username);
      toast({ title: t("domains.teamMailbox.memberRemoved") });
      await refresh();
    } catch (err) {
      toast({
        title: t("domains.teamMailbox.errorRemovingMember"),
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  return (
    <>
    <Header headerTitle={`${mailbox}@${domain}`} headerSubTitle={t("domains.teamMailbox.detailKind")} breadcrumb={breadcrumbs.teamMailboxes(domain!)} actions={<ExpandCollapseAll />} />
    <div className="mt-4 p-4 bg-white rounded-2">
      <TeamMailboxSpace domain={domain!} mailbox={mailbox!} onBound={refresh} />

      <div className="mt-6">
        <div className="flex items-center gap-2">
          <SectionToggle open={membersOpen} onToggle={() => setMembersOpen(!membersOpen)} controls={membersOpenContentId}>
            {t("domains.teamMailbox.members")} {members && <span className="text-sm font-normal text-gray-500">({members.length})</span>}
          </SectionToggle>
          {canAddMember && (
            <button
              onClick={() => { setMembersOpen(true); setNewMember(""); setRole("member"); setShowAdd(true); }}
              className="p-1 rounded-md hover:bg-gray-200 transition"
              title={t("domains.teamMailbox.addMember")}
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {membersOpen && (<div id={membersOpenContentId}>
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

        {/* Member list */}
        <div>
          {paginated.map((member, index) => (
            <div
              key={member.username}
              className="space-y-1 p-4 bg-gray-50 rounded-2 my-2 flex justify-between items-center gap-2 transition-colors hover:bg-gray-100"
            >
              <h4 className="min-w-0 text-sm font-medium leading-none break-all">
                <span className="text-gray-500 mr-2">{(page - 1) * PAGE_LIMIT + index + 1}/</span>
                <UserLink address={member.username} />
                <span className="text-xs text-muted-foreground ml-2">({member.role})</span>
              </h4>
              {canRemoveMember && (
                <button
                  onClick={() => handleRemove(member.username)}
                  className="shrink-0 p-2 rounded-md hover:bg-gray-200"
                  title={t("domains.teamMailbox.removeMemberTooltip")}
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              )}
            </div>
          ))}
          {members && members.length === 0 && (
            <p className="mt-2 text-sm text-gray-500">{t("domains.teamMailbox.noMembers")}</p>
          )}
        </div>
        </div>)}

        <FormDialog
          open={showAdd}
          onClose={closeAdd}
          title={t("domains.teamMailbox.addMember")}
          submitLabel={t("common.add")}
          submitDisabled={!canSubmit}
          onSubmit={handleAdd}
        >
          <div>
            <label htmlFor={`${fieldId}-user`} className="text-sm font-medium">{t("domains.teamMailbox.user")}</label>
            <UserSuggestInput
              id={`${fieldId}-user`}
              autoFocus
              value={newMember}
              onValueChange={setNewMember}
              placeholder="user@domain.tld"
              className={FIELD_CLASS}
            />
            {/* Reserved height: the status appearing does not resize the modal */}
            <p className="h-4 mt-1 text-xs">
              {memberStatus === "checking" && <span className="text-gray-400">{t("common.checking")}</span>}
              {memberStatus === "exists" && <span className="text-green-700">{t("common.userExists")}</span>}
              {memberStatus === "not_found" && <span className="text-orange-600">{t("common.userNotFound")}</span>}
              {memberStatus === "invalid" && <span className="text-red-600">{t("common.invalidUsername")}</span>}
            </p>
          </div>
          <div>
            <label htmlFor={`${fieldId}-role`} className="text-sm font-medium">{t("domains.teamMailbox.role")}</label>
            <select
              id={`${fieldId}-role`}
              value={role}
              onChange={(e) => setRole(e.target.value as "member" | "manager")}
              className={FIELD_CLASS}
            >
              <option value="member">{t("domains.teamMailbox.member")}</option>
              <option value="manager">{t("domains.teamMailbox.manager")}</option>
            </select>
          </div>
        </FormDialog>
      </div>
      <TeamMailboxFolders domain={domain!} mailbox={mailbox!} />
      <TeamMailboxQuota domain={domain!} mailbox={mailbox!} />
      <TeamMailboxExtraSenders domain={domain!} mailbox={mailbox!} />
      {(canSearch || canRestore) && (
        <UserDeletedMessageVault
          label={`${mailbox}@${domain}`}
          onSearch={(body) => searchTeamMailboxDeletedMessages(domain!, mailbox!, body)}
          onRestore={() => restoreTeamMailboxDeletedMessages(domain!, mailbox!)}
          canSearch={canSearch}
          canRestore={canRestore}
        />
      )}
    </div>
    </>
  );
}
