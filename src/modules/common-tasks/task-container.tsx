import { Link } from "react-router";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { TaskProps } from "./types";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useRunTask } from "@/hooks/use-run-task";
import { useConfirm } from "@/hooks/use-confirm";
import { useToast } from "@/hooks/use-toast";
import ConfirmTaskContent from "./components/confirm-task-content";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { useIsAllowed } from "@/lib/proxy-resolver-context";

export default function TaskContainer({ nameKey, taskKey, mode, command, doc, params, allowanceCheck, danger }: TaskProps) {
  const { t } = useTranslation();
  const name = t(nameKey);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { toast } = useToast();
  const confirm = useConfirm();
  const runTask = useRunTask();
  const isAllowed = useIsAllowed(allowanceCheck?.verb ?? "POST", allowanceCheck?.pattern ?? "");

  if (allowanceCheck && !isAllowed) return null;

  const handleRunTask = async () => {
    try {
      const additionParams: any = {};
      const result = await confirm({
        header: t("common.run"),
        message: (
          <ConfirmTaskContent
            message={<p>{t("commonTasks.runConfirm", { name })}</p>}
            command={command}
            params={params}
            getParamValues={(key, value) => {
additionParams[key] = value
            }}
          />
        ),
      });
      if (!result) {
        return;
      }

      setIsLoading(true);
      const taskId = await runTask(taskKey, mode, additionParams);
      toast({
        title: t("common.taskRunning"),
        description: <p><Link className="text-blue-500 hover:underline" to={`/task/${taskId}`}>{t("common.taskLink", { taskId })}</Link></p>,
      });
    } catch (error) {
      toast({
        title: t("common.run"),
        description: <ErrorDisplayer error={error} />,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <div className="flex justify-between items-center gap-4">
        <p>{name} <a className="text-blue-500 hover:underline" href={doc} target="_blank">(doc)</a></p>
        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button className={`${danger ? "bg-red-500 hover:bg-red-600" : "bg-green-400 hover:bg-green-500"} rounded-sm`} onClick={handleRunTask}>
                {isLoading && <Loader2 className="animate-spin" />}
                {t("common.run")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {command}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </>
  );
}
