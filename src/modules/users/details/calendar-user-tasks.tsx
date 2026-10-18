import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { deleteUserData, archiveUserCalendarEvents, republishUserContacts } from "../api-client";
import DeleteUserDataForm from "../components/delete-user-data-form";
import { useTaskCreatedToast } from "@/hooks/use-task-created-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ConfirmTaskContent from "@/modules/common-tasks/components/confirm-task-content";
import { TaskParam } from "@/modules/common-tasks/types";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsAllowed } from "@/lib/proxy-resolver-context";

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

export default function CalendarUserTasks({ username }: Props) {
  const { t } = useTranslation();
  const toastTaskCreated = useTaskCreatedToast();
  const confirm = useConfirm();
  const canDeleteData = useIsAllowed("POST", "/users/{username}?action=deleteData");
  const canArchiveCalendar = useIsAllowed("POST", "/calendars/{username}");
  const canRepublishContacts = useIsAllowed("POST", "/users/{username}/contacts?action=republish");
  const [open, setOpen] = useState(false);


  const handleDeleteUserData = async () => {
    let currentFromStep = "";

    await confirm({
      header: t("users.tasks.deleteDataTitle"),
      message: (
        <DeleteUserDataForm
          username={username}
          onChange={(value) => { currentFromStep = value; }}
          fromStepPlaceholderKey="deleteUserDataForm.calendarFromStepPlaceholder"
        />
      ),
      action: async () => {
        const data = await deleteUserData(username, currentFromStep || undefined);
        toastTaskCreated(data.taskId);
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
          getParamValues={(key, value) => {
            additionalParams[key as keyof typeof additionalParams] = value as string;
          }}
        />
      ),
      action: async () => {
        const data = await archiveUserCalendarEvents(username, additionalParams);
        toastTaskCreated(data.taskId);
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
        toastTaskCreated(data.taskId);
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
        {t("users.calendarTasks.title")}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {canArchiveCalendar && (
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2">
              <p>{t("users.calendarTasks.archiveButton")}</p>
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button className="bg-green-400 hover:bg-green-500 rounded-sm" onClick={handleArchiveCalendarEvents}>
                      {t("common.run")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    curl -XPOST /calendars/{username}?task=archive
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
          {canRepublishContacts && (
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2">
              <p>{t("users.calendarTasks.republishContactsButton")}</p>
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button className="bg-green-400 hover:bg-green-500 rounded-sm" onClick={handleRepublishContacts}>
                      {t("common.run")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    curl -XPOST /users/{username}/contacts?action=republish
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
