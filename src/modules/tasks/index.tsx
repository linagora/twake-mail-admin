import { useCallback, useId, useMemo, useState } from "react";
import { Link } from "react-router";
import { RefreshCcw, CircleStop, Filter } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { listTasks, ListTasksParams } from "./api-client";
import { TaskDetailResponse, TaskStatus } from "@/modules/common-tasks/types";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { useReturnFocus } from "@/hooks/use-return-focus";
import ErrorDisplayer from "@/components/custom/error-displayer";
import Header from "@/components/custom/header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PaginationControls } from "@/components/custom/pagination-controls";
import { cancelAndReport, cancelConfirmMessage, endDate, formatDate, shortTaskId, statusLabel, STATUS_COLORS, TaskDetails, taskTargetInfo, TaskTarget, TaskSummary, taskHeading, taskTypeLabel } from "./task-summary";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

// Shared by the header and every row: the tracks never depend on content, so they stay aligned.
// Below md: index | ID / type (status and dates stacked under it) | action.
const TASK_GRID_COLUMNS =
  "grid-cols-[2rem_minmax(0,1fr)_auto] md:grid-cols-[2rem_minmax(0,3fr)_6rem_minmax(0,2fr)_minmax(0,3fr)_4rem]";

// Stacked phone cards have room to wrap; desktop columns keep a single truncated line
const WRAP_BELOW_MD = "break-words md:truncate";

const STATUS_OPTIONS = [
  "",
  TaskStatus.WAITING,
  TaskStatus.IN_PROGRESS,
  TaskStatus.CANCEL_REQUESTED,
  TaskStatus.COMPLETED,
  TaskStatus.CANCELLED,
  TaskStatus.FAILED,
];

type SortField = "submitDate" | "startedDate" | "completedDate" | "status" | "type";

function startedCompletedText(task: TaskDetailResponse): string {
  const started = formatDate(task.startedDate);
  const ended = endDate(task);
  return ended ? `${started} → ${formatDate(ended)}` : started;
}

const docuUrl = "https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_task_management";

export default function Tasks() {
  const { t } = useTranslation();
  const idPrefix = useId();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canCancel = useIsAllowed("DELETE", "/tasks/{id}");

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [submittedAfter, setSubmittedAfter] = useState("");
  const [submittedBefore, setSubmittedBefore] = useState("");
  const [startedAfter, setStartedAfter] = useState("");
  const [startedBefore, setStartedBefore] = useState("");
  const [completedAfter, setCompletedAfter] = useState("");
  const [completedBefore, setCompletedBefore] = useState("");
  const [failedAfter, setFailedAfter] = useState("");
  const [failedBefore, setFailedBefore] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);

  // Sort
  const [sortField, setSortField] = useState<SortField>("submitDate");
  const [sortAsc, setSortAsc] = useState(false); // default: recent first

  // Detail modal
  const [selectedTask, setSelectedTask] = useState<TaskDetailResponse | null>(null);
  const { rememberFocus, restoreFocus } = useReturnFocus();

  const openTask = (task: TaskDetailResponse) => {
    rememberFocus();
    setSelectedTask(task);
  };

  // The fields only build the request: it is sent when the filters are applied, not on every keystroke
  const buildParams = (): ListTasksParams => {
    const params: ListTasksParams = {};
    if (statusFilter) params.status = statusFilter;
    if (typeFilter.trim()) params.type = typeFilter.trim();
    if (submittedAfter) params.submittedAfter = new Date(submittedAfter).toISOString();
    if (submittedBefore) params.submittedBefore = new Date(submittedBefore).toISOString();
    if (startedAfter) params.startedAfter = new Date(startedAfter).toISOString();
    if (startedBefore) params.startedBefore = new Date(startedBefore).toISOString();
    if (completedAfter) params.completedAfter = new Date(completedAfter).toISOString();
    if (completedBefore) params.completedBefore = new Date(completedBefore).toISOString();
    if (failedAfter) params.failedAfter = new Date(failedAfter).toISOString();
    if (failedBefore) params.failedBefore = new Date(failedBefore).toISOString();
    return params;
  };
  const [appliedParams, setAppliedParams] = useState<ListTasksParams>({});

  // WebAdmin cannot sort: fetch every matching task, then sort and paginate locally
  const fetchTasks = useCallback(() => listTasks(appliedParams), [appliedParams]);
  const { data: tasks, isLoading, error, refresh } = useFetchData<TaskDetailResponse[]>(fetchTasks);

  const sorted = useMemo(() => {
    if (!tasks) return [];
    const copy = [...tasks];
    copy.sort((a, b) => {
      let va: string | null;
      let vb: string | null;
      switch (sortField) {
        case "submitDate": va = a.submitDate; vb = b.submitDate; break;
        case "startedDate": va = a.startedDate; vb = b.startedDate; break;
        case "completedDate": va = endDate(a); vb = endDate(b); break;
        case "status": va = a.status; vb = b.status; break;
        case "type": va = taskTypeLabel(t, a.type); vb = taskTypeLabel(t, b.type); break;
        default: va = a.submitDate; vb = b.submitDate;
      }
      if (!va && !vb) return 0;
      if (!va) return sortAsc ? 1 : -1;
      if (!vb) return sortAsc ? -1 : 1;
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return copy;
  }, [tasks, sortField, sortAsc, t]);

  const pageTasks = useMemo(() => sorted.slice((page - 1) * PAGE_LIMIT, page * PAGE_LIMIT), [sorted, page]);
  const hasMore = sorted.length > page * PAGE_LIMIT;

  const changeSort = (field: SortField, asc: boolean) => {
    setSortField(field);
    setSortAsc(asc);
    setPage(1);
  };

  const handleCancel = async (task: TaskDetailResponse) => {
    const confirmed = await confirm({
      header: t("tasks.cancelTitle"),
      message: cancelConfirmMessage(t, task),
      confirmLabel: t("tasks.cancelButton"),
      cancelLabel: t("tasks.keepRunning"),
      destructive: true,
    });
    if (!confirmed) return;
    try {
      toast({ title: await cancelAndReport(t, task.taskId) });
      await refresh();
    } catch (err) {
      toast({ title: t("tasks.errorCancelling"), description: <ErrorDisplayer error={err} /> });
    }
  };

  // A new params object fetches the list once, even when the filters did not change
  const handleApplyFilters = () => {
    setPage(1);
    setAppliedParams(buildParams());
  };

  const handleResetFilters = () => {
    setStatusFilter("");
    setTypeFilter("");
    setSubmittedAfter("");
    setSubmittedBefore("");
    setStartedAfter("");
    setStartedBefore("");
    setCompletedAfter("");
    setCompletedBefore("");
    setFailedAfter("");
    setFailedBefore("");
    setPage(1);
    setAppliedParams({});
  };

  const labelOf = (status: string) => statusLabel(t, status);

  const SORT_FIELDS: { key: SortField; label: string }[] = [
    { key: "submitDate", label: t("tasks.submitted") },
    { key: "startedDate", label: t("tasks.started") },
    { key: "completedDate", label: t("tasks.completed") },
    { key: "status", label: t("tasks.status") },
    { key: "type", label: t("tasks.type") },
  ];

  return (
    <div className="p-4 w-fit max-w-full">
      <Header headerTitle={t("tasks.title")} headerSubTitle={t("tasks.subtitle")} docuUrl={docuUrl} />

      <div className="mt-4">
        {/* Toolbar: refresh, filter toggle, sort */}
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCcw className="w-4 h-4 mr-1" /> {t("tasks.refresh")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-1" />
            {showFilters ? t("tasks.hideFilters") : t("tasks.filters")}
          </Button>

          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <label htmlFor={`${idPrefix}-sort`} className="text-sm font-medium">{t("tasks.sort")}</label>
            <select
              id={`${idPrefix}-sort`}
              className="border rounded px-2 py-1 text-sm"
              value={sortField}
              onChange={(e) => changeSort(e.target.value as SortField, sortAsc)}
            >
              {SORT_FIELDS.map((f) => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
            <button
              className="border rounded px-2 py-1 text-sm"
              onClick={() => changeSort(sortField, !sortAsc)}
            >
              {sortAsc ? t("tasks.asc") : t("tasks.desc")}
            </button>
          </div>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="p-4 bg-gray-50 rounded-2 mb-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label htmlFor={`${idPrefix}-status`} className="text-xs text-gray-500 font-medium">{t("tasks.status")}</label>
                <select
                  id={`${idPrefix}-status`}
                  className="w-full mt-1 border rounded px-2 py-1.5 text-sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{labelOf(s)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`${idPrefix}-type`} className="text-xs text-gray-500 font-medium">{t("tasks.type")}</label>
                <input
                  id={`${idPrefix}-type`}
                  type="text"
                  className="w-full mt-1 border rounded px-2 py-1.5 text-sm"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  placeholder={t("tasks.typePlaceholder")}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <DateFilter label={t("tasks.submittedAfter")} value={submittedAfter} onChange={setSubmittedAfter} />
              <DateFilter label={t("tasks.submittedBefore")} value={submittedBefore} onChange={setSubmittedBefore} />
              <DateFilter label={t("tasks.startedAfter")} value={startedAfter} onChange={setStartedAfter} />
              <DateFilter label={t("tasks.startedBefore")} value={startedBefore} onChange={setStartedBefore} />
              <DateFilter label={t("tasks.completedAfter")} value={completedAfter} onChange={setCompletedAfter} />
              <DateFilter label={t("tasks.completedBefore")} value={completedBefore} onChange={setCompletedBefore} />
              <DateFilter label={t("tasks.failedAfter")} value={failedAfter} onChange={setFailedAfter} />
              <DateFilter label={t("tasks.failedBefore")} value={failedBefore} onChange={setFailedBefore} />
            </div>

            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleApplyFilters}>{t("tasks.apply")}</Button>
              <Button size="sm" variant="outline" onClick={handleResetFilters}>{t("tasks.reset")}</Button>
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
          </div>
        )}
        {error && <p className="text-red-500 mt-2">{t("common.errorPrefix", { message: error })}</p>}

        {/* Legend */}
        {tasks && tasks.length > 0 && (
          <div
            data-testid="tasks-header"
            className={`hidden md:grid ${TASK_GRID_COLUMNS} gap-2 text-xs font-semibold text-muted-foreground px-3 pb-2 border-b mb-1`}
          >
            <span>#</span>
            <span className="truncate">{t("tasks.idType")}</span>
            <span className="text-center truncate">{t("tasks.status")}</span>
            <span className="truncate">{t("tasks.submitted")}</span>
            <span className="truncate">{t("tasks.startedCompleted")}</span>
            <span className="text-center truncate">{t("tasks.actions")}</span>
          </div>
        )}

        {/* Task rows */}
        {tasks && (
          <div className="space-y-1">
            {pageTasks.map((task, index) => {
              const globalIndex = (page - 1) * PAGE_LIMIT + index + 1;
              const statusClass = STATUS_COLORS[task.status] || "bg-gray-100 text-gray-600";
              return (
                <div
                  key={task.taskId}
                  data-testid="task-row"
                  className={`grid ${TASK_GRID_COLUMNS} gap-x-2 gap-y-1 items-center p-3 bg-gray-50 rounded-2 cursor-pointer hover:bg-gray-100 transition text-sm`}
                  onClick={() => openTask(task)}
                >
                  <span className="text-muted-foreground">{globalIndex}.</span>
                  <div className={`min-w-0 ${WRAP_BELOW_MD}`}>
                    {/* A real button (the row itself holds the cancel button) so the detail opens from the keyboard */}
                    <button
                      type="button"
                      className="text-left rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      onClick={() => openTask(task)}
                    >
                      {taskTypeLabel(t, task.type)}
                    </button>
                    {taskTargetInfo(task) && (
                      // A user target links to its page, without opening the task
                      <span className="block text-xs text-gray-500 break-all" onClick={(e) => e.stopPropagation()}>
                        <TaskTarget task={task} />
                      </span>
                    )}
                    <span className="block font-mono text-xs text-gray-500" title={task.taskId}>
                      {task.type} · {shortTaskId(task.taskId)}
                    </span>
                  </div>
                  {/* Below md the header is hidden: status and labelled dates stack under the ID / type */}
                  <div className="col-start-2 col-span-2 min-w-0 flex flex-col items-start gap-1 md:contents">
                    <span className={`md:w-full text-center text-xs px-2 py-0.5 rounded-full ${statusClass}`}>
                      {labelOf(task.status)}
                    </span>
                    <span className="text-xs max-w-full break-words">
                      <span className="md:hidden text-gray-500">{t("tasks.submitted")}: </span>
                      {formatDate(task.submitDate)}
                    </span>
                    <div
                      data-testid="task-started-completed"
                      className="text-xs max-w-full break-words"
                      title={startedCompletedText(task)}
                    >
                      <span className="md:hidden text-gray-500">{t("tasks.startedCompleted")}: </span>
                      <span>{formatDate(task.startedDate)}</span>
                      {endDate(task) && (
                        <span className="text-gray-400"> → {formatDate(endDate(task))}</span>
                      )}
                    </div>
                  </div>
                  <div
                    className="row-start-1 col-start-3 md:row-auto md:col-auto flex justify-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {canCancel && isCancellable(task.status) && (
                      <button
                        onClick={() => handleCancel(task)}
                        className="p-1.5 rounded-md hover:bg-gray-200"
                        title={t("tasks.cancelButton")}
                      >
                        <CircleStop className="w-4 h-4 text-red-600" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {tasks.length === 0 && (
              <p className="text-sm text-gray-500 mt-4">{t("tasks.empty")}</p>
            )}
          </div>
        )}

        {/* Pagination */}
        {tasks && tasks.length > 0 && (
          <PaginationControls
            onFirst={() => setPage(1)}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => p + 1)}
            disabledPrev={page <= 1}
            disabledNext={!hasMore}
            label={t("common.pageOf", { page, count: pageTasks.length })}
            total={pageTasks.length}
          />
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selectedTask} onOpenChange={(v) => !v && setSelectedTask(null)}>
        <DialogContent aria-describedby={undefined} className="max-w-2xl" onCloseAutoFocus={restoreFocus}>
          <DialogHeader>
            <DialogTitle>{selectedTask && t("tasks.detailTitle", { name: taskHeading(t, selectedTask) })}</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-3">
              <TaskSummary task={selectedTask} />
              <TaskDetails task={selectedTask} raw={selectedTask} />
              <div className="flex justify-end gap-2 pt-2">
                {canCancel && isCancellable(selectedTask.status) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => { handleCancel(selectedTask); setSelectedTask(null); }}
                  >
                    <CircleStop className="w-4 h-4 mr-1" />
                    {t("tasks.cancelButton")}
                  </Button>
                )}
                <Button size="sm" asChild>
                  <Link to={`/task/${selectedTask.taskId}`}>
                    {t("tasks.fullDetails")}
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function isCancellable(status: TaskStatus): boolean {
  return status === TaskStatus.WAITING || status === TaskStatus.IN_PROGRESS;
}

function DateFilter({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-xs text-gray-500 font-medium">{label}</label>
      <input
        id={id}
        type="datetime-local"
        className="w-full mt-1 border rounded px-2 py-1.5 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
