import { useFetchData } from "@/hooks/use-fetch-data";
import { useCallback } from "react";
import { useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { cancelTask, getTaskDetail } from "../api-client";
import { useDomain } from "@/modules/domain-admin/domain-context";
import { Button } from "@/components/ui/button";
import { CircleStop, RefreshCcw } from "lucide-react";
import { TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tooltip } from "@radix-ui/react-tooltip";
import { useToast } from "@/hooks/use-toast";
import { TaskStatus } from "../types";
import Header from "@/components/custom/header";
import ErrorDisplayer from "@/components/custom/error-displayer";

export default function TaskDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { toast } = useToast();
  const domain = useDomain() || undefined;

  const fetchTaskDetail = useCallback(
    () => getTaskDetail(id!, domain),
    [id, domain]
  );

  const {
    data: taskDetail,
    isLoading,
    error,
    refresh,
  } = useFetchData(fetchTaskDetail);

  const handleCancelTask = async () => {
    try {
      await cancelTask(id!, domain);
      await refresh();
    } catch (error) {
      toast({
        title: t("tasks.errorCancelling"),
        description: <ErrorDisplayer error={error} />,
      });
    }
  }

  const formatDateTime = (dateTime: string) => {
    if (!dateTime) {
      return null;
    }
    const dateTimeValue = new Date(dateTime);
    return `${dateTimeValue.toLocaleDateString()} ${dateTimeValue.toLocaleTimeString()}`;
  }

  return (
    <div className="p-4 relative">
      <div className="flex items-center mb-4">
        <Header
          headerSubTitle={<span>Task <u>{id}</u></span>}
          docuUrl="https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_getting_a_task_details"
          enableBackBtn={true}
        />

        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button className="hover:bg-gray-300 mx-3" variant="ghost" size="icon" onClick={refresh}>
                <RefreshCcw />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t("tasks.refresh")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        {taskDetail?.status !== TaskStatus.COMPLETED && <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button className="text-red-500 hover:bg-gray-300" variant="ghost" size="icon" onClick={handleCancelTask}>
                <CircleStop />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t("tasks.cancelButton")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>}
      </div>

      {isLoading && <p>{t("common.loading")}</p>}
      {error && <p className="text-red-500">Error: {error}</p>}

      {
        taskDetail && (
          <pre>{
            JSON.stringify({
              ...taskDetail,
              submitDate: formatDateTime(taskDetail.submitDate),
              completedDate: formatDateTime(taskDetail.completedDate),
              startedDate: formatDateTime(taskDetail.startedDate),
            }, null, 2)
          }</pre>
        )
      }
    </div>
  );
}
