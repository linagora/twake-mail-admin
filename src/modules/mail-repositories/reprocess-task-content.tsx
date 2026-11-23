import { ComponentProps, useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import ConfirmTaskContent from "@/modules/common-tasks/components/confirm-task-content";
import { TaskParam } from "@/modules/common-tasks/types";
import { isUnknownQueue, useMailQueueNames } from "./mail-queues";

const QUEUE_KEY = "queue";

const withQueueSuggestions = (params: TaskParam[] | undefined, queues: string[] | null) =>
  params?.map((param) => (param.key === QUEUE_KEY && queues ? { ...param, suggestions: queues } : param));

function UnknownQueueNotice({ queue }: { queue: string }) {
  const { t } = useTranslation();
  return (
    <div role="status" className="flex gap-2 items-start rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-3 text-sm">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
      <p>{t("mailRepositories.unknownQueue", { queue })}</p>
    </div>
  );
}

/**
 * The parameters of a reprocessing: the queue field suggests the existing mail queues,
 * and warns when the typed one does not exist. Free text when the queues cannot be listed.
 */
export default function ReprocessTaskContent({ params, ...props }: Omit<ComponentProps<typeof ConfirmTaskContent>, "notice">) {
  const queues = useMailQueueNames();
  const shownParams = useMemo(() => withQueueSuggestions(params, queues), [params, queues]);
  const notice = (values: Record<string, string | boolean>) => {
    const queue = String(values[QUEUE_KEY] ?? "");
    return isUnknownQueue(queue, queues) ? <UnknownQueueNotice queue={queue.trim()} /> : null;
  };
  return <ConfirmTaskContent {...props} params={shownParams} notice={notice} />;
}
