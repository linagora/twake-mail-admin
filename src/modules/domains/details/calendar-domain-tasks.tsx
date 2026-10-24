import { deleteAllUsersData, republishDomainContacts, syncDomainMembers } from "../api-client";
import { useTaskCreatedToast } from "@/hooks/use-task-created-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ConfirmTaskContent from "@/modules/common-tasks/components/confirm-task-content";
import { TaskParam } from "@/modules/common-tasks/types";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useTranslation } from "react-i18next";
import TaskRow from "@/components/custom/task-row";
import { SectionToggle, useSectionOpen } from "@/components/custom/collapsible-section";
import { taskTypeLabel } from "@/modules/tasks/task-summary";

const REPUBLISH_CONTACTS_PARAMS: TaskParam[] = [
  { key: "contactsPerSecond", defaultValue: "100", type: "input" },
  { key: "scope", defaultValue: "", type: "select", values: ["", "domain", "user"] },
];

interface Props {
  domain: string;
  defaultOpen?: boolean;
}

export default function CalendarDomainTasks({ domain, defaultOpen = false }: Props) {
  const { t } = useTranslation();
  const toastTaskCreated = useTaskCreatedToast();
  const confirm = useConfirm();
  const canDeleteData = useIsAllowed("POST", "/domains/{domain}?action=deleteData");
  const canSyncMembers = useIsAllowed("POST", "/addressbook/domain-members/{domain}");
  const canRepublishContacts = useIsAllowed("POST", "/domains/{domain}/contacts?action=republish");
  const [open, setOpen, openContentId] = useSectionOpen("tasks", defaultOpen);

  // The request is sent from the dialog, which stays open and shows a refusal in it
  const handleDeleteAllUsersData = () => confirm({
    header: t("domains.tasks.deleteAllDataTitle"),
    destructive: true,
    confirmLabel: t("confirm.deleteData"),
    typeToConfirm: domain,
    typeToConfirmIgnoreCase: true,
    message: t("domains.tasks.deleteAllDataConfirm", { domain }),
    action: async () => {
      const { taskId } = await deleteAllUsersData(domain);
      toastTaskCreated(taskId, undefined, taskTypeLabel(t, "DeleteUsersDataOfDomainTask"));
    },
  });

  const handleSyncDomainMembers = () => confirm({
    header: t("domains.calendarTasks.syncTitle"),
    message: t("domains.calendarTasks.syncConfirm", { domain }),
    action: async () => {
      const { taskId } = await syncDomainMembers(domain);
      toastTaskCreated(taskId, undefined, taskTypeLabel(t, "sync-domain-members-contacts-ldap-to-dav"));
    },
  });

  const handleRepublishContacts = async () => {
    const params: { contactsPerSecond?: string; scope?: string } = {};
    await confirm({
      header: t("domains.calendarTasks.republishContactsTitle"),
      message: (
        <ConfirmTaskContent
          message={<p>{t("domains.calendarTasks.republishContactsConfirm", { domain })}</p>}
          command={`curl -XPOST /domains/${domain}/contacts?action=republish`}
          params={REPUBLISH_CONTACTS_PARAMS}
          getParamValues={(key, value) => {
            params[key as keyof typeof params] = value as string;
          }}
        />
      ),
      action: async () => {
        const { taskId } = await republishDomainContacts(domain, params);
        toastTaskCreated(taskId, undefined, taskTypeLabel(t, "republish-common-contacts"));
      },
    });
  };

  return (
    <div className="mt-6">
      <SectionToggle open={open} onToggle={() => setOpen(!open)} controls={openContentId}>
        {t("domains.calendarTasks.title")}
      </SectionToggle>

      {open && (canSyncMembers || canRepublishContacts || canDeleteData) && (
        <div id={openContentId} className="mt-2 space-y-2">
          {canSyncMembers && (
            <TaskRow
              title={t("domains.calendarTasks.syncButton")}
              description={t("domains.calendarTasks.syncDesc")}
              command={`curl -XPOST /addressbook/domain-members/${domain}?task=sync`}
              onRun={handleSyncDomainMembers}
            />
          )}
          {canRepublishContacts && (
            <TaskRow
              title={t("domains.calendarTasks.republishContactsButton")}
              description={t("domains.calendarTasks.republishContactsDesc")}
              command={`curl -XPOST /domains/${domain}/contacts?action=republish`}
              onRun={handleRepublishContacts}
            />
          )}
          {canDeleteData && (
            <TaskRow
              title={t("domains.tasks.deleteAllData")}
              description={t("domains.tasks.deleteAllDataDesc")}
              risk="destructive"
              command={`curl -XPOST /domains/${domain}?action=deleteData`}
              onRun={handleDeleteAllUsersData}
            />
          )}
        </div>
      )}
    </div>
  );
}
