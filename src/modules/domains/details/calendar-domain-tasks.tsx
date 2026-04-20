import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { deleteAllUsersData, syncDomainMembers } from "../api-client";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Button } from "@/components/ui/button";
import { useIsAllowed } from "@/lib/proxy-resolver-context";

interface Props {
  domain: string;
  defaultOpen?: boolean;
}

export default function CalendarDomainTasks({ domain, defaultOpen = false }: Props) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const canDeleteData = useIsAllowed("POST", "/domains/{domain}");
  const canSyncMembers = useIsAllowed("POST", "/addressbook/domain-members/{domain}");
  const [open, setOpen] = useState(defaultOpen);
  const [deleting, setDeleting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleDeleteAllUsersData = async () => {
    const confirmed = await confirm({
      header: "Delete All Users Data",
      message: `This will delete the data of ALL users belonging to "${domain}". This action cannot be undone. Are you sure?`,
    });
    if (!confirmed) return;

    setDeleting(true);
    try {
      const { taskId } = await deleteAllUsersData(domain);
      toast({
        title: "Task started",
        description: <p>Task <a className="text-blue-500 hover:underline" href={`/task/${taskId}`}>{taskId}</a></p>,
      });
    } catch (err) {
      toast({ title: "Error deleting users data", description: <ErrorDisplayer error={err} /> });
    } finally {
      setDeleting(false);
    }
  };

  const handleSyncDomainMembers = async () => {
    const confirmed = await confirm({
      header: "Domain Member Synchronization",
      message: `Synchronize LDAP members for "${domain}"?`,
    });
    if (!confirmed) return;

    setSyncing(true);
    try {
      const { taskId } = await syncDomainMembers(domain);
      toast({
        title: "Task started",
        description: <p>Task <a className="text-blue-500 hover:underline" href={`/task/${taskId}`}>{taskId}</a></p>,
      });
    } catch (err) {
      toast({ title: "Error synchronizing domain members", description: <ErrorDisplayer error={err} /> });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-md font-semibold hover:text-blue-600 transition"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        Tasks
      </button>

      {open && (canSyncMembers || canDeleteData) && (
        <div className="mt-2 p-4 bg-gray-50 rounded-2 space-y-4">
          {canSyncMembers && (
            <>
              <Button
                className="bg-green-400 hover:bg-green-500 rounded-sm w-full"
                onClick={handleSyncDomainMembers}
                disabled={syncing}
              >
                {syncing && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                Domain member synchronization
              </Button>
              <p className="text-xs text-muted-foreground">
                Synchronizes LDAP members for this domain. A task will be created to track progress.
              </p>
            </>
          )}
          {canDeleteData && (
            <>
              <Button
                className="bg-red-600 hover:bg-red-700 rounded-sm w-full"
                onClick={handleDeleteAllUsersData}
                disabled={deleting}
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                Delete all users data
              </Button>
              <p className="text-xs text-muted-foreground">
                Deletes the data of every user belonging to this domain. A task will be created to track progress.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
