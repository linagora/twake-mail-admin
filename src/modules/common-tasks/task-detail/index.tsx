import { useFetchData } from "@/hooks/use-fetch-data";
import { useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import { cancelTask, getTaskDetail } from "../api-client";
import { Button } from "@/components/ui/button";
import { ChevronLeft, CircleStop, RefreshCcw } from "lucide-react";
import { useRunTask } from "@/hooks/use-run-task";
import { ReIndexMode } from "../types";
import { TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tooltip } from "@radix-ui/react-tooltip";
import { APIError } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";

export default function TaskDetail() {
  const { id } = useParams();
  let navigate = useNavigate();
  const { toast } = useToast();

  const fetchTaskDetail = useCallback(
    () => getTaskDetail(id!),
    [id]
  );

  const {
    data: taskDetail,
    isLoading,
    error,
  } = useFetchData(fetchTaskDetail);

  const runTask = useRunTask();

  const backToCommonTask = () => {
    navigate('/common-tasks');
  }

  const handleCancelTask = async () => {
    try {
      await cancelTask(id!);
    } catch (error) {
      toast({
        title: "Run Task Error",
        description: (error as APIError)?.response?.data?.message,
      });
    }
  }

  const redoTask = async () => {
    if (!taskDetail) {
      return;
    }

    try {
      const { type, additionalInformation } = taskDetail;

      let mode;
      if (additionalInformation?.runningOptions?.mode === 'FIX_OUTDATED') {
        mode = ReIndexMode.FIX_OUTDATED;
      } else if (additionalInformation?.runningOptions?.mode === 'REBUILD_ALL') {
        mode = ReIndexMode.REBUILD_ALL;
      }
  
      const taskId = await runTask(type, mode);
      navigate(`/task/${taskId}`);
    } catch (error) {
      toast({
        title: "Run Task Error",
        description: (error as APIError)?.response?.data?.message,
      });
    }
  }

  const formatDateTime = (dateTime: string) => {
    const dateTimeValue = new Date(dateTime);
    return `${dateTimeValue.toLocaleDateString()} ${dateTimeValue.toLocaleTimeString()}`;
  }

  return (
    <div className="p-4 relative">
      <div className="flex items-center mb-4">
        <Button className="hover:bg-gray-300" variant="ghost" size="icon" onClick={backToCommonTask}>
          <ChevronLeft />
        </Button>
        <p>Task <u>{id}</u></p>

        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button className="hover:bg-gray-300 mx-3" variant="ghost" size="icon" onClick={redoTask}>
                <RefreshCcw />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Redo task
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <TooltipProvider>
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
        </TooltipProvider>
      </div>

      {isLoading && <p>Loading task detail...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}

      {
        taskDetail && (
          <>
            <p>Type: {taskDetail.type}</p>
            {taskDetail?.additionalInformation?.runningOptions?.mode && (
              <p>Mode: {taskDetail?.additionalInformation?.runningOptions?.mode}</p>
            )}
            <p>Status: {taskDetail.status}</p>
            <p>StartedDate: {formatDateTime(taskDetail.startedDate)}</p>
            <p>SubmitDate: {formatDateTime(taskDetail.submitDate)}</p>
            <p>CompletedDate: {formatDateTime(taskDetail.completedDate)}</p>
            <p>SubmittedFrom: {taskDetail.submittedFrom}</p>
            <p>ExecutedOn: {taskDetail.executedOn}</p>
            {taskDetail.cancelledFrom && <p>CancelledFrom: {taskDetail.cancelledFrom}</p>}
          </>
        )
      }
    </div>
  );
}
