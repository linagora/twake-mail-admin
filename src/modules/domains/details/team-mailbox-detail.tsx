import { useCallback, useMemo, useState } from "react";
import { useParams } from "react-router";
import { Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getTeamMailboxMembers, addTeamMailboxMember, removeTeamMailboxMember } from "../api-client";
import { GetTeamMailboxMembersResponseType } from "../types";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { useCheckUserExists } from "@/hooks/use-check-user-exists";
import ErrorDisplayer from "@/components/custom/error-displayer";
import TeamMailboxFolders from "./team-mailbox-folders";
import TeamMailboxQuota from "./team-mailbox-quota";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

export default function TeamMailboxDetail() {
  const { domain, mailbox } = useParams();
  const { toast } = useToast();
  const confirm = useConfirm();

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
      toast({ title: "Member added" });
      setNewMember("");
      await refresh();
    } catch (err) {
      toast({
        title: "Error adding member",
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  const handleRemove = async (username: string) => {
    const confirmed = await confirm({
      header: "Remove Member",
      message: `Remove "${username}" from ${mailbox}@${domain}?`,
    });
    if (!confirmed) return;
    try {
      await removeTeamMailboxMember(domain!, mailbox!, username);
      toast({ title: "Member removed" });
      await refresh();
    } catch (err) {
      toast({
        title: "Error removing member",
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  return (
    <div className="mt-4 p-4 bg-white rounded-2">
      <h3 className="text-lg font-semibold">Team Mailbox Details</h3>
      <p>Mailbox: {mailbox}@{domain}</p>

      <div className="mt-6">
        <button
          onClick={() => setMembersOpen((o) => !o)}
          className="flex items-center gap-1 text-md font-semibold w-full text-left"
        >
          {membersOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          Members {members && <span className="text-sm font-normal text-gray-500">({members.length})</span>}
        </button>

        {membersOpen && (<>
        {/* Add member */}
        <div className="flex gap-2 mt-3 mb-4">
          <input
            type="text"
            value={newMember}
            onChange={(e) => setNewMember(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="user@domain.tld"
            className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {memberStatus === "checking" && (
            <span className="flex items-center text-xs text-gray-400 whitespace-nowrap">Checking...</span>
          )}
          {memberStatus === "exists" && (
            <span className="flex items-center gap-1 text-xs text-green-600 whitespace-nowrap">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
              User exists
            </span>
          )}
          {memberStatus === "not_found" && (
            <span className="flex items-center gap-1 text-xs text-orange-500 whitespace-nowrap">
              <span className="inline-block w-2 h-2 rounded-full bg-orange-400" />
              User not found
            </span>
          )}
          {memberStatus === "invalid" && (
            <span className="flex items-center gap-1 text-xs text-red-600 whitespace-nowrap">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
              Invalid username
            </span>
          )}
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "member" | "manager")}
            className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="member">member</option>
            <option value="manager">manager</option>
          </select>
          <button
            onClick={handleAdd}
            disabled={!newMember.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>

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
              First
            </button>
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm font-medium text-center">
              Page {page} / {totalPages} — Total: {sorted.length}
            </span>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
            <button
              onClick={() => goToPage(totalPages)}
              disabled={page >= totalPages}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Last
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
              <button
                onClick={() => handleRemove(member.username)}
                className="p-2 rounded-md hover:bg-gray-200"
                title="Remove member"
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
            </div>
          ))}
          {members && members.length === 0 && (
            <p className="mt-2 text-sm text-gray-500">No members.</p>
          )}
        </div>
        </>)}
      </div>
      <TeamMailboxFolders domain={domain!} mailbox={mailbox!} />
      <TeamMailboxQuota domain={domain!} mailbox={mailbox!} />
    </div>
  );
}
