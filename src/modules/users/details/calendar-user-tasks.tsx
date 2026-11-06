import { useTranslation } from "react-i18next";
import TaskRow from "@/components/custom/task-row";
import { deleteUserData, archiveUserCalendarEvents, republishUserContacts } from "../api-client";
import DeleteUserDataForm from "../components/delete-user-data-form";
import { useTaskCreatedToast } from "@/hooks/use-task-created-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { deleteUserDataCommand } from "./user-task-commands";
import ConfirmTaskContent from "@/modules/common-tasks/components/confirm-task-content";
import FormTaskContent from "@/modules/common-tasks/components/form-task-content";
import ArchivalNotice from "@/modules/common-tasks/components/archival-notice";
import { TaskParam } from "@/modules/common-tasks/types";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { SectionToggle, useSectionFacts, useSectionOpen } from "@/components/custom/collapsible-section";
import { taskTypeLabel } from "@/modules/tasks/task-summary";

const ARCHIVE_CALENDAR_PARAMS: TaskParam[] = [
  { key: "createdBefore", defaultValue: "", type: "duration" },
  { key: "lastModifiedBefore", defaultValue: "", type: "duration" },
  { key: "masterDtStartBefore", defaultValue: "", type: "duration" },
  { key: "isRejected", defaultValue: "", type: "select", values: ["", "true", "false"] },
  { key: "isNotRecurring", defaultValue: "", type: "select", values: ["", "true", "false"] },
  { key: "eventsPerSecond", defaultValue: "100", type: "input" },
];

const REPUBLISH_CONTACTS_PARAMS: TaskParam[] = [
  { key: "contactsPerSecond", defaultValue: "100", type: "input" },
];

interface Props {
  username: string;
}

// What the page counted of the user, for the summary of what a data deletion loses; unknown until loaded
const countText = (count: unknown) => (typeof count === "number" ? String(count) : "—");

export default function CalendarUserTasks({ username }: Props) {
  const facts = useSectionFacts();
  const { t } = useTranslation();
  const toastTaskCreated = useTaskCreatedToast();
  const confirm = useConfirm();
  const canDeleteData = useIsAllowed("POST", "/users/{username}?action=deleteData");
  const canArchiveCalendar = useIsAllowed("POST", "/calendars/{username}");
  const canRepublishContacts = useIsAllowed("POST", "/users/{username}/contacts?action=republish");
  const [open, setOpen, openContentId] = useSectionOpen("tasks");


  const handleDeleteUserData = async () => {
    let currentFromStep = "";

    await confirm({
      header: t("users.tasks.deleteDataTitle", { username }),
      destructive: true,
      confirmLabel: t("confirm.deleteUserData"),
      consequence: (
        <>
          <ul className="list-disc ml-4">
            <li>{t("users.tasks.deleteDataCounts.calendars", { count: countText(facts["calendars"]) })}</li>
            <li>{t("users.tasks.deleteDataCounts.addressBooks", { count: countText(facts["address-books"]) })}</li>
            <li>{t("users.tasks.deleteDataCounts.bookingLinks", { count: countText(facts["booking-links"]) })}</li>
          </ul>
          <p className="mt-2">{t("confirm.consequence.deleteCalendarUserData")}</p>
        </>
      ),
      typeToConfirm: username,
      typeToConfirmIgnoreCase: true,
      message: (
        <FormTaskContent
          initialValues={currentFromStep}
          renderForm={(onChange) => (
            <DeleteUserDataForm
              onChange={onChange}
              fromStepPlaceholderKey="deleteUserDataForm.calendarFromStepPlaceholder"
            />
          )}
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

  const handleArchiveCalendarEvents = async () => {
    const additionalParams: Parameters<typeof archiveUserCalendarEvents>[1] = {};
    await confirm({
      header: t("users.calendarTasks.archiveTitle"),
      message: (
        <ConfirmTaskContent
          message={<p>{t("users.calendarTasks.archiveDesc", { username })}</p>}
          command={`curl -XPOST /calendars/${username}?task=archive`}
          params={ARCHIVE_CALENDAR_PARAMS}
          notice={(values) => <ArchivalNotice values={values} message={t("users.calendarTasks.archiveAllWarning", { username })} />}
          getParamValues={(key, value) => {
            additionalParams[key as keyof typeof additionalParams] = value as string;
          }}
        />
      ),
      action: async () => {
        const data = await archiveUserCalendarEvents(username, additionalParams);
        toastTaskCreated(data.taskId, undefined, taskTypeLabel(t, "calendar-archival"));
      },
    });
  };

  const handleRepublishContacts = async () => {
    const params: { contactsPerSecond?: string } = {};
    await confirm({
      header: t("users.calendarTasks.republishContactsTitle"),
      message: (
        <ConfirmTaskContent
          message={<p>{t("users.calendarTasks.republishContactsDesc", { username })}</p>}
          command={`curl -XPOST /users/${username}/contacts?action=republish`}
          params={REPUBLISH_CONTACTS_PARAMS}
          getParamValues={(key, value) => {
            params[key as keyof typeof params] = value as string;
          }}
        />
      ),
      action: async () => {
        const data = await republishUserContacts(username, params);
        toastTaskCreated(data.taskId, undefined, taskTypeLabel(t, "republish-common-contacts"));
      },
    });
  };

  return (
    <div className="mt-6">
      <SectionToggle open={open} onToggle={() => setOpen(!open)} controls={openContentId}>
        {t("users.calendarTasks.title")}
      </SectionToggle>

      {open && (
        <div id={openContentId} className="mt-2 space-y-2">
          {canRepublishContacts && (
            <TaskRow
              title={t("users.calendarTasks.republishContactsButton")}
              description={t("users.tasks.desc.republishContacts")}
              risk="safe"
              command={`curl -XPOST /users/${username}/contacts?action=republish`}
              onRun={handleRepublishContacts}
            />
          )}
          {canArchiveCalendar && (
            <TaskRow
              title={t("users.calendarTasks.archiveButton")}
              description={t("users.tasks.desc.archive")}
              risk="caution"
              command={`curl -XPOST /calendars/${username}?task=archive`}
              onRun={handleArchiveCalendarEvents}
            />
          )}
          {canDeleteData && (
            <TaskRow
              title={t("users.tasks.deleteData")}
              description={t("users.tasks.desc.calendarDeleteData")}
              risk="destructive"
              command={`curl -XPOST /users/${username}?action=deleteData`}
              onRun={handleDeleteUserData}
            />
          )}
        </div>
      )}
    </div>
  );
}
