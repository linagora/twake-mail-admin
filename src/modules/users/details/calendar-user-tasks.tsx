import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { deleteUserData, archiveUserCalendarEvents } from "../api-client";
import DeleteUserDataForm from "../components/delete-user-data-form";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
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

interface Props {
  username: string;
}

export default function CalendarUserTasks({ username }: Props) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const canDeleteData = useIsAllowed("POST", "/users/{username}");
  const canArchiveCalendar = useIsAllowed("POST", "/calendars/{username}");
  const [open, setOpen] = useState(false);
  const [deleteUserDataLoading, setDeleteUserDataLoading] = useState(false);
  const [archiveCalendarLoading, setArchiveCalendarLoading] = useState(false);

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
      toast({ title: "Error deleting user data", description: <ErrorDisplayer error={err} /> });
    } finally {
      setDeleteUserDataLoading(false);
    }
  };

  const handleArchiveCalendarEvents = async () => {
    try {
      const additionalParams: any = {};
      const result = await confirm({
        header: "Archive Calendar Events",
        message: (
          <ConfirmTaskContent
            message={<p>Archive calendar events for <strong>{username}</strong>.</p>}
            command={`curl -XPOST /calendars/${username}?task=archive`}
            params={ARCHIVE_CALENDAR_PARAMS}
            getParamValues={(key, value) => {
              additionalParams[key] = value;
            }}
          />
        ),
      });
      if (!result) return;

      setArchiveCalendarLoading(true);
      const data = await archiveUserCalendarEvents(username, additionalParams);
      toast({
        title: "Task is running",
        description: <p>Task <a className="text-blue-500 hover:underline" href={`/task/${data.taskId}`}>{data.taskId}</a></p>,
      });
    } catch (err) {
      toast({ title: "Error running archive task", description: <ErrorDisplayer error={err} /> });
    } finally {
      setArchiveCalendarLoading(false);
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
          {canArchiveCalendar && (
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2">
              <p>Archive calendar events</p>
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button className="bg-green-600 hover:bg-green-700 rounded-sm" onClick={handleArchiveCalendarEvents}>
                      {archiveCalendarLoading && <Loader2 className="animate-spin" />}
                      Run
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    curl -XPOST /calendars/{username}?task=archive
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
