import { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, LogOut } from "lucide-react";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getUserTeamMailboxes } from "../api-client";
import { removeTeamMailboxMember } from "@/modules/domains/api-client";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";

interface Props {
  username: string;
}

export default function UserTeamMailboxes({ username }: Props) {
  const { toast } = useToast();
  const confirm = useConfirm();

  const fetchMailboxes = useCallback(() => getUserTeamMailboxes(username), [username]);
  const {
    data: mailboxes,
    isLoading,
    error,
    refresh,
  } = useFetchData<{ name: string; emailAddress: string }[]>(fetchMailboxes);

  const [open, setOpen] = useState(false);

  const sorted = useMemo(() => {
    if (!mailboxes) return [];
    return [...mailboxes].sort((a, b) => a.name.localeCompare(b.name));
  }, [mailboxes]);

  const handleLeave = async (mb: { name: string; emailAddress: string }) => {
    const domain = mb.emailAddress.split("@")[1];
    const confirmed = await confirm({
      header: "Leave Team Mailbox",
      message: `Remove "${username}" from team mailbox "${mb.emailAddress}"?`,
    });
    if (!confirmed) return;
    try {
      await removeTeamMailboxMember(domain, mb.name, username);
      toast({ title: `Left team mailbox "${mb.emailAddress}"` });
      await refresh();
    } catch (err) {
      toast({
        title: "Error leaving team mailbox",
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  return (
    <div className="mt-6">
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

      {open && (
        <div className="mt-2">
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
                  key={mb.emailAddress}
                  className="space-y-1 p-4 bg-gray-50 rounded-2 my-2 flex justify-between items-center"
                >
                  <h4 className="text-sm font-medium leading-none">
                    <span className="text-gray-500 mr-2">{index + 1}/</span>
                    {mb.emailAddress}
                  </h4>
                  <button
                    onClick={() => handleLeave(mb)}
                    className="flex items-center gap-1 px-2 py-1 text-sm text-red-600 rounded-md hover:bg-gray-200"
                    title="Leave team mailbox"
                  >
                    <LogOut className="w-4 h-4" />
                    Leave
                  </button>
                </div>
              ))}
              {mailboxes.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">Not a member of any team mailbox.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
