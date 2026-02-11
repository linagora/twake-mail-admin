import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { reindexUserMailboxes, subscribeAllUserMailboxes, recomputeFastViewProjection, deleteAllUserMailboxes } from "../api-client";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
import ConfirmTaskContent from "@/modules/common-tasks/components/confirm-task-content";
import { TaskParam } from "@/modules/common-tasks/types";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const REINDEX_PARAMS: TaskParam[] = [
  { key: "messagesPerSecond", defaultValue: "50", type: "input" },
  { key: "mode", values: ["rebuildAll", "fixOutdated"], type: "select" },
];

const FAST_VIEW_PARAMS: TaskParam[] = [
  { key: "messagesPerSecond", defaultValue: "10", type: "input" },
];

interface Props {
  username: string;
}

export default function UserTasks({ username }: Props) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [reindexLoading, setReindexLoading] = useState(false);
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [fastViewLoading, setFastViewLoading] = useState(false);

  const handleReindex = async () => {
    try {
      const additionalParams: any = {};
      const result = await confirm({
        header: "Reindex User Mailboxes",
        message: (
          <ConfirmTaskContent
            message={<p>Reindex all mailboxes for <strong>{username}</strong>.</p>}
            command={`curl -XPOST /users/${username}/mailboxes?task=reIndex`}
            params={REINDEX_PARAMS}
            getParamValues={(key, value) => {
              additionalParams[key] = value;
            }}
          />
        ),
      });
      if (!result) return;

      setReindexLoading(true);
      const data = await reindexUserMailboxes(username, additionalParams);
      toast({
        title: "Task is running",
        description: <p>Task <a className="text-blue-500 hover:underline" href={`/task/${data.taskId}`}>{data.taskId}</a></p>,
      });
    } catch (err) {
      toast({
        title: "Error running reindex task",
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setReindexLoading(false);
    }
  };

  const handleSubscribeAll = async () => {
    try {
      const result = await confirm({
        header: "Subscribe All Mailboxes",
        message: <p>Subscribe <strong>{username}</strong> to all of its mailboxes?</p>,
      });
      if (!result) return;

      setSubscribeLoading(true);
      const data = await subscribeAllUserMailboxes(username);
      toast({
        title: "Task is running",
        description: <p>Task <a className="text-blue-500 hover:underline" href={`/task/${data.taskId}`}>{data.taskId}</a></p>,
      });
    } catch (err) {
      toast({
        title: "Error running subscribe all task",
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setSubscribeLoading(false);
    }
  };

  const handleRecomputeFastView = async () => {
    try {
      const additionalParams: any = {};
      const result = await confirm({
        header: "Recompute JMAP Fast View Projection",
        message: (
          <ConfirmTaskContent
            message={<p>Recompute fast message view projection for <strong>{username}</strong>.</p>}
            command={`curl -XPOST /users/${username}/mailboxes?task=recomputeFastViewProjectionItems`}
            params={FAST_VIEW_PARAMS}
            getParamValues={(key, value) => {
              additionalParams[key] = value;
            }}
          />
        ),
      });
      if (!result) return;

      setFastViewLoading(true);
      const data = await recomputeFastViewProjection(username, additionalParams);
      toast({
        title: "Task is running",
        description: <p>Task <a className="text-blue-500 hover:underline" href={`/task/${data.taskId}`}>{data.taskId}</a></p>,
      });
    } catch (err) {
      toast({
        title: "Error running recompute task",
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setFastViewLoading(false);
    }
  };

  const handleDeleteAllMailboxes = async () => {
    const confirmed = await confirm({
      header: "Delete All Mailboxes",
      message: `Are you sure you want to delete ALL mailboxes for "${username}"? This cannot be undone.`,
    });
    if (!confirmed) return;
    try {
      await deleteAllUserMailboxes(username);
      toast({ title: "All mailboxes deleted successfully" });
    } catch (err) {
      toast({
        title: "Error deleting all mailboxes",
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
        Tasks
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2">
            <p>Reindex all mailboxes</p>
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button className="bg-green-600 hover:bg-green-700 rounded-sm" onClick={handleReindex}>
                    {reindexLoading && <Loader2 className="animate-spin" />}
                    Run
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  curl -XPOST /users/{username}/mailboxes?task=reIndex
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2">
            <p>Subscribe to all mailboxes</p>
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button className="bg-green-600 hover:bg-green-700 rounded-sm" onClick={handleSubscribeAll}>
                    {subscribeLoading && <Loader2 className="animate-spin" />}
                    Run
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  curl -XPOST /users/{username}/mailboxes?task=subscribeAll
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2">
            <p>Recompute JMAP fast view projection</p>
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button className="bg-green-600 hover:bg-green-700 rounded-sm" onClick={handleRecomputeFastView}>
                    {fastViewLoading && <Loader2 className="animate-spin" />}
                    Run
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  curl -XPOST /users/{username}/mailboxes?task=recomputeFastViewProjectionItems
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2">
            <p>Delete all mailboxes</p>
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button className="bg-red-600 hover:bg-red-700 rounded-sm" onClick={handleDeleteAllMailboxes}>
                    Run
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  curl -XDELETE /users/{username}/mailboxes
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      )}
    </div>
  );
}
