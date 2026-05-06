import { useCallback, useMemo, useState } from "react";
import { useParams } from "react-router";
import { Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getTeamMailboxMembers, addTeamMailboxMember, removeTeamMailboxMember, searchTeamMailboxDeletedMessages, restoreTeamMailboxDeletedMessages } from "../api-client";
import { GetTeamMailboxMembersResponseType } from "../types";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { useCheckUserExists } from "@/hooks/use-check-user-exists";
import ErrorDisplayer from "@/components/custom/error-displayer";
import TeamMailboxFolders from "./team-mailbox-folders";
import TeamMailboxQuota from "./team-mailbox-quota";
import TeamMailboxExtraSenders from "./team-mailbox-extra-senders";
import UserDeletedMessageVault from "@/modules/users/details/user-deleted-message-vault";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

export default function TeamMailboxDetail() {
  const { t } = useTranslation();
  const { domain, mailbox } = useParams();
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

  const [membersOpen, setMembersOpen] = useState(true);
  const [page, setPage] = useState(1);
  const [newMember, setNewMember] = useState("");
  const [role, setRole] = useState<"member" | "manager">("member");
  const memberStatus = useCheckUserExists(newMember);

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

  const handleAdd = async () => {
    const username = newMember.trim();
    if (!username) return;
    try {
      await addTeamMailboxMember(domain!, mailbox!, username, role);
      toast({ title: t("domains.teamMailbox.memberAdded") });
      setNewMember("");
      await refresh();
    } catch (err) {
      toast({
        title: t("domains.teamMailbox.errorAddingMember"),
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  const handleRemove = async (username: string) => {
    const confirmed = await confirm({
      header: t("domains.teamMailbox.removeMemberTitle"),
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
    <div className="mt-4 p-4 bg-white rounded-2">
      <h3 className="text-lg font-semibold">{t("domains.teamMailbox.detailTitle")}</h3>
      <p>{t("domains.teamMailbox.label", { mailbox, domain })}</p>

      <div className="mt-6">
        <button
          onClick={() => setMembersOpen((o) => !o)}
          className="flex items-center gap-1 text-md font-semibold w-full text-left"
        >
          {membersOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {t("domains.teamMailbox.members")} {members && <span className="text-sm font-normal text-gray-500">({members.length})</span>}
        </button>

        {membersOpen && (<>
        {/* Add member */}
        {canAddMember && (<div className="flex gap-2 mt-3 mb-4">
          <input
            type="text"
            value={newMember}
            onChange={(e) => setNewMember(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="user@domain.tld"
            className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {memberStatus === "checking" && (
            <span className="flex items-center text-xs text-gray-400 whitespace-nowrap">{t("common.checking")}</span>
          )}
          {memberStatus === "exists" && (
            <span className="flex items-center gap-1 text-xs text-green-600 whitespace-nowrap">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
              {t("common.userExists")}
            </span>
          )}
          {memberStatus === "not_found" && (
            <span className="flex items-center gap-1 text-xs text-orange-500 whitespace-nowrap">
              <span className="inline-block w-2 h-2 rounded-full bg-orange-400" />
              {t("common.userNotFound")}
            </span>
          )}
          {memberStatus === "invalid" && (
            <span className="flex items-center gap-1 text-xs text-red-600 whitespace-nowrap">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
              {t("common.invalidUsername")}
            </span>
          )}
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "member" | "manager")}
            className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="member">{t("domains.teamMailbox.member")}</option>
            <option value="manager">{t("domains.teamMailbox.manager")}</option>
          </select>
          <button
            onClick={handleAdd}
            disabled={!newMember.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("common.add")}
          </button>
        </div>)}

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
          </div>
        )}
        {error && <p className="text-red-500 mt-2">Error: {error}</p>}

        {/* Pagination */}
        {sorted.length > 0 && (
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
              {t("common.page", { page, totalPages, total: sorted.length })}
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

        {/* Member list */}
        <div>
          {paginated.map((member, index) => (
            <div
              key={member.username}
              className="space-y-1 p-4 bg-gray-50 rounded-2 my-2 flex justify-between items-center"
            >
              <h4 className="text-sm font-medium leading-none">
                <span className="text-gray-500 mr-2">{(page - 1) * PAGE_LIMIT + index + 1}/</span>
                {member.username}
                <span className="text-xs text-muted-foreground ml-2">({member.role})</span>
              </h4>
              {canRemoveMember && (
                <button
                  onClick={() => handleRemove(member.username)}
                  className="p-2 rounded-md hover:bg-gray-200"
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
        </>)}
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
  );
}
