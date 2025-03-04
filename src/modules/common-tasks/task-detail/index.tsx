import { useFetchData } from "@/hooks/use-fetch-data";
import { useCallback } from "react";
import { useParams } from "react-router";
import { cancelTask, getTaskDetail } from "../api-client";
import { Button } from "@/components/ui/button";
import { CircleStop, RefreshCcw } from "lucide-react";
import { TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tooltip } from "@radix-ui/react-tooltip";
import { useToast } from "@/hooks/use-toast";
import { TaskStatus } from "../types";
import Header from "@/components/custom/header";
import ErrorDisplayer from "@/components/custom/error-displayer";

export default function TaskDetail() {
  const { id } = useParams();
  const { toast } = useToast();

  const fetchTaskDetail = useCallback(
    () => getTaskDetail(id!),
    [id]
  );

  const {
    data: taskDetail,
    isLoading,
    error,
    refresh,
  } = useFetchData(fetchTaskDetail);

  const handleCancelTask = async () => {
    try {
      await cancelTask(id!);
    } catch (error) {
      toast({
        title: "Error Canceling Task",
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
          docuUrl="https://james.staged.apache.org/james-project/3.9.0/servers/distributed/operate/webadmin.html#_getting_a_task_details"
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
              Refresh task
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
              Cancel task
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>}
      </div>

      {isLoading && <p>Loading task detail...</p>}
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
