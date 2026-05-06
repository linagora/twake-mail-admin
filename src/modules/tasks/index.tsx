import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router";
import { RefreshCcw, CircleStop, Filter } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { listTasks, ListTasksParams } from "./api-client";
import { cancelTask } from "@/modules/common-tasks/api-client";
import { TaskDetailResponse, TaskStatus } from "@/modules/common-tasks/types";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
import Header from "@/components/custom/header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PaginationControls } from "@/components/custom/pagination-controls";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

const STATUS_OPTIONS = ["", "waiting", "inProgress", "cancelledRequested", "completed", "cancelled", "failed"];

type SortField = "submitDate" | "startedDate" | "completedDate" | "status" | "type";

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  inProgress: "bg-primary/10 text-primary",
  waiting: "bg-yellow-100 text-yellow-800",
  cancelled: "bg-gray-100 text-gray-600",
  cancelledRequested: "bg-orange-100 text-orange-800",
};

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    return `${dt.toLocaleDateString()} ${dt.toLocaleTimeString()}`;
  } catch {
    return d;
  }
}

const docuUrl = "https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_task_management";

export default function Tasks() {
  const { t } = useTranslation();
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

  const buildParams = useCallback((): ListTasksParams => {
    const params: ListTasksParams = {
      offset: (page - 1) * PAGE_LIMIT,
      limit: PAGE_LIMIT,
    };
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
  }, [page, statusFilter, typeFilter, submittedAfter, submittedBefore, startedAfter, startedBefore, completedAfter, completedBefore, failedAfter, failedBefore]);

  const fetchTasks = useCallback(() => listTasks(buildParams()), [buildParams]);
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
        case "completedDate": va = a.completedDate; vb = b.completedDate; break;
        case "status": va = a.status; vb = b.status; break;
        case "type": va = a.type; vb = b.type; break;
        default: va = a.submitDate; vb = b.submitDate;
      }
      if (!va && !vb) return 0;
      if (!va) return sortAsc ? 1 : -1;
      if (!vb) return sortAsc ? -1 : 1;
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return copy;
  }, [tasks, sortField, sortAsc]);

  const hasMore = tasks ? tasks.length >= PAGE_LIMIT : false;

  const handleCancel = async (task: TaskDetailResponse) => {
    const confirmed = await confirm({
      header: t("tasks.cancelTitle"),
      message: t("tasks.cancelConfirm", { taskId: task.taskId, type: task.type }),
    });
    if (!confirmed) return;
    try {
      await cancelTask(task.taskId);
      toast({ title: t("tasks.taskCancelled") });
      await refresh();
    } catch (err) {
      toast({ title: t("tasks.errorCancelling"), description: <ErrorDisplayer error={err} /> });
    }
  };

  const handleApplyFilters = () => {
    setPage(1);
    refresh();
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
  };

  const STATUS_LABELS: Record<string, string> = {
    "": t("tasks.all"),
    waiting: t("tasks.waiting"),
    inProgress: t("tasks.inProgress"),
    cancelledRequested: t("tasks.cancelRequested"),
    completed: t("tasks.completed"),
    cancelled: t("tasks.cancelled"),
    failed: t("tasks.failed"),
  };

  const SORT_FIELDS: { key: SortField; label: string }[] = [
    { key: "submitDate", label: t("tasks.submitted") },
    { key: "startedDate", label: t("tasks.started") },
    { key: "completedDate", label: t("tasks.completed") },
    { key: "status", label: t("tasks.status") },
    { key: "type", label: t("tasks.type") },
  ];

  return (
    <div className="p-4 w-fit">
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

          <div className="flex items-center gap-2 ml-auto">
            <label className="text-sm font-medium">{t("tasks.sort")}</label>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
            >
              {SORT_FIELDS.map((f) => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
            <button
              className="border rounded px-2 py-1 text-sm"
              onClick={() => setSortAsc(!sortAsc)}
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
                <label className="text-xs text-gray-500 font-medium">{t("tasks.status")}</label>
                <select
                  className="w-full mt-1 border rounded px-2 py-1.5 text-sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">{t("tasks.type")}</label>
                <input
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
        {error && <p className="text-red-500 mt-2">Error: {error}</p>}

        {/* Legend */}
        {tasks && tasks.length > 0 && (
          <div className="grid grid-cols-[auto_1fr_auto_1fr_1fr_auto] gap-2 text-xs font-semibold text-muted-foreground px-3 pb-2 border-b mb-1">
            <span className="w-8">#</span>
            <span>{t("tasks.idType")}</span>
            <span className="w-24 text-center">{t("tasks.status")}</span>
            <span>{t("tasks.submitted")}</span>
            <span>{t("tasks.startedCompleted")}</span>
            <span className="w-16 text-center">{t("tasks.actions")}</span>
          </div>
        )}

        {/* Task rows */}
        {tasks && (
          <div className="space-y-1">
            {sorted.map((task, index) => {
              const globalIndex = (page - 1) * PAGE_LIMIT + index + 1;
              const statusClass = STATUS_COLORS[task.status] || "bg-gray-100 text-gray-600";
              return (
                <div
                  key={task.taskId}
                  className="grid grid-cols-[auto_1fr_auto_1fr_1fr_auto] gap-2 items-center p-3 bg-gray-50 rounded-2 cursor-pointer hover:bg-gray-100 transition text-sm"
                  onClick={() => setSelectedTask(task)}
                >
                  <span className="text-muted-foreground w-8">{globalIndex}.</span>
                  <div className="truncate">
                    <span className="font-mono text-xs">{task.taskId}</span>
                    <br />
                    <span className="text-xs text-gray-500">{task.type}</span>
                  </div>
                  <span className={`w-24 text-center text-xs px-2 py-0.5 rounded-full ${statusClass}`}>
                    {task.status}
                  </span>
                  <span className="text-xs truncate">{formatDate(task.submitDate)}</span>
                  <div className="text-xs truncate">
                    <span>{formatDate(task.startedDate)}</span>
                    {task.completedDate && (
                      <span className="text-gray-400"> → {formatDate(task.completedDate)}</span>
                    )}
                  </div>
                  <div className="w-16 flex justify-center" onClick={(e) => e.stopPropagation()}>
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
            label={t("common.pageOf", { page, count: tasks.length })}
          />
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selectedTask} onOpenChange={(v) => !v && setSelectedTask(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("tasks.detailTitle", { taskId: selectedTask?.taskId })}</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-gray-500 font-medium">{t("tasks.status")}</span>
                <span className={`inline-block w-fit px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[selectedTask.status] || ""}`}>
                  {selectedTask.status}
                </span>
                <span className="text-gray-500 font-medium">{t("tasks.type")}</span>
                <span>{selectedTask.type}</span>
                <span className="text-gray-500 font-medium">{t("tasks.submitted")}</span>
                <span>{formatDate(selectedTask.submitDate)}</span>
                <span className="text-gray-500 font-medium">{t("tasks.started")}</span>
                <span>{formatDate(selectedTask.startedDate)}</span>
                <span className="text-gray-500 font-medium">{t("tasks.completed")}</span>
                <span>{formatDate(selectedTask.completedDate)}</span>
                {selectedTask.cancelledDate && (
                  <>
                    <span className="text-gray-500 font-medium">{t("tasks.cancelledAt")}</span>
                    <span>{formatDate(selectedTask.cancelledDate)}</span>
                  </>
                )}
                {selectedTask.failedDate && (
                  <>
                    <span className="text-gray-500 font-medium">{t("tasks.failedAt")}</span>
                    <span>{formatDate(selectedTask.failedDate)}</span>
                  </>
                )}
                {selectedTask.executedOn && (
                  <>
                    <span className="text-gray-500 font-medium">{t("tasks.executedOn")}</span>
                    <span>{selectedTask.executedOn}</span>
                  </>
                )}
                {selectedTask.submittedFrom && (
                  <>
                    <span className="text-gray-500 font-medium">{t("tasks.submittedFrom")}</span>
                    <span>{selectedTask.submittedFrom}</span>
                  </>
                )}
              </div>
              {selectedTask.additionalInformation && Object.keys(selectedTask.additionalInformation).length > 0 && (
                <div>
                  <span className="text-sm text-gray-500 font-medium">{t("tasks.additionalInfo")}</span>
                  <pre className="mt-1 text-xs bg-gray-50 p-3 rounded overflow-x-auto">
                    {JSON.stringify(selectedTask.additionalInformation, null, 2)}
                  </pre>
                </div>
              )}
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
  return (
    <div>
      <label className="text-xs text-gray-500 font-medium">{label}</label>
      <input
        type="datetime-local"
        className="w-full mt-1 border rounded px-2 py-1.5 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
