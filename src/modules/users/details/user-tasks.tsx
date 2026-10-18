import { useState } from "react";
import { Link } from "react-router";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { reindexUserMailboxes, subscribeAllUserMailboxes, recomputeFastViewProjection, deleteAllUserMailboxes, restoreDeletedMessages, renameUser, deleteUserData, cleanupUserMailbox, tierUserData, provisionUserTemplates } from "../api-client";
import RestoreCriteriaBuilder from "../components/restore-criteria-builder";
import RenameUserForm from "../components/rename-user-form";
import DeleteUserDataForm from "../components/delete-user-data-form";
import ProvisionTemplatesForm, { ProvisionTemplatesValues } from "@/components/custom/provision-templates-form";
import { appConfig } from "@/lib/config";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
import ConfirmTaskContent from "@/modules/common-tasks/components/confirm-task-content";
import FormTaskContent from "@/modules/common-tasks/components/form-task-content";
import {
  buildRestoreRequest,
  deleteAllMailboxesCommand,
  deleteUserDataCommand,
  provisionTemplatesCommand,
  renameUserCommand,
  RenameUserValues,
  restoreDeletedMessagesCommand,
  subscribeAllCommand,
} from "./user-task-commands";
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
  { key: "tiering", defaultValue: "30d", type: "duration" },
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
  // Gate on the user-scoped call: without `user`, DELETE /messages expires every user's messages
  const canCleanupTrash = useIsAllowed("DELETE", "/messages?user={username}&mailbox=Trash");
  const canCleanupSpam = useIsAllowed("DELETE", "/messages?user={username}&mailbox=Spam");
  const canRename = useIsAllowed("POST", "/users/{username}/rename/{newUser}");
  const canDeleteAllMailboxes = useIsAllowed("DELETE", "/users/{username}/mailboxes");
  const canDeleteData = useIsAllowed("POST", "/users/{username}?action=deleteData");
  const canTierData = useIsAllowed("POST", "/users/{username}/data?tiering={tiering}");
  const canProvisionTemplates = useIsAllowed("POST", "/users/{username}/templates");
  const [open, setOpen] = useState(false);
  const [subscribeLoading, setSubscribeLoading] = useState(false);

  const toastTaskRunning = (taskId: string) => toast({
    title: t("common.taskRunning"),
    description: <p><Link className="text-blue-500 hover:underline" to={`/task/${taskId}`}>{t("common.taskLink", { taskId })}</Link></p>,
  });

  const handleProvisionTemplates = async () => {
    let values: ProvisionTemplatesValues = { sourceUser: "", folderName: "", overwriteExisting: false, prune: false, usersPerSecond: "1" };

    await confirm({
      header: t("users.tasks.provisionTemplatesTitle"),
      message: (
        <FormTaskContent
          initialValues={values}
          renderForm={(onChange) => <ProvisionTemplatesForm onChange={onChange} />}
          buildCommand={(v) => provisionTemplatesCommand(username, v)}
          onChange={(v) => { values = v; }}
        />
      ),
      validate: () => (values.sourceUser.trim() ? null : t("provisionTemplates.sourceUserRequired")),
      action: async () => {
        const data = await provisionUserTemplates(username, {
          from: values.sourceUser.trim(),
          folderName: values.folderName.trim() || undefined,
          overwriteExisting: values.overwriteExisting,
          prune: values.prune,
        });
        toastTaskRunning(data.taskId);
      },
    });
  };

  const handleReindex = async () => {
    const additionalParams: any = {};
    await confirm({
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
      action: async () => {
        const data = await reindexUserMailboxes(username, additionalParams);
        toastTaskRunning(data.taskId);
      },
    });
  };

  const handleSubscribeAll = async () => {
    try {
      const result = await confirm({
        header: t("users.tasks.subscribeTitle"),
        message: (
          <ConfirmTaskContent
            message={<p>{t("users.tasks.subscribeDesc", { username })}</p>}
            command={subscribeAllCommand(username)}
          />
        ),
      });
      if (!result) return;

      setSubscribeLoading(true);
      const data = await subscribeAllUserMailboxes(username);
      toastTaskRunning(data.taskId);
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
    const additionalParams: any = {};
    await confirm({
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
      action: async () => {
        const data = await recomputeFastViewProjection(username, additionalParams);
        toastTaskRunning(data.taskId);
      },
    });
  };

  const handleRestoreDeletedMessages = async () => {
    let request = buildRestoreRequest([], undefined);
    let criteriaValid = true;

    await confirm({
      header: t("users.deletedVault.restoreTitle"),
      className: "max-w-3xl",
      message: (
        <FormTaskContent
          initialValues={request}
          renderForm={(onChange) => (
            <RestoreCriteriaBuilder
              onChange={(criteria, limit, isValid) => {
                criteriaValid = isValid;
                onChange(buildRestoreRequest(criteria, limit));
              }}
            />
          )}
          buildCommand={(r) => restoreDeletedMessagesCommand(username, r)}
          onChange={(r) => { request = r; }}
        />
      ),
      // The criteria builder already shows why the criteria cannot be sent
      validate: () => (criteriaValid ? null : false),
      action: async () => {
        const data = await restoreDeletedMessages(username, request);
        toastTaskRunning(data.taskId);
      },
    });
  };

  const handleDeleteAllMailboxes = async () => {
    const confirmed = await confirm({
      header: t("users.tasks.deleteAllMailboxesTitle"),
      message: (
        <ConfirmTaskContent
          message={<p>{t("users.tasks.deleteAllMailboxesConfirm", { username })}</p>}
          command={deleteAllMailboxesCommand(username)}
        />
      ),
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

  const handleCleanupMailbox = async (mailbox: "Trash" | "Spam") => {
    let olderThan = "5d";

    await confirm({
      header: t(`users.tasks.cleanup${mailbox}Title`),
      message: (
        <ConfirmTaskContent
          message={<p>{t(`users.tasks.cleanup${mailbox}Desc`, { username })}</p>}
          command={`curl -XDELETE "/messages?olderThan=5d&mailbox=${mailbox}&user=${username}&useSavedDate"`}
          params={CLEANUP_PARAMS}
          getParamValues={(key, value) => {
            if (key === "olderThan") olderThan = value as string;
          }}
        />
      ),
      action: async () => {
        const data = await cleanupUserMailbox(username, mailbox, olderThan);
        toastTaskRunning(data.taskId);
      },
    });
  };

  const handleRenameUser = async () => {
    let currentValues: RenameUserValues = { newUsername: "", force: false, fromStep: "" };

    await confirm({
      header: t("users.tasks.renameTitle"),
      message: (
        <FormTaskContent
          initialValues={currentValues}
          renderForm={(onChange) => <RenameUserForm username={username} onChange={onChange} />}
          buildCommand={(values) => renameUserCommand(username, values)}
          onChange={(values) => { currentValues = values; }}
        />
      ),
      validate: () => (currentValues.newUsername.trim() ? null : t("renameUserForm.newUsernameRequired")),
      action: async () => {
        const data = await renameUser(username, currentValues.newUsername.trim(), {
          force: currentValues.force || undefined,
          fromStep: currentValues.fromStep || undefined,
        });
        toastTaskRunning(data.taskId);
      },
    });
  };

  const handleDeleteUserData = async () => {
    let currentFromStep = "";

    await confirm({
      header: t("users.tasks.deleteDataTitle"),
      message: (
        <FormTaskContent
          initialValues={currentFromStep}
          renderForm={(onChange) => <DeleteUserDataForm username={username} onChange={onChange} />}
          buildCommand={(fromStep) => deleteUserDataCommand(username, fromStep)}
          onChange={(value) => { currentFromStep = value; }}
        />
      ),
      action: async () => {
        const data = await deleteUserData(username, currentFromStep || undefined);
        toastTaskRunning(data.taskId);
      },
    });
  };

  const handleTierData = async () => {
    const additionalParams: any = {};

    await confirm({
      header: t("users.tasks.tierDataTitle"),
      message: (
        <ConfirmTaskContent
          message={<p>{t("users.tasks.tierDataDesc", { username })}</p>}
          command={`curl -XPOST /users/${username}/data`}
          params={TIER_PARAMS}
          getParamValues={(key, value) => {
            additionalParams[key] = value;
          }}
        />
      ),
      validate: () => (additionalParams.tiering ? null : t("users.tasks.tieringRequired")),
      action: async () => {
        const data = await tierUserData(username, {
          tiering: additionalParams.tiering,
          messagesPerSecond: additionalParams.messagesPerSecond || undefined,
        });
        toastTaskRunning(data.taskId);
      },
    });
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
                    <Button className="bg-yellow-500 hover:bg-yellow-600 rounded-sm" onClick={() => handleCleanupMailbox("Trash")}>
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
                    <Button className="bg-yellow-500 hover:bg-yellow-600 rounded-sm" onClick={() => handleCleanupMailbox("Spam")}>
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
          {canProvisionTemplates && appConfig.application === 'MAIL' && (
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2">
              <p>{t("users.tasks.provisionTemplates")}</p>
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button className="bg-yellow-500 hover:bg-yellow-600 rounded-sm" onClick={handleProvisionTemplates}>
                      {t("common.run")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    curl -XPOST /users/{username}/templates?action=provision&amp;from=&#123;sourceUser&#125;
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
