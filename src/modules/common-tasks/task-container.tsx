import { Link } from "react-router";
import { Loader2 } from "lucide-react"
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

export default function TaskContainer({ name, taskKey, mode, command, doc, params, allowanceCheck }: TaskProps) {
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
        header: 'Run Task',
        message: (
          <ConfirmTaskContent
            message={<p>Do you want to run task <b>{name}</b>?</p>}
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
        title: "Task is running",
        description: <p>Task <Link className="text-blue-500 hover:underline" to={`/task/${taskId}`}>{taskId}</Link></p>,
      });
    } catch (error) {
      toast({
        title: "Error running task",
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
              <Button className="bg-green-400 hover:bg-green-500 rounded-sm" onClick={handleRunTask}>
                {isLoading && <Loader2 className="animate-spin" />}
                Run
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
