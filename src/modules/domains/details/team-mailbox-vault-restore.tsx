import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/hooks/use-confirm";
import { useTaskCreatedToast } from "@/hooks/use-task-created-toast";
import ConfirmTaskContent from "@/modules/common-tasks/components/confirm-task-content";
import { taskTypeLabel } from "@/modules/tasks/task-summary";
import { restoreTeamMailboxDeletedMessages } from "../api-client";
import { TEAM_MAILBOX_RESTORE_TASK_TYPE, teamMailboxRestoreCommand } from "./team-mailbox-vault-commands";

interface Props {
  domain: string;
  mailbox: string;
}

/**
 * Restores all the deleted messages of a team mailbox into its restore folder. WebAdmin takes no
 * criteria for a team mailbox: the operator cannot pick the messages, the dialog says so.
 */
export default function TeamMailboxVaultRestore({ domain, mailbox }: Props) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const toastTaskCreated = useTaskCreatedToast();
  const address = `${mailbox}@${domain}`;

  // A refusal (400, 404) shows in the dialog, which stays open
  const handleRestoreAll = () =>
    confirm({
      header: t("domains.teamMailbox.vaultRestore.title"),
      confirmLabel: t("domains.teamMailbox.vaultRestore.confirm"),
      message: (
        <ConfirmTaskContent
          message={<p>{t("domains.teamMailbox.vaultRestore.description", { address })}</p>}
          command={teamMailboxRestoreCommand(domain, mailbox)}
        />
      ),
      action: async () => {
        const { taskId } = await restoreTeamMailboxDeletedMessages(domain, mailbox);
        toastTaskCreated(taskId, t("users.deletedVault.restoreStarted"), taskTypeLabel(t, TEAM_MAILBOX_RESTORE_TASK_TYPE));
      },
    });

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{t("domains.teamMailbox.vaultRestore.hint")}</p>
      <Button
        size="sm"
        variant="outline"
        onClick={handleRestoreAll}
        className="flex items-center gap-2 text-green-700 border-green-600 hover:bg-green-50"
      >
        <RotateCcw className="w-4 h-4" />
        {t("domains.teamMailbox.vaultRestore.button")}
      </Button>
    </div>
  );
}
