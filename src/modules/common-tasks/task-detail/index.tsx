import { useFetchData } from "@/hooks/use-fetch-data";
import { useCallback } from "react";
import { useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { getTaskDetail } from "../api-client";
import { useDomain } from "@/modules/domain-admin/domain-context";
import { Button } from "@/components/ui/button";
import { CircleStop, Loader2, RefreshCcw } from "lucide-react";
import { TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tooltip } from "@radix-ui/react-tooltip";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { TaskDetailResponse, TaskStatus } from "../types";
import { cancelAndReport, cancelConfirmMessage, isRunning, TaskDetails, TaskSummary, taskHeading } from "@/modules/tasks/task-summary";
import { TASK_AUTO_REFRESH_MS, useAutoRefresh } from "@/modules/tasks/use-auto-refresh";
import Header from "@/components/custom/header";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";

// Only a task that is still waiting or running can be cancelled.
const CANCELLABLE_STATUSES: ReadonlySet<TaskStatus> = new Set([TaskStatus.WAITING, TaskStatus.IN_PROGRESS]);

export default function TaskDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const breadcrumbs = useBreadcrumbs();
  const { toast } = useToast();
  const confirm = useConfirm();
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
  } = useFetchData<TaskDetailResponse>(fetchTaskDetail);

  // Follows a waiting or running task by itself; no request once it completed, failed or was
  // cancelled, nor while the browser tab is hidden
  const running = !!taskDetail && isRunning(taskDetail.status);
  useAutoRefresh(running, refresh, TASK_AUTO_REFRESH_MS);

  // Same confirmation and feedback as the Tasks list
  const handleCancelTask = async () => {
    const confirmed = await confirm({
      header: t("tasks.cancelTitle"),
      message: taskDetail ? cancelConfirmMessage(t, taskDetail) : t("common.taskLink", { taskId: id }),
      confirmLabel: t("tasks.cancelButton"),
      cancelLabel: t("tasks.keepRunning"),
      destructive: true,
    });
    if (!confirmed) return;
    try {
      toast({ title: await cancelAndReport(t, id!, domain) });
      await refresh();
    } catch (error) {
      toast({
        title: t("tasks.errorCancelling"),
        description: <ErrorDisplayer error={error} />,
      });
    }
  }

  return (
    <div className="p-4 relative">
      <div className="flex items-center mb-4">
        <Header
          headerTitle={taskDetail ? taskHeading(t, taskDetail) : t("common.taskLink", { taskId: id })}
          headerSubTitle={taskDetail ? t("common.taskLink", { taskId: id }) : t("tasks.detailKind")}
          docuUrl="https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_getting_a_task_details"
          breadcrumb={breadcrumbs.tasks()}
        />

        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button className="hover:bg-gray-300 mx-3" variant="ghost" size="icon" onClick={refresh} aria-label={t("tasks.refresh")}>
                <RefreshCcw />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t("tasks.refresh")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        {taskDetail && CANCELLABLE_STATUSES.has(taskDetail.status) && <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button className="text-red-500 hover:bg-gray-300" variant="ghost" size="icon" onClick={handleCancelTask} aria-label={t("tasks.cancelButton")}>
                <CircleStop />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t("tasks.cancelButton")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>}
      </div>

      {/* The previous state stays on screen while it is read again */}
      {isLoading && !taskDetail && <p>{t("common.loading")}</p>}
      {error && <p className="text-red-500">{t("common.errorPrefix", { message: error })}</p>}

      {taskDetail && (
        <div className="space-y-4 max-w-3xl">
          {/* The status itself is the first line of the summary */}
          {running && (
            <p role="status" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
              {t("tasks.autoRefresh")}
            </p>
          )}
          <TaskSummary task={taskDetail} />
          <TaskDetails task={taskDetail} raw={taskDetail} />
        </div>
      )}
    </div>
  );
}
