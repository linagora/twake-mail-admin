import { ComponentProps, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import TaskRow from "@/components/custom/task-row";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { reindexUserMailboxes, subscribeAllUserMailboxes, recomputeFastViewProjection, deleteAllUserMailboxes, restoreDeletedMessages, renameUser, deleteUserData, cleanupUserMailbox, tierUserData, provisionUserTemplates } from "../api-client";
import RestoreCriteriaBuilder from "../components/restore-criteria-builder";
import RenameUserForm from "../components/rename-user-form";
import DeleteUserDataForm from "../components/delete-user-data-form";
import ProvisionTemplatesForm, { ProvisionTemplatesValues } from "@/components/custom/provision-templates-form";
import { appConfig } from "@/lib/config";
import { useToast } from "@/hooks/use-toast";
import { useTaskCreatedToast } from "@/hooks/use-task-created-toast";
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
import { defaultCommand } from "@/modules/common-tasks/components/command-preview";
import { SectionToggle, useSectionOpen } from "@/components/custom/collapsible-section";
import { taskTypeLabel } from "@/modules/tasks/task-summary";

const REINDEX_PARAMS: TaskParam[] = [
  { key: "messagesPerSecond", defaultValue: "50", type: "input" },
  { key: "mode", values: ["", "fixOutdated", "rebuildAll"], type: "select" },
];

const FAST_VIEW_PARAMS: TaskParam[] = [
  { key: "messagesPerSecond", defaultValue: "10", type: "input" },
];

const CLEANUP_PARAMS: TaskParam[] = [
  { key: "olderThan", defaultValue: "5d", type: "input" },
];

const TIER_PARAMS: TaskParam[] = [
  // WebAdmin requires it (no server default): marked required, not "(optional)"
  { key: "tiering", defaultValue: "30d", type: "duration", optional: false },
  { key: "messagesPerSecond", defaultValue: "50", type: "input" },
];

const INITIAL_PROVISION_VALUES: ProvisionTemplatesValues = { sourceUser: "", folderName: "", overwriteExisting: false, prune: false, usersPerSecond: "1" };

const INITIAL_RENAME_VALUES: RenameUserValues = { newUsername: "", force: false, fromStep: "" };

interface Props {
  username: string;
}

// The criteria builder of the restore dialog. Once a confirm is refused because of incomplete
// criteria, the dialog shows the error in place of the builder's hint and their empty controls are flagged.
function RestoreDeletedMessagesForm({ flagIncomplete, onChange }: {
  flagIncomplete: { current: () => void };
  onChange: ComponentProps<typeof RestoreCriteriaBuilder>["onChange"];
}) {
  const [flagged, setFlagged] = useState(false);
  useEffect(() => {
    flagIncomplete.current = () => setFlagged(true);
  }, [flagIncomplete]);
  return <RestoreCriteriaBuilder onChange={onChange} flagIncomplete={flagged} showIncompleteMessage={!flagged} />;
}

export default function UserTasks({ username }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const toastTaskCreated = useTaskCreatedToast();
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
  const [open, setOpen, openContentId] = useSectionOpen("tasks");
  const [subscribeLoading, setSubscribeLoading] = useState(false);

  // Each Run tooltip shows the command its dialog first previews, with the default parameters
  const reindexCommand = `curl -XPOST /users/${username}/mailboxes?task=reIndex`;
  const fastViewCommand = `curl -XPOST /users/${username}/mailboxes?task=recomputeFastViewProjectionItems`;
  const cleanupCommand = (mailbox: "Trash" | "Spam") =>
    `curl -XDELETE "/messages?olderThan=5d&mailbox=${mailbox}&user=${username}&useSavedDate"`;
  const tierCommand = `curl -XPOST /users/${username}/data`;


  const handleProvisionTemplates = async () => {
    let values = INITIAL_PROVISION_VALUES;

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
        toastTaskCreated(data.taskId, undefined, taskTypeLabel(t, "UserTemplatesProvisionTask"));
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
          command={reindexCommand}
          params={REINDEX_PARAMS}
          getParamValues={(key, value) => {
            additionalParams[key] = value;
          }}
        />
      ),
      action: async () => {
        const data = await reindexUserMailboxes(username, additionalParams);
        toastTaskCreated(data.taskId, undefined, taskTypeLabel(t, "user-reindexing"));
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
      toastTaskCreated(data.taskId, undefined, taskTypeLabel(t, "SubscribeAllTask"));
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
          command={fastViewCommand}
          params={FAST_VIEW_PARAMS}
          getParamValues={(key, value) => {
            additionalParams[key] = value;
          }}
        />
      ),
      action: async () => {
        const data = await recomputeFastViewProjection(username, additionalParams);
        toastTaskCreated(data.taskId, undefined, taskTypeLabel(t, "RecomputeUserFastViewProjectionItemsTask"));
      },
    });
  };

  const handleRestoreDeletedMessages = async () => {
    let request = buildRestoreRequest([], undefined);
    let criteriaValid = true;
    // Set by the form once mounted: flags the incomplete criteria after a refused confirm
    const flagIncomplete = { current: () => {} };

    await confirm({
      header: t("users.deletedVault.restoreTitle"),
      className: "max-w-3xl",
      message: (
        <FormTaskContent
          initialValues={request}
          renderForm={(onChange) => (
            <RestoreDeletedMessagesForm
              flagIncomplete={flagIncomplete}
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
      validate: () => {
        if (criteriaValid) return null;
        flagIncomplete.current();
        return t("users.deletedVault.criteria.incomplete");
      },
      action: async () => {
        const data = await restoreDeletedMessages(username, request);
        toastTaskCreated(data.taskId, undefined, taskTypeLabel(t, "deleted-messages-restore"));
      },
    });
  };

  const handleDeleteAllMailboxes = async () => {
    const confirmed = await confirm({
      header: t("users.tasks.deleteAllMailboxesTitle"),
      destructive: true,
      confirmLabel: t("confirm.deleteMailboxes"),
      consequence: t("confirm.consequence.deleteMailboxes", { user: username }),
      typeToConfirm: username,
      typeToConfirmIgnoreCase: true,
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
      header: t(`users.tasks.cleanup${mailbox}`),
      message: (
        <ConfirmTaskContent
          message={<p>{t(`users.tasks.cleanup${mailbox}Desc`, { username })}</p>}
          command={cleanupCommand(mailbox)}
          params={CLEANUP_PARAMS}
          getParamValues={(key, value) => {
            if (key === "olderThan") olderThan = value as string;
          }}
        />
      ),
      action: async () => {
        const data = await cleanupUserMailbox(username, mailbox, olderThan);
        toastTaskCreated(data.taskId, undefined, taskTypeLabel(t, "ExpireMailboxTask"));
      },
    });
  };

  const handleRenameUser = async () => {
    let currentValues = INITIAL_RENAME_VALUES;

    await confirm({
      header: t("users.tasks.renameUser"),
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
        toastTaskCreated(data.taskId, undefined, taskTypeLabel(t, "UsernameChangeTask"));
      },
    });
  };

  const handleDeleteUserData = async () => {
    let currentFromStep = "";

    await confirm({
      header: t("users.tasks.deleteDataTitle", { username }),
      destructive: true,
      confirmLabel: t("confirm.deleteUserData"),
      consequence: t("confirm.consequence.deleteUserData", { user: username }),
      typeToConfirm: username,
      typeToConfirmIgnoreCase: true,
      message: (
        <FormTaskContent
          initialValues={currentFromStep}
          renderForm={(onChange) => <DeleteUserDataForm onChange={onChange} />}
          buildCommand={(fromStep) => deleteUserDataCommand(username, fromStep)}
          onChange={(value) => { currentFromStep = value; }}
        />
      ),
      action: async () => {
        const data = await deleteUserData(username, currentFromStep || undefined);
        toastTaskCreated(data.taskId, undefined, taskTypeLabel(t, "DeleteUserDataTask"));
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
          command={tierCommand}
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
        toastTaskCreated(data.taskId, undefined, taskTypeLabel(t, "UserDataTieringTask"));
      },
    });
  };

  return (
    <div className="mt-6">
      <SectionToggle open={open} onToggle={() => setOpen(!open)} controls={openContentId}>
        {t("common.tasks")}
      </SectionToggle>

      {open && (
        <div id={openContentId} className="mt-2 space-y-2">
          {canReindex && (
            <TaskRow
              title={t("users.tasks.reindexAll")}
              description={t("users.tasks.desc.reindexAll")}
              risk="safe"
              command={defaultCommand(reindexCommand, REINDEX_PARAMS)}
              onRun={handleReindex}
            />
          )}
          {canSubscribeAll && (
            <TaskRow
              title={t("users.tasks.subscribeAll")}
              description={t("users.tasks.desc.subscribeAll")}
              risk="safe"
              command={subscribeAllCommand(username)}
              onRun={handleSubscribeAll}
              loading={subscribeLoading}
            />
          )}
          {canRecomputeFastView && (
            <TaskRow
              title={t("users.tasks.fastView")}
              description={t("users.tasks.desc.fastView")}
              risk="safe"
              command={defaultCommand(fastViewCommand, FAST_VIEW_PARAMS)}
              onRun={handleRecomputeFastView}
            />
          )}
          {canRestoreDeleted && (
            <TaskRow
              title={t("users.tasks.restoreDeleted")}
              description={t("users.tasks.desc.restoreDeleted")}
              risk="safe"
              command={restoreDeletedMessagesCommand(username, buildRestoreRequest([], undefined))}
              onRun={handleRestoreDeletedMessages}
            />
          )}
          {canCleanupTrash && (
            <TaskRow
              title={t("users.tasks.cleanupTrash")}
              description={t("users.tasks.desc.cleanupTrash")}
              risk="caution"
              command={defaultCommand(cleanupCommand("Trash"), CLEANUP_PARAMS)}
              onRun={() => handleCleanupMailbox("Trash")}
            />
          )}
          {canCleanupSpam && (
            <TaskRow
              title={t("users.tasks.cleanupSpam")}
              description={t("users.tasks.desc.cleanupSpam")}
              risk="caution"
              command={defaultCommand(cleanupCommand("Spam"), CLEANUP_PARAMS)}
              onRun={() => handleCleanupMailbox("Spam")}
            />
          )}
          {canProvisionTemplates && appConfig.application === 'MAIL' && (
            <TaskRow
              title={t("users.tasks.provisionTemplates")}
              description={t("users.tasks.desc.provisionTemplates")}
              risk="caution"
              command={provisionTemplatesCommand(username, INITIAL_PROVISION_VALUES)}
              onRun={handleProvisionTemplates}
            />
          )}
          {canTierData && appConfig.application === 'MAIL' && (
            <TaskRow
              title={t("users.tasks.tierData")}
              description={t("users.tasks.desc.tierData")}
              risk="caution"
              command={defaultCommand(tierCommand, TIER_PARAMS)}
              onRun={handleTierData}
            />
          )}
          {canRename && (
            <TaskRow
              title={t("users.tasks.renameUser")}
              description={t("users.tasks.desc.renameUser")}
              risk="caution"
              command={renameUserCommand(username, INITIAL_RENAME_VALUES)}
              onRun={handleRenameUser}
            />
          )}
          {canDeleteAllMailboxes && (
            <TaskRow
              title={t("users.tasks.deleteAllMailboxes")}
              description={t("users.tasks.desc.deleteAllMailboxes")}
              risk="destructive"
              command={deleteAllMailboxesCommand(username)}
              onRun={handleDeleteAllMailboxes}
            />
          )}
          {canDeleteData && (
            <TaskRow
              title={t("users.tasks.deleteData")}
              description={t("users.tasks.desc.deleteData")}
              risk="destructive"
              command={deleteUserDataCommand(username, "")}
              onRun={handleDeleteUserData}
            />
          )}
        </div>
      )}
    </div>
  );
}
