import { useState } from "react";
import { Link } from "react-router";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { reindexUserMailboxes, subscribeAllUserMailboxes, recomputeFastViewProjection, deleteAllUserMailboxes, restoreDeletedMessages, renameUser, deleteUserData, cleanupUserMailbox, tierUserData } from "../api-client";
import { RestoreCriterion, RestoreDeletedMessagesRequest } from "../types";
import RestoreCriteriaBuilder from "../components/restore-criteria-builder";
import RenameUserForm from "../components/rename-user-form";
import DeleteUserDataForm from "../components/delete-user-data-form";
import { appConfig } from "@/lib/config";
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

const TIER_PARAMS: TaskParam[] = [
  { key: "tiering", defaultValue: "", type: "duration" },
  { key: "messagesPerSecond", defaultValue: "50", type: "input" },
];

interface Props {
  username: string;
}

export default function UserTasks({ username }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canReindex = useIsAllowed("POST", "/users/{username}/mailboxes");
  const canSubscribeAll = useIsAllowed("POST", "/users/{username}/mailboxes");
  const canRecomputeFastView = useIsAllowed("POST", "/users/{username}/mailboxes");
  const canRestoreDeleted = useIsAllowed("POST", "/deletedMessages/users/{username}");
  const canCleanupTrash = useIsAllowed("DELETE", "/messages?mailbox=Trash");
  const canCleanupSpam = useIsAllowed("DELETE", "/messages?mailbox=Spam");
  const canRename = useIsAllowed("POST", "/users/{username}/rename/{newUser}");
  const canDeleteAllMailboxes = useIsAllowed("DELETE", "/users/{username}/mailboxes");
  const canDeleteData = useIsAllowed("POST", "/users/{username}?action=deleteData");
  const canTierData = useIsAllowed("POST", "/users/{username}/data?tiering={tiering}");
  const [open, setOpen] = useState(false);
  const [reindexLoading, setReindexLoading] = useState(false);
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [fastViewLoading, setFastViewLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [cleanupTrashLoading, setCleanupTrashLoading] = useState(false);
  const [cleanupSpamLoading, setCleanupSpamLoading] = useState(false);
  const [renameLoading, setRenameLoading] = useState(false);
  const [deleteUserDataLoading, setDeleteUserDataLoading] = useState(false);
  const [tierDataLoading, setTierDataLoading] = useState(false);

  const handleReindex = async () => {
    try {
      const additionalParams: any = {};
      const result = await confirm({
        header: t("users.tasks.reindexTitle"),
        message: (
          <ConfirmTaskContent
            message={<p>{t("users.tasks.reindexDesc", { username })}</p>}
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
        title: t("common.taskRunning"),
        description: <p><Link className="text-blue-500 hover:underline" to={`/task/${data.taskId}`}>{t("common.taskLink", { taskId: data.taskId })}</Link></p>,
      });
    } catch (err) {
      toast({
        title: t("users.tasks.errorReindex"),
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setReindexLoading(false);
    }
  };

  const handleSubscribeAll = async () => {
    try {
      const result = await confirm({
        header: t("users.tasks.subscribeTitle"),
        message: <p>{t("users.tasks.subscribeDesc", { username })}</p>,
      });
      if (!result) return;

      setSubscribeLoading(true);
      const data = await subscribeAllUserMailboxes(username);
      toast({
        title: t("common.taskRunning"),
        description: <p><Link className="text-blue-500 hover:underline" to={`/task/${data.taskId}`}>{t("common.taskLink", { taskId: data.taskId })}</Link></p>,
      });
    } catch (err) {
      toast({
        title: t("users.tasks.errorSubscribe"),
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
        header: t("users.tasks.fastViewTitle"),
        message: (
          <ConfirmTaskContent
            message={<p>{t("users.tasks.fastViewDesc", { username })}</p>}
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
        title: t("common.taskRunning"),
        description: <p><Link className="text-blue-500 hover:underline" to={`/task/${data.taskId}`}>{t("common.taskLink", { taskId: data.taskId })}</Link></p>,
      });
    } catch (err) {
      toast({
        title: t("users.tasks.errorFastView"),
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
        header: t("users.deletedVault.restoreTitle"),
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
        title: t("common.taskRunning"),
        description: <p><Link className="text-blue-500 hover:underline" to={`/task/${data.taskId}`}>{t("common.taskLink", { taskId: data.taskId })}</Link></p>,
      });
    } catch (err) {
      toast({
        title: t("users.tasks.errorRestoreDeleted"),
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setRestoreLoading(false);
    }
  };

  const handleDeleteAllMailboxes = async () => {
    const confirmed = await confirm({
      header: t("users.tasks.deleteAllMailboxesTitle"),
      message: t("users.tasks.deleteAllMailboxesConfirm", { username }),
    });
    if (!confirmed) return;
    try {
      await deleteAllUserMailboxes(username);
      toast({ title: t("users.tasks.allMailboxesDeleted") });
    } catch (err) {
      toast({
        title: t("users.tasks.errorDeletingMailboxes"),
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  const handleCleanupTrash = async () => {
    let olderThan = "5d";

    try {
      const result = await confirm({
        header: t("users.tasks.cleanupTrashTitle"),
        message: (
          <ConfirmTaskContent
            message={<p>{t("users.tasks.cleanupTrashDesc", { username })}</p>}
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
        title: t("common.taskRunning"),
        description: <p><Link className="text-blue-500 hover:underline" to={`/task/${trashData.taskId}`}>{t("common.taskLink", { taskId: trashData.taskId })}</Link></p>,
      });
    } catch (err) {
      toast({
        title: t("users.tasks.errorCleanupTrash"),
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
        header: t("users.tasks.cleanupSpamTitle"),
        message: (
          <ConfirmTaskContent
            message={<p>{t("users.tasks.cleanupSpamDesc", { username })}</p>}
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
        title: t("common.taskRunning"),
        description: <p><Link className="text-blue-500 hover:underline" to={`/task/${spamData.taskId}`}>{t("common.taskLink", { taskId: spamData.taskId })}</Link></p>,
      });
    } catch (err) {
      toast({
        title: t("users.tasks.errorCleanupSpam"),
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
        header: t("users.tasks.renameTitle"),
        message: (
          <RenameUserForm
            username={username}
            onChange={(values) => { currentValues = values; }}
          />
        ),
      });
      if (!result) return;

      if (!currentValues.newUsername.trim()) {
        toast({ title: t("renameUserForm.newUsername") });
        return;
      }

      setRenameLoading(true);
      const data = await renameUser(username, currentValues.newUsername.trim(), {
        force: currentValues.force || undefined,
        fromStep: currentValues.fromStep || undefined,
      });
      toast({
        title: t("common.taskRunning"),
        description: <p><Link className="text-blue-500 hover:underline" to={`/task/${data.taskId}`}>{t("common.taskLink", { taskId: data.taskId })}</Link></p>,
      });
    } catch (err) {
      toast({
        title: t("users.tasks.errorRename"),
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
        header: t("users.tasks.deleteDataTitle"),
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
        title: t("common.taskRunning"),
        description: <p><Link className="text-blue-500 hover:underline" to={`/task/${data.taskId}`}>{t("common.taskLink", { taskId: data.taskId })}</Link></p>,
      });
    } catch (err) {
      toast({
        title: t("users.tasks.errorDeleteData"),
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setDeleteUserDataLoading(false);
    }
  };

  const handleTierData = async () => {
    const additionalParams: any = {};

    try {
      const result = await confirm({
        header: t("users.tasks.tierDataTitle"),
        message: (
          <ConfirmTaskContent
            message={<p>{t("users.tasks.tierDataDesc", { username })}</p>}
            command={`curl -XPOST /users/${username}/data?tiering=30d`}
            params={TIER_PARAMS}
            getParamValues={(key, value) => {
              additionalParams[key] = value;
            }}
          />
        ),
      });
      if (!result) return;

      if (!additionalParams.tiering) {
        toast({ title: t("users.tasks.tieringRequired") });
        return;
      }

      setTierDataLoading(true);
      const data = await tierUserData(username, {
        tiering: additionalParams.tiering,
        messagesPerSecond: additionalParams.messagesPerSecond || undefined,
      });
      toast({
        title: t("common.taskRunning"),
        description: <p><Link className="text-blue-500 hover:underline" to={`/task/${data.taskId}`}>{t("common.taskLink", { taskId: data.taskId })}</Link></p>,
      });
    } catch (err) {
      toast({
        title: t("users.tasks.errorTierData"),
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setTierDataLoading(false);
    }
  };

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-md font-semibold hover:text-blue-600 transition"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {t("common.tasks")}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {canReindex && (
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2">
              <p>{t("users.tasks.reindexAll")}</p>
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button className="bg-green-400 hover:bg-green-500 rounded-sm" onClick={handleReindex}>
                      {reindexLoading && <Loader2 className="animate-spin" />}
                      {t("common.run")}
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
              <p>{t("users.tasks.subscribeAll")}</p>
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button className="bg-green-400 hover:bg-green-500 rounded-sm" onClick={handleSubscribeAll}>
                      {subscribeLoading && <Loader2 className="animate-spin" />}
                      {t("common.run")}
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
              <p>{t("users.tasks.fastView")}</p>
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button className="bg-green-400 hover:bg-green-500 rounded-sm" onClick={handleRecomputeFastView}>
                      {fastViewLoading && <Loader2 className="animate-spin" />}
                      {t("common.run")}
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
              <p>{t("users.tasks.restoreDeleted")}</p>
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button className="bg-green-400 hover:bg-green-500 rounded-sm" onClick={handleRestoreDeletedMessages}>
                      {restoreLoading && <Loader2 className="animate-spin" />}
                      {t("common.run")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    curl -XPOST /deletedMessages/users/{username}?action=restore
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
          {canCleanupTrash && (
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2">
              <p>{t("users.tasks.cleanupTrash")}</p>
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button className="bg-yellow-500 hover:bg-yellow-600 rounded-sm" onClick={handleCleanupTrash}>
                      {cleanupTrashLoading && <Loader2 className="animate-spin" />}
                      {t("common.run")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    curl -XDELETE /messages?olderThan=5d&amp;mailbox=Trash&amp;user={username}&amp;useSavedDate
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
          {canCleanupSpam && (
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2">
              <p>{t("users.tasks.cleanupSpam")}</p>
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button className="bg-yellow-500 hover:bg-yellow-600 rounded-sm" onClick={handleCleanupSpam}>
                      {cleanupSpamLoading && <Loader2 className="animate-spin" />}
                      {t("common.run")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    curl -XDELETE /messages?olderThan=5d&amp;mailbox=Spam&amp;user={username}&amp;useSavedDate
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
          {canTierData && appConfig.application === 'MAIL' && (
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2">
              <p>{t("users.tasks.tierData")}</p>
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button className="bg-yellow-500 hover:bg-yellow-600 rounded-sm" onClick={handleTierData}>
                      {tierDataLoading && <Loader2 className="animate-spin" />}
                      {t("common.run")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    curl -XPOST /users/{username}/data?tiering=&#123;duration&#125;
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
          {canRename && (
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2">
              <p>{t("users.tasks.renameUser")}</p>
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button className="bg-orange-500 hover:bg-orange-600 rounded-sm" onClick={handleRenameUser}>
                      {renameLoading && <Loader2 className="animate-spin" />}
                      {t("common.run")}
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
              <p>{t("users.tasks.deleteAllMailboxes")}</p>
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button className="bg-red-600 hover:bg-red-700 rounded-sm" onClick={handleDeleteAllMailboxes}>
                      {t("common.run")}
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
              <p>{t("users.tasks.deleteData")}</p>
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button className="bg-red-600 hover:bg-red-700 rounded-sm" onClick={handleDeleteUserData}>
                      {deleteUserDataLoading && <Loader2 className="animate-spin" />}
                      {t("common.run")}
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
