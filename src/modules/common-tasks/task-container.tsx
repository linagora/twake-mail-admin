import { useTranslation } from "react-i18next";
import { TaskKey, TaskProps, taskDescriptionKey } from "./types";
import ArchivalNotice from "./components/archival-notice";
import TaskRow from "@/components/custom/task-row";
import { useRunTask } from "@/hooks/use-run-task";
import { useConfirm } from "@/hooks/use-confirm";
import { useTaskCreatedToast } from "@/hooks/use-task-created-toast";
import ConfirmTaskContent from "./components/confirm-task-content";
import { defaultCommand } from "./components/command-preview";
import { useIsAllowed } from "@/lib/proxy-resolver-context";

const isNotFound = (error: unknown) => (error as { response?: { status?: number } })?.response?.status === 404;

export default function TaskContainer({ nameKey, taskKey, mode, command, doc, params, allowanceCheck, risk = "safe", consequenceKey, typeToConfirmKey, unavailableKey }: TaskProps) {
  const { t } = useTranslation();
  const name = t(nameKey);
  const toastTaskCreated = useTaskCreatedToast();
  const confirm = useConfirm();
  const runTask = useRunTask();
  const isAllowed = useIsAllowed(allowanceCheck?.verb ?? "POST", allowanceCheck?.pattern ?? "");

  if (allowanceCheck && !isAllowed) return null;

  const handleRunTask = async () => {
    const additionParams: any = {};
    await confirm({
      header: name,
      consequence: consequenceKey && t(consequenceKey),
      ...(risk === "destructive" && {
        destructive: true,
        confirmLabel: t("confirm.deleteData"),
        typeToConfirm: typeToConfirmKey && t(typeToConfirmKey),
      }),
      describeError: (error) => (unavailableKey && isNotFound(error) ? t(unavailableKey) : null),
      message: (
        <ConfirmTaskContent
          message={<p>{t(taskDescriptionKey(nameKey))}</p>}
          command={command}
          params={params}
          notice={taskKey === TaskKey.CALENDAR_EVENT_ARCHIVAL
            ? (values) => <ArchivalNotice values={values} message={t("commonTasks.archiveAllWarning")} />
            : undefined}
          getParamValues={(key, value) => {
            additionParams[key] = value;
          }}
        />
      ),
      action: async () => {
        const taskId = await runTask(taskKey, mode, additionParams);
        toastTaskCreated(taskId, undefined, name);
      },
    });
  };

  return (
    <TaskRow
      title={name}
      description={t(taskDescriptionKey(nameKey))}
      doc={doc}
      risk={risk}
      command={defaultCommand(command, params)}
      onRun={handleRunTask}
    />
  );
}
