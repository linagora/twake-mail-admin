import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { RefreshCcw, CircleStop, Filter, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { appConfig } from "@/lib/config";
import { currentLocale } from "@/i18n/locale";
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
import { cancelAndReport, cancelConfirmMessage, CALENDAR_TASK_TYPES, endDate, formatDate, isRunning, shortTaskId, statusLabel, SHARED_TASK_TYPES, STATUS_COLORS, TASK_TYPE_LABEL_KEYS, TaskDetails, taskTargetInfo, TaskTarget, TaskSummary, taskHeading, taskName, taskTypeLabel } from "./task-summary";
import { TASK_LIST_AUTO_REFRESH_MS, useAutoRefresh } from "./use-auto-refresh";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

// Shared by the header and every row: the tracks never depend on content, so they stay aligned.
// Below md: index | ID / type (status and dates stacked under it) | action.
const TASK_GRID_COLUMNS =
  "grid-cols-[2rem_minmax(0,1fr)_auto] md:grid-cols-[2rem_minmax(0,3fr)_6rem_minmax(0,2fr)_minmax(0,3fr)_4rem]";

// Stacked phone cards have room to wrap; desktop columns keep a single truncated line
const WRAP_BELOW_MD = "break-words md:truncate";

/**
 * The quick status filters. They filter the fetched list locally: "Running" covers three
 * statuses while WebAdmin filters one status per request, and every chip counts its tasks.
 */
type StatusChip = "" | "running" | TaskStatus.FAILED | TaskStatus.COMPLETED | TaskStatus.CANCELLED;
const STATUS_CHIPS: { key: StatusChip; labelKey: string; matches: (status: TaskStatus) => boolean }[] = [
  { key: "", labelKey: "tasks.all", matches: () => true },
  { key: "running", labelKey: "tasks.running", matches: isRunning },
  { key: TaskStatus.FAILED, labelKey: "tasks.chips.failed", matches: (s) => s === TaskStatus.FAILED },
  { key: TaskStatus.COMPLETED, labelKey: "tasks.chips.completed", matches: (s) => s === TaskStatus.COMPLETED },
  { key: TaskStatus.CANCELLED, labelKey: "tasks.chips.cancelled", matches: (s) => s === TaskStatus.CANCELLED },
];
const chipOf = (value: string | null) => STATUS_CHIPS.find((chip) => chip.key === value) ?? STATUS_CHIPS[0];

type SortField = "submitDate" | "startedDate" | "completedDate" | "status" | "type";
const SORT_FIELD_KEYS: SortField[] = ["submitDate", "startedDate", "completedDate", "status", "type"];

// The date filters, as the URL and the datetime-local fields hold them
const DATE_FILTERS = [
  "submittedAfter", "submittedBefore", "startedAfter", "startedBefore",
  "completedAfter", "completedBefore", "failedAfter", "failedBefore",
] as const;
type DateFilterKey = (typeof DATE_FILTERS)[number];
// Sent to WebAdmin: the type and the dates. The status is filtered locally.
const SERVER_FILTERS = ["type", ...DATE_FILTERS] as const;
type ServerFilters = Record<(typeof SERVER_FILTERS)[number], string>;

const serverFiltersOf = (params: URLSearchParams): ServerFilters =>
  Object.fromEntries(SERVER_FILTERS.map((key) => [key, params.get(key) ?? ""])) as ServerFilters;

function toListParams(filters: ServerFilters): ListTasksParams {
  const params: ListTasksParams = {};
  if (filters.type) params.type = filters.type;
  for (const key of DATE_FILTERS) {
    const date = filters[key] ? new Date(filters[key]) : null;
    if (date && !isNaN(date.getTime())) params[key] = date.toISOString();
  }
  return params;
}

// The types the application runs: Twake Calendar's WebAdmin does not run the mail tasks, nor the reverse
const KNOWN_TYPES = Object.keys(TASK_TYPE_LABEL_KEYS).filter(
  (type) => SHARED_TASK_TYPES.has(type) || CALENDAR_TASK_TYPES.has(type) === (appConfig.application === "CALENDAR")
);

/** The type picker options, by name; a name several types share tells them apart by their key. */
function typeOptions(t: TFunction, types: Iterable<string>): { value: string; label: string }[] {
  const options = [...new Set(types)].filter(Boolean).map((value) => ({ value, label: taskTypeLabel(t, value) }));
  const sharedNames = new Set(options.filter((o, i) => options.findIndex((other) => other.label === o.label) !== i).map((o) => o.label));
  return options
    .map((o) => (sharedNames.has(o.label) && o.label !== o.value ? { ...o, label: `${o.label} (${o.value})` } : o))
    .sort((a, b) => a.label.localeCompare(b.label, currentLocale()));
}

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

  // Status, type, dates, sort and page live in the URL: a reload, a bookmark or Back from a
  // task page shows the same list (/tasks?status=failed&type=SubscribeAllTask&sort=type&asc=1&page=2)
  const [searchParams, setSearchParams] = useSearchParams();
  const latestParams = useRef(searchParams);
  latestParams.current = searchParams;
  const updateParams = (changes: Record<string, string>, replace: boolean) => {
    const next = new URLSearchParams(latestParams.current);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value); else next.delete(key);
    }
    latestParams.current = next;
    setSearchParams(next, { replace });
  };

  const statusChip = chipOf(searchParams.get("status"));
  const sortParam = searchParams.get("sort") as SortField | null;
  const sortField: SortField = sortParam && SORT_FIELD_KEYS.includes(sortParam) ? sortParam : "submitDate";
  const sortAsc = searchParams.get("asc") === "1"; // default: recent first
  const page = Math.max(1, Math.floor(Number(searchParams.get("page"))) || 1);
  const setPage = (next: number) => updateParams({ page: next > 1 ? String(next) : "" }, true);

  // The applied type and dates, as a stable key: the list is fetched again only when they change
  const appliedKey = JSON.stringify(serverFiltersOf(searchParams));
  const applied = useMemo(() => JSON.parse(appliedKey) as ServerFilters, [appliedKey]);
  const activeFilterCount = SERVER_FILTERS.filter((key) => applied[key]).length;

  // The panel fields only build the request: it is sent when the filters are applied, not on every keystroke
  const [draft, setDraft] = useState<ServerFilters>(applied);
  // Back, a reload or Reset show the filters of the URL
  useEffect(() => setDraft(applied), [applied]);
  const [showFilters, setShowFilters] = useState(false);

  // Detail modal
  const [selectedTask, setSelectedTask] = useState<TaskDetailResponse | null>(null);
  const { rememberFocus, restoreFocus } = useReturnFocus();

  const openTask = (task: TaskDetailResponse) => {
    rememberFocus();
    setSelectedTask(task);
  };

  // WebAdmin cannot sort: fetch every matching task, then filter by status, sort and paginate locally
  const fetchTasks = useCallback(() => listTasks(toListParams(applied)), [applied]);
  const { data: tasks, isLoading, error, refresh, refreshSilently } = useFetchData<TaskDetailResponse[]>(fetchTasks);

  // Follows the list while one of its tasks runs, without the loading placeholder
  const hasRunningTask = !!tasks && tasks.some((task) => isRunning(task.status));
  const following = useAutoRefresh(hasRunningTask, refreshSilently, TASK_LIST_AUTO_REFRESH_MS);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  useEffect(() => {
    if (tasks) setUpdatedAt(new Date());
  }, [tasks]);

  // The type picker lists the types of the last list fetched without a type, and the known ones
  const [seenTypes, setSeenTypes] = useState<string[]>([]);
  useEffect(() => {
    if (tasks && !applied.type) setSeenTypes(tasks.map((task) => task.type));
  }, [tasks, applied.type]);
  const types = useMemo(
    () => typeOptions(t, [...seenTypes, ...KNOWN_TYPES, applied.type, draft.type]),
    [t, seenTypes, applied.type, draft.type]
  );

  const chipCounts = useMemo(
    () => new Map(STATUS_CHIPS.map((chip) => [chip.key, (tasks ?? []).filter((task) => chip.matches(task.status)).length])),
    [tasks]
  );

  const sorted = useMemo(() => {
    if (!tasks) return [];
    const copy = tasks.filter((task) => statusChip.matches(task.status));
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
  }, [tasks, statusChip, sortField, sortAsc, t]);

  const pageTasks = useMemo(() => sorted.slice((page - 1) * PAGE_LIMIT, page * PAGE_LIMIT), [sorted, page]);
  const hasMore = sorted.length > page * PAGE_LIMIT;

  const changeSort = (field: SortField, asc: boolean) =>
    updateParams({ sort: field === "submitDate" ? "" : field, asc: asc ? "1" : "", page: "" }, true);

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

  // A chip applies at once, and is a step of the history like an applied filter
  const handleStatusChip = (key: StatusChip) => updateParams({ status: key, page: "" }, false);

  // Applying the filters fetches the list once, even when they did not change
  const handleApplyFilters = () => {
    if (JSON.stringify(draft) === appliedKey) refresh();
    updateParams({ ...draft, page: "" }, false);
  };

  const handleResetFilters = () => {
    const cleared = Object.fromEntries(SERVER_FILTERS.map((key) => [key, ""]));
    updateParams({ ...cleared, status: "", page: "" }, false);
  };

  const setDraftField = (key: keyof ServerFilters) => (value: string) => setDraft((d) => ({ ...d, [key]: value }));
  const activeDateCount = DATE_FILTERS.filter((key) => draft[key]).length;

  const labelOf = (status: string) => statusLabel(t, status);

  const SORT_FIELDS: { key: SortField; label: string }[] = [
    { key: "submitDate", label: t("tasks.submitted") },
    { key: "startedDate", label: t("tasks.started") },
    { key: "completedDate", label: t("tasks.completed") },
    { key: "status", label: t("tasks.status") },
    { key: "type", label: t("tasks.type") },
  ];

  const DATE_FILTER_LABELS: Record<DateFilterKey, string> = {
    submittedAfter: t("tasks.submittedAfter"),
    submittedBefore: t("tasks.submittedBefore"),
    startedAfter: t("tasks.startedAfter"),
    startedBefore: t("tasks.startedBefore"),
    completedAfter: t("tasks.completedAfter"),
    completedBefore: t("tasks.completedBefore"),
    failedAfter: t("tasks.failedAfter"),
    failedBefore: t("tasks.failedBefore"),
  };

  return (
    <div className="p-4 w-fit max-w-full">
      <Header headerTitle={t("tasks.title")} headerSubTitle={t("tasks.subtitle")} docuUrl={docuUrl} />

      <div className="mt-4">
        {/* Toolbar: refresh and when the list was read, filter toggle, sort */}
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCcw className="w-4 h-4 mr-1" /> {t("tasks.refresh")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-expanded={showFilters}
            aria-controls={`${idPrefix}-filters`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-1" />
            {showFilters
              ? t("tasks.hideFilters")
              : activeFilterCount > 0
                ? t("tasks.filtersActive", { count: activeFilterCount })
                : t("tasks.filters")}
          </Button>
          {(following || updatedAt) && (
            <p data-testid="tasks-freshness" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              {following ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                  {t("tasks.autoRefreshing")}
                </>
              ) : (
                updatedAt && t("tasks.updatedAt", { time: updatedAt.toLocaleTimeString(currentLocale()) })
              )}
            </p>
          )}

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

        {/* Filters panel: the type, then the dates folded away */}
        {showFilters && (
          <div id={`${idPrefix}-filters`} className="p-4 bg-gray-50 rounded-2 mb-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label htmlFor={`${idPrefix}-type`} className="text-xs text-gray-500 font-medium">{t("tasks.type")}</label>
                <select
                  id={`${idPrefix}-type`}
                  className="w-full mt-1 border rounded px-2 py-1.5 text-sm bg-white"
                  value={draft.type}
                  onChange={(e) => setDraftField("type")(e.target.value)}
                >
                  <option value="">{t("tasks.allTypes")}</option>
                  {types.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <DateFilters
              initiallyOpen={DATE_FILTERS.some((key) => applied[key])}
              activeCount={activeDateCount}
              fields={DATE_FILTERS.map((key) => ({ key, label: DATE_FILTER_LABELS[key], value: draft[key], onChange: setDraftField(key) }))}
            />

            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleApplyFilters}>{t("tasks.apply")}</Button>
              <Button size="sm" variant="outline" onClick={handleResetFilters}>{t("tasks.reset")}</Button>
            </div>
          </div>
        )}

        {/* Quick status filters, applied at once, each with its count over the fetched list */}
        <div role="group" aria-label={t("tasks.status")} className="flex flex-wrap gap-2 mb-3">
          {STATUS_CHIPS.map((chip) => {
            const selected = chip.key === statusChip.key;
            return (
              <button
                key={chip.key || "all"}
                type="button"
                aria-pressed={selected}
                onClick={() => handleStatusChip(chip.key)}
                className={`px-3 py-1 rounded-full border text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  selected ? "bg-primary text-primary-foreground border-primary" : "bg-white hover:bg-gray-100"
                }`}
              >
                {tasks ? t("tasks.chipCount", { label: t(chip.labelKey), count: chipCounts.get(chip.key) ?? 0 }) : t(chip.labelKey)}
              </button>
            );
          })}
        </div>

        {/* Loading: not on the periodic refreshes, which keep the list on screen */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
          </div>
        )}
        {error && <p className="text-red-500 mt-2">{t("common.errorPrefix", { message: error })}</p>}

        {/* Legend */}
        {sorted.length > 0 && (
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
                      {taskName(t, task)}
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
            {sorted.length === 0 && (
              <p className="text-sm text-gray-500 mt-4">{t("tasks.empty")}</p>
            )}
          </div>
        )}

        {/* Pagination */}
        {sorted.length > 0 && (
          <PaginationControls
            onFirst={() => setPage(1)}
            onPrev={() => setPage(Math.max(1, page - 1))}
            onNext={() => setPage(page + 1)}
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

function DateFilters({ initiallyOpen, activeCount, fields }: {
  initiallyOpen: boolean;
  activeCount: number;
  fields: { key: string; label: string; value: string; onChange: (v: string) => void }[];
}) {
  const { t } = useTranslation();
  // Closed unless a date filter is applied; then left as the operator opens or closes it
  const [open] = useState(initiallyOpen);
  return (
    <details data-testid="tasks-date-filters" className="text-sm" open={open || undefined}>
      <summary className="cursor-pointer text-xs text-gray-500 font-medium">
        {t("tasks.dateFilters")}
        {activeCount > 0 && ` (${t("tasks.activeCount", { count: activeCount })})`}
      </summary>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-2">
        {fields.map((field) => (
          <DateFilter key={field.key} label={field.label} value={field.value} onChange={field.onChange} />
        ))}
      </div>
    </details>
  );
}
