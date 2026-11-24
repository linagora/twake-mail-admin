import { useCallback } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useDomain } from "@/modules/domain-admin/domain-context";
import { TaskDetailResponse } from "@/modules/common-tasks/types";
import { followTask } from "./task-outcome";

// One toast for every task the console creates: the task has only been
// scheduled at that point, so the default title does not claim it ran.
// A caller may name what was scheduled ("Upgrade scheduled") with `title`, and names the task
// as the button that started it read (`name`), so that the operator recognises it.
// `onEnded` lets the caller refresh what the task changed, once it is known to have ended.
export function useTaskCreatedToast() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const domain = useDomain() || undefined;
  const canAwaitGlobal = useIsAllowed("GET", "/tasks/{id}/await");
  const canAwaitInDomain = useIsAllowed("GET", "/domains/{domain}/tasks/{id}/await");
  const canAwait = domain ? canAwaitInDomain : canAwaitGlobal;

  return useCallback((taskId: string, title?: string, name?: string, onEnded?: (task: TaskDetailResponse) => void) => {
    // Its outcome is told later, on whatever page the operator then is
    if (canAwait) {
      void followTask(taskId, name, domain).then((task) => {
        if (task) onEnded?.(task);
      });
    }
    toast({
    title: title ?? t("common.taskCreated"),
    description: (
      <p>
        <Link className="text-blue-500 hover:underline" to={`/task/${taskId}`} title={taskId}>
          {name
            ? t("common.taskCreatedNamed", { name, taskId: taskId.slice(0, 8) })
            : t("common.taskLink", { taskId })}
        </Link>
      </p>
    ),
    });
  }, [t, toast, canAwait, domain]);
}
