import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { TaskProps } from "./types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useRunTask } from "@/hooks/use-run-task";
import { useConfirm } from "@/hooks/use-confirm";
import { useToast } from "@/hooks/use-toast";
import ConfirmTaskContent from "./components/confirm-task-content";
import { useIsAllowed } from "@/lib/proxy-resolver-context";

export default function TaskContainer({ nameKey, taskKey, mode, command, doc, params, allowanceCheck, danger }: TaskProps) {
  const { t } = useTranslation();
  const name = t(nameKey);
  const { toast } = useToast();
  const confirm = useConfirm();
  const runTask = useRunTask();
  const isAllowed = useIsAllowed(allowanceCheck?.verb ?? "POST", allowanceCheck?.pattern ?? "");

  if (allowanceCheck && !isAllowed) return null;

  const handleRunTask = async () => {
    const additionParams: any = {};
    await confirm({
      header: t("common.run"),
      message: (
        <ConfirmTaskContent
          message={<p>{t("commonTasks.runConfirm", { name })}</p>}
          command={command}
          params={params}
          getParamValues={(key, value) => {
            additionParams[key] = value;
          }}
        />
      ),
      action: async () => {
        const taskId = await runTask(taskKey, mode, additionParams);
        toast({
          title: t("common.taskRunning"),
          description: <p><Link className="text-blue-500 hover:underline" to={`/task/${taskId}`}>{t("common.taskLink", { taskId })}</Link></p>,
        });
      },
    });
  };

  return (
    <>
      <div className="flex justify-between items-center gap-4">
        <p>{name}{doc && <> <a className="text-blue-500 hover:underline" href={doc} target="_blank">(doc)</a></>}</p>
        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button className={`${danger ? "bg-red-500 hover:bg-red-600" : "bg-green-400 hover:bg-green-500"} rounded-sm`} onClick={handleRunTask}>
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
