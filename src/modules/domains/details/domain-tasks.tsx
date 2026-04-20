import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { deleteAllUsersData } from "../api-client";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Button } from "@/components/ui/button";
import { useIsAllowed } from "@/lib/proxy-resolver-context";

interface Props {
  domain: string;
  defaultOpen?: boolean;
}

export default function DomainTasks({ domain, defaultOpen }: Props) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const canDeleteData = useIsAllowed("POST", "/domains/{domain}?action=deleteData");
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [deleting, setDeleting] = useState(false);

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
      toast({
        title: "Error deleting users data",
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setDeleting(false);
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

      {open && canDeleteData && (
        <div className="mt-2 p-4 bg-gray-50 rounded-2">
          <Button
            className="bg-red-600 hover:bg-red-700 rounded-sm w-full"
            onClick={handleDeleteAllUsersData}
            disabled={deleting}
          >
            {deleting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            Delete all users data
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Deletes the data of every user belonging to this domain. A task will be created to track progress.
          </p>
        </div>
      )}
    </div>
  );
}
