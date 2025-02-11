import { Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button";
import { TaskProps } from "./types";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useRunTask } from "@/hooks/use-run-task";
import { useConfirm } from "@/hooks/use-confirm";
import { useToast } from "@/hooks/use-toast";
import { APIError } from "@/lib/apiClient";

export default function TaskContainer({ name, taskKey, mode, command, doc }: TaskProps) {
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const { toast } = useToast();
  const confirm = useConfirm();
  const runTask = useRunTask();

  const handleRunTask = async () => {
    try {
      const result = await confirm({
        header: 'Run Task',
        message: `Do you want to run task ${name} with comman ${command}`,
      });
      if (!result) {
        return;
      }

      setIsLoading(true);
      const taskId = await runTask(taskKey, mode);
      toast({
        title: "Run Task Successfully",
        description: <p>Task <a className="text-blue-500 hover:underline" href={`/task/${taskId}`}>{taskId}</a></p>,
      });
    } catch (error) {
      toast({
        title: "Run Task Error",
        description: (error as APIError)?.response?.data?.message,
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
              <Button className="bg-green-600 hover:bg-green-700 rounded-sm" onClick={handleRunTask}>
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
