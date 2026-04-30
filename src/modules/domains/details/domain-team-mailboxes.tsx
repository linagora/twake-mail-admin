import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getTeamMailboxes, createTeamMailbox, deleteTeamMailbox } from "../api-client";
import { GetTeamMailboxesResponseType } from "../types";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { useIsAllowed } from "@/lib/proxy-resolver-context";

interface Props {
  domain: string;
  defaultOpen?: boolean;
}

export default function DomainTeamMailboxes({ domain, defaultOpen }: Props) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const canView = useIsAllowed("GET", "/domains/{domain}/team-mailboxes");
  const canCreate = useIsAllowed("PUT", "/domains/{domain}/team-mailboxes/{name}");
  const canDelete = useIsAllowed("DELETE", "/domains/{domain}/team-mailboxes/{name}");

  const fetchMailboxes = useCallback(() => getTeamMailboxes(domain), [domain]);
  const {
    data: mailboxes,
    isLoading,
    error,
    refresh,
  } = useFetchData<GetTeamMailboxesResponseType>(canView ? fetchMailboxes : null);

  const [open, setOpen] = useState(defaultOpen ?? false);
  const [newName, setNewName] = useState("");
  const [showCreateInput, setShowCreateInput] = useState(false);

  const sorted = useMemo(() => {
    if (!mailboxes) return [];
    return [...mailboxes].sort((a, b) => a.name.localeCompare(b.name));
  }, [mailboxes]);

  if (!canView) return null;

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await createTeamMailbox(domain, name);
      toast({ title: "Team mailbox created" });
      setNewName("");
      setShowCreateInput(false);
      await refresh();
    } catch (err) {
      toast({
        title: "Error creating team mailbox",
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  const handleRemove = async (name: string) => {
    const confirmed = await confirm({
      header: "Delete Team Mailbox",
      message: `Delete team mailbox "${name}@${domain}"?`,
    });
    if (!confirmed) return;
    try {
      await deleteTeamMailbox(domain, name);
      toast({ title: "Team mailbox deleted" });
      await refresh();
    } catch (err) {
      toast({
        title: "Error deleting team mailbox",
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-md font-semibold hover:text-blue-600 transition"
        >
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          Team Mailboxes
          {mailboxes && (
            <span className="text-sm font-normal text-gray-500">
              ({mailboxes.length})
            </span>
          )}
        </button>
        {open && canCreate && (
          <button
            onClick={() => setShowCreateInput(!showCreateInput)}
            className="p-1 rounded-md hover:bg-gray-200 transition"
            title="Add team mailbox"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2">
          {showCreateInput && (
            <div className="flex gap-2 mt-2 mb-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="mailbox name"
                className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAdd}
                disabled={!newName.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          )}

          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            </div>
          )}
          {error && <p className="text-red-500 mt-2">Error: {error}</p>}

          {mailboxes && (
            <div>
              {sorted.map((mb, index) => (
                <div
                  key={mb.name}
                  className="space-y-1 p-4 bg-gray-50 rounded-2 my-2 flex justify-between items-center"
                >
                  <h4 className="text-sm font-medium leading-none">
                    <span className="text-gray-500 mr-2">{index + 1}/</span>
                    <Link
                      to={`/domains/domain/${encodeURIComponent(domain)}/team-mailbox/${encodeURIComponent(mb.name)}`}
                      className="text-blue-600 hover:underline"
                    >
                      {mb.name}
                    </Link>
                    <span className="text-xs text-muted-foreground ml-2">{mb.emailAddress}</span>
                  </h4>
                  {canDelete && (
                    <button
                      onClick={(e) => { e.preventDefault(); handleRemove(mb.name); }}
                      className="p-2 rounded-md hover:bg-gray-200"
                      title="Delete team mailbox"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  )}
                </div>
              ))}
              {mailboxes.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">No team mailboxes configured.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
