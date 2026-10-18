import { useCallback } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";

// One toast for every task the console creates: the task has only been
// scheduled at that point, so the default title does not claim it ran.
// A caller may name what was scheduled ("Upgrade scheduled") with `title`.
export function useTaskCreatedToast() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useCallback((taskId: string, title?: string) => toast({
    title: title ?? t("common.taskCreated"),
    description: (
      <p>
        <Link className="text-blue-500 hover:underline" to={`/task/${taskId}`}>
          {t("common.taskLink", { taskId })}
        </Link>
      </p>
    ),
  }), [t, toast]);
}
