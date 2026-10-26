import { Link } from "react-router";
import axios from "axios";
import i18n from "i18next";
import { toast } from "@/hooks/use-toast";
import { awaitTask } from "@/modules/common-tasks/api-client";
import { TaskDetailResponse, TaskStatus } from "@/modules/common-tasks/types";
import { endDate, formatDuration, isRunning, statusLabel, taskName } from "@/modules/tasks/task-summary";

// Stops following a task after about two hours of 25 s rounds; its page still tells how it ended
const MAX_ROUNDS = 300;

// The round ran out of time without an answer: WebAdmin answers 408, or the request gave up first
const isRoundTimeout = (err: unknown) =>
  axios.isAxiosError(err) && (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT" || err.response?.status === 408);

function duration(task: TaskDetailResponse): string | null {
  const ended = endDate(task);
  if (!task.startedDate || !ended) return null;
  const ms = new Date(ended).getTime() - new Date(task.startedDate).getTime();
  return Number.isFinite(ms) && ms >= 0 ? formatDuration(i18n.t.bind(i18n), ms) : null;
}

/** Tells, on whatever page the operator is on, how a task they started ended. */
export function showTaskOutcome(task: TaskDetailResponse, name?: string) {
  const t = i18n.t.bind(i18n);
  const took = duration(task);
  const failed = task.status === TaskStatus.FAILED;
  toast({
    title: t(failed ? "tasks.outcome.failed" : task.status === TaskStatus.COMPLETED ? "tasks.outcome.completed" : "tasks.outcome.ended"),
    variant: failed ? "destructive" : undefined,
    // A failure stays until it is read
    duration: failed ? Infinity : 15_000,
    description: (
      <p>
        {name ?? taskName(t, task)} — {statusLabel(t, task.status)}
        {took && <> · {t("tasks.outcome.took", { duration: took })}</>}
        {" · "}
        <Link className="text-blue-500 hover:underline" to={`/task/${task.taskId}`} title={task.taskId}>
          {t("tasks.outcome.details")}
        </Link>
      </p>
    ),
  });
}

/**
 * Follows a task the operator started until it ends, through WebAdmin's await route, then
 * tells its outcome. Best effort: a refused or failing request stops following it silently.
 */
export async function followTask(taskId: string, name: string | undefined, domain: string | undefined) {
  for (let round = 0; round < MAX_ROUNDS; round++) {
    let task: TaskDetailResponse;
    try {
      task = await awaitTask(taskId, domain);
    } catch (err) {
      if (isRoundTimeout(err)) continue;
      return;
    }
    if (!isRunning(task.status)) {
      showTaskOutcome(task, name);
      return;
    }
  }
}
