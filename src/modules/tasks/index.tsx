import { useCallback, useMemo, useState } from "react";
import { RefreshCcw, CircleStop, Filter } from "lucide-react";
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

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

const STATUS_OPTIONS = ["", "waiting", "inProgress", "cancelledRequested", "completed", "cancelled", "failed"];
const STATUS_LABELS: Record<string, string> = {
  "": "All",
  waiting: "Waiting",
  inProgress: "In Progress",
  cancelledRequested: "Cancel Requested",
  completed: "Completed",
  cancelled: "Cancelled",
  failed: "Failed",
};

type SortField = "submitDate" | "startedDate" | "completedDate" | "status" | "type";

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  inProgress: "bg-blue-100 text-blue-800",
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

const headerSubTitle = "Monitor and manage server tasks";
const docuUrl = "https://james.staged.apache.org/james-project/3.9.0/servers/distributed/operate/webadmin.html#_task_management";

export default function Tasks() {
  const { toast } = useToast();
  const confirm = useConfirm();

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
      header: "Cancel Task",
      message: `Cancel task "${task.taskId}" (${task.type})?`,
    });
    if (!confirmed) return;
    try {
      await cancelTask(task.taskId);
      toast({ title: "Task cancelled" });
      await refresh();
    } catch (err) {
      toast({ title: "Error cancelling task", description: <ErrorDisplayer error={err} /> });
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

  const SORT_FIELDS: { key: SortField; label: string }[] = [
    { key: "submitDate", label: "Submitted" },
    { key: "startedDate", label: "Started" },
    { key: "completedDate", label: "Completed" },
    { key: "status", label: "Status" },
    { key: "type", label: "Type" },
  ];

  return (
    <div className="p-4 w-fit">
      <Header headerSubTitle={headerSubTitle} docuUrl={docuUrl} />

      <div className="mt-4">
        {/* Toolbar: refresh, filter toggle, sort */}
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCcw className="w-4 h-4 mr-1" /> Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-1" />
            {showFilters ? "Hide Filters" : "Filters"}
          </Button>

          <div className="flex items-center gap-2 ml-auto">
            <label className="text-sm font-medium">Sort:</label>
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
              {sortAsc ? "Asc \u2191" : "Desc \u2193"}
            </button>
          </div>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="p-4 bg-gray-50 rounded-2 mb-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500 font-medium">Status</label>
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
                <label className="text-xs text-gray-500 font-medium">Type</label>
                <input
                  type="text"
                  className="w-full mt-1 border rounded px-2 py-1.5 text-sm"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  placeholder="e.g. full-reindexing"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <DateFilter label="Submitted after" value={submittedAfter} onChange={setSubmittedAfter} />
              <DateFilter label="Submitted before" value={submittedBefore} onChange={setSubmittedBefore} />
              <DateFilter label="Started after" value={startedAfter} onChange={setStartedAfter} />
              <DateFilter label="Started before" value={startedBefore} onChange={setStartedBefore} />
              <DateFilter label="Completed after" value={completedAfter} onChange={setCompletedAfter} />
              <DateFilter label="Completed before" value={completedBefore} onChange={setCompletedBefore} />
              <DateFilter label="Failed after" value={failedAfter} onChange={setFailedAfter} />
              <DateFilter label="Failed before" value={failedBefore} onChange={setFailedBefore} />
            </div>

            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleApplyFilters}>Apply</Button>
              <Button size="sm" variant="outline" onClick={handleResetFilters}>Reset</Button>
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
            <span>Task ID / Type</span>
            <span className="w-24 text-center">Status</span>
            <span>Submitted</span>
            <span>Started / Completed</span>
            <span className="w-16 text-center">Actions</span>
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
                    {isCancellable(task.status) && (
                      <button
                        onClick={() => handleCancel(task)}
                        className="p-1.5 rounded-md hover:bg-gray-200"
                        title="Cancel task"
                      >
                        <CircleStop className="w-4 h-4 text-red-600" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {tasks.length === 0 && (
              <p className="text-sm text-gray-500 mt-4">No tasks found matching the current filters.</p>
            )}
          </div>
        )}

        {/* Pagination */}
        {tasks && tasks.length > 0 && (
          <div className="mt-4 flex justify-between items-center">
            <button
              onClick={() => setPage(1)}
              disabled={page <= 1}
              className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              First
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm font-medium text-center">
              Page {page} — {tasks.length} result{tasks.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selectedTask} onOpenChange={(v) => !v && setSelectedTask(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Task — {selectedTask?.taskId}</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-gray-500 font-medium">Status</span>
                <span className={`inline-block w-fit px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[selectedTask.status] || ""}`}>
                  {selectedTask.status}
                </span>
                <span className="text-gray-500 font-medium">Type</span>
                <span>{selectedTask.type}</span>
                <span className="text-gray-500 font-medium">Submitted</span>
                <span>{formatDate(selectedTask.submitDate)}</span>
                <span className="text-gray-500 font-medium">Started</span>
                <span>{formatDate(selectedTask.startedDate)}</span>
                <span className="text-gray-500 font-medium">Completed</span>
                <span>{formatDate(selectedTask.completedDate)}</span>
                {selectedTask.cancelledDate && (
                  <>
                    <span className="text-gray-500 font-medium">Cancelled</span>
                    <span>{formatDate(selectedTask.cancelledDate)}</span>
                  </>
                )}
                {selectedTask.failedDate && (
                  <>
                    <span className="text-gray-500 font-medium">Failed</span>
                    <span>{formatDate(selectedTask.failedDate)}</span>
                  </>
                )}
                {selectedTask.executedOn && (
                  <>
                    <span className="text-gray-500 font-medium">Executed on</span>
                    <span>{selectedTask.executedOn}</span>
                  </>
                )}
                {selectedTask.submittedFrom && (
                  <>
                    <span className="text-gray-500 font-medium">Submitted from</span>
                    <span>{selectedTask.submittedFrom}</span>
                  </>
                )}
              </div>
              {selectedTask.additionalInformation && Object.keys(selectedTask.additionalInformation).length > 0 && (
                <div>
                  <span className="text-sm text-gray-500 font-medium">Additional Information</span>
                  <pre className="mt-1 text-xs bg-gray-50 p-3 rounded overflow-x-auto">
                    {JSON.stringify(selectedTask.additionalInformation, null, 2)}
                  </pre>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                {isCancellable(selectedTask.status) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => { handleCancel(selectedTask); setSelectedTask(null); }}
                  >
                    <CircleStop className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                )}
                <Button size="sm" asChild>
                  <a href={`/task/${selectedTask.taskId}`}>
                    Full Details
                  </a>
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
