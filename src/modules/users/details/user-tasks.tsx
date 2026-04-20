import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { reindexUserMailboxes, subscribeAllUserMailboxes, recomputeFastViewProjection, deleteAllUserMailboxes, restoreDeletedMessages, renameUser, deleteUserData, cleanupUserMailbox } from "../api-client";
import { RestoreCriterion, RestoreDeletedMessagesRequest } from "../types";
import RestoreCriteriaBuilder from "../components/restore-criteria-builder";
import RenameUserForm from "../components/rename-user-form";
import DeleteUserDataForm from "../components/delete-user-data-form";
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

const CLEANUP_PARAMS: TaskParam[] = [
  { key: "olderThan", defaultValue: "5d", type: "input" },
];

interface Props {
  username: string;
}

export default function UserTasks({ username }: Props) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const canReindex = useIsAllowed("POST", "/users/{username}/mailboxes");
  const canSubscribeAll = useIsAllowed("POST", "/users/{username}/mailboxes");
  const canRecomputeFastView = useIsAllowed("POST", "/users/{username}/mailboxes");
  const canRestoreDeleted = useIsAllowed("POST", "/deletedMessages/users/{username}");
  const canCleanupMailbox = useIsAllowed("DELETE", "/messages");
  const canRename = useIsAllowed("POST", "/users/{username}/rename/{newUser}");
  const canDeleteAllMailboxes = useIsAllowed("DELETE", "/users/{username}/mailboxes");
  const canDeleteData = useIsAllowed("POST", "/users/{username}");
  const [open, setOpen] = useState(false);
  const [reindexLoading, setReindexLoading] = useState(false);
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [fastViewLoading, setFastViewLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [cleanupTrashLoading, setCleanupTrashLoading] = useState(false);
  const [cleanupSpamLoading, setCleanupSpamLoading] = useState(false);
  const [renameLoading, setRenameLoading] = useState(false);
  const [deleteUserDataLoading, setDeleteUserDataLoading] = useState(false);

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

  const handleRestoreDeletedMessages = async () => {
    let currentCriteria: RestoreCriterion[] = [];
    let currentLimit: number | undefined = undefined;

    try {
      const result = await confirm({
        header: "Restore deleted messages",
        className: "max-w-3xl",
        message: (
          <RestoreCriteriaBuilder
            onChange={(criteria, limit) => {
              currentCriteria = criteria;
              currentLimit = limit;
            }}
          />
        ),
      });
      if (!result) return;

      setRestoreLoading(true);
      const body: RestoreDeletedMessagesRequest = {
        combinator: "and",
        criteria: currentCriteria,
      };
      if (currentLimit !== undefined) {
        body.limit = currentLimit;
      }
      const data = await restoreDeletedMessages(username, body);
      toast({
        title: "Task is running",
        description: <p>Task <a className="text-blue-500 hover:underline" href={`/task/${data.taskId}`}>{data.taskId}</a></p>,
      });
    } catch (err) {
      toast({
        title: "Error restoring deleted messages",
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setRestoreLoading(false);
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

  const handleCleanupTrash = async () => {
    let olderThan = "5d";

    try {
      const result = await confirm({
        header: "Cleanup Trash folder",
        message: (
          <ConfirmTaskContent
            message={<p>Delete messages older than the grace period from the <strong>Trash</strong> folder of <strong>{username}</strong>.</p>}
            command={`curl -XDELETE "/messages?olderThan=5d&mailbox=Trash&user=${username}&useSavedDate"`}
            params={CLEANUP_PARAMS}
            getParamValues={(key, value) => {
              if (key === "olderThan") olderThan = value as string;
            }}
          />
        ),
      });
      if (!result) return;

      setCleanupTrashLoading(true);
      const trashData = await cleanupUserMailbox(username, "Trash", olderThan);
      toast({
        title: "Task is running",
        description: <p>Task <a className="text-blue-500 hover:underline" href={`/task/${trashData.taskId}`}>{trashData.taskId}</a></p>,
      });
    } catch (err) {
      toast({
        title: "Error cleaning up Trash",
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setCleanupTrashLoading(false);
    }
  };

  const handleCleanupSpam = async () => {
    let olderThan = "5d";

    try {
      const result = await confirm({
        header: "Cleanup Spam folder",
        message: (
          <ConfirmTaskContent
            message={<p>Delete messages older than the grace period from the <strong>Spam</strong> folder of <strong>{username}</strong>.</p>}
            command={`curl -XDELETE "/messages?olderThan=5d&mailbox=Spam&user=${username}&useSavedDate"`}
            params={CLEANUP_PARAMS}
            getParamValues={(key, value) => {
              if (key === "olderThan") olderThan = value as string;
            }}
          />
        ),
      });
      if (!result) return;

      setCleanupSpamLoading(true);
      const spamData = await cleanupUserMailbox(username, "Spam", olderThan);
      toast({
        title: "Task is running",
        description: <p>Task <a className="text-blue-500 hover:underline" href={`/task/${spamData.taskId}`}>{spamData.taskId}</a></p>,
      });
    } catch (err) {
      toast({
        title: "Error cleaning up Spam",
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setCleanupSpamLoading(false);
    }
  };

  const handleRenameUser = async () => {
    let currentValues = { newUsername: "", force: false, fromStep: "" };

    try {
      const result = await confirm({
        header: "Rename User",
        message: (
          <RenameUserForm
            username={username}
            onChange={(values) => { currentValues = values; }}
          />
        ),
      });
      if (!result) return;

      if (!currentValues.newUsername.trim()) {
        toast({ title: "New username is required" });
        return;
      }

      setRenameLoading(true);
      const data = await renameUser(username, currentValues.newUsername.trim(), {
        force: currentValues.force || undefined,
        fromStep: currentValues.fromStep || undefined,
      });
      toast({
        title: "Task is running",
        description: <p>Task <a className="text-blue-500 hover:underline" href={`/task/${data.taskId}`}>{data.taskId}</a></p>,
      });
    } catch (err) {
      toast({
        title: "Error renaming user",
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setRenameLoading(false);
    }
  };

  const handleDeleteUserData = async () => {
    let currentFromStep = "";

    try {
      const result = await confirm({
        header: "Delete User Data",
        message: (
          <DeleteUserDataForm
            username={username}
            onChange={(value) => { currentFromStep = value; }}
          />
        ),
      });
      if (!result) return;

      setDeleteUserDataLoading(true);
      const data = await deleteUserData(username, currentFromStep || undefined);
      toast({
        title: "Task is running",
        description: <p>Task <a className="text-blue-500 hover:underline" href={`/task/${data.taskId}`}>{data.taskId}</a></p>,
      });
    } catch (err) {
      toast({
        title: "Error deleting user data",
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setDeleteUserDataLoading(false);
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
          {canReindex && (
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2">
              <p>Reindex all mailboxes</p>
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button className="bg-green-400 hover:bg-green-500 rounded-sm" onClick={handleReindex}>
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
          )}
          {canSubscribeAll && (
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2">
              <p>Subscribe to all mailboxes</p>
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button className="bg-green-400 hover:bg-green-500 rounded-sm" onClick={handleSubscribeAll}>
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
          )}
          {canRecomputeFastView && (
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2">
              <p>Recompute JMAP fast view projection</p>
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button className="bg-green-400 hover:bg-green-500 rounded-sm" onClick={handleRecomputeFastView}>
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
          )}
          {canRestoreDeleted && (
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2">
              <p>Restore deleted messages</p>
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button className="bg-green-400 hover:bg-green-500 rounded-sm" onClick={handleRestoreDeletedMessages}>
                      {restoreLoading && <Loader2 className="animate-spin" />}
                      Run
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    curl -XPOST /deletedMessages/users/{username}?action=restore
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
          {canCleanupMailbox && (
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2">
              <p>Cleanup user Trash folder</p>
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button className="bg-yellow-500 hover:bg-yellow-600 rounded-sm" onClick={handleCleanupTrash}>
                      {cleanupTrashLoading && <Loader2 className="animate-spin" />}
                      Run
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    curl -XDELETE /messages?olderThan=5d&amp;mailbox=Trash&amp;user={username}&amp;useSavedDate
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
          {canCleanupMailbox && (
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2">
              <p>Cleanup user Spam folder</p>
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button className="bg-yellow-500 hover:bg-yellow-600 rounded-sm" onClick={handleCleanupSpam}>
                      {cleanupSpamLoading && <Loader2 className="animate-spin" />}
                      Run
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    curl -XDELETE /messages?olderThan=5d&amp;mailbox=Spam&amp;user={username}&amp;useSavedDate
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
          {canRename && (
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2">
              <p>Rename user</p>
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button className="bg-orange-500 hover:bg-orange-600 rounded-sm" onClick={handleRenameUser}>
                      {renameLoading && <Loader2 className="animate-spin" />}
                      Run
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    curl -XPOST /users/{username}/rename/newUser?action=rename
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
          {canDeleteAllMailboxes && (
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
          )}
          {canDeleteData && (
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2">
              <p>Delete user data</p>
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button className="bg-red-600 hover:bg-red-700 rounded-sm" onClick={handleDeleteUserData}>
                      {deleteUserDataLoading && <Loader2 className="animate-spin" />}
                      Run
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    curl -XPOST /users/{username}?action=deleteData
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
