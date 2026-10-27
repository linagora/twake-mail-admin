// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";

// Hoisted: the vi.mock factories below run before the module's top-level declarations
const TASK_ID = vi.hoisted(() => "30dcd0fb-0000-4000-8000-000000000001");
const api = vi.hoisted(() => ({ listTasks: vi.fn() }));
// The button naming the task, which opens its details
const findTaskButton = async () => within(await screen.findByTestId("task-row")).getAllByRole("button")[0];

vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => false }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/modules/common-tasks/api-client", () => ({ cancelTask: vi.fn() }));
vi.mock("./api-client", () => ({ listTasks: api.listTasks }));
// The keys as text; the chip label and its count, to read the count
const t = vi.hoisted(() => (key: string, options?: Record<string, unknown>) =>
  key === "tasks.chipCount" ? `${options?.label} (${options?.count})` : key);
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t }) }));

import Tasks from "./index";

function Location() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname + location.search}</span>;
}

function renderTasks(url = "/tasks") {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Tasks />
      <Location />
    </MemoryRouter>
  );
}

// The type of each listed task, from the muted line "<type> · <short id>"
const rowTypes = () =>
  screen.getAllByTestId("task-row").map((row) => row.querySelector("span[title]")!.textContent!.split(" · ")[0]);

afterEach(() => {
  cleanup();
  api.listTasks.mockReset();
});

describe("tasks list", () => {
  it("exposes each task ID as a keyboard reachable button opening its details", async () => {
    api.listTasks.mockResolvedValue([
      {
        taskId: TASK_ID,
        type: "full-reindexing",
        status: "completed",
        submitDate: "2026-10-10T06:00:00Z",
        startedDate: "2026-10-10T06:00:01Z",
        completedDate: "2026-10-10T06:00:02Z",
      },
    ]);
    renderTasks();

    const taskButton = await findTaskButton();
    taskButton.focus();
    expect(document.activeElement).toBe(taskButton);

    fireEvent.click(taskButton);

    expect(await screen.findByRole("dialog")).not.toBeNull();
  });

  it("returns the focus to the task ID that opened the details once they are closed", async () => {
    api.listTasks.mockResolvedValue([
      { taskId: TASK_ID, type: "full-reindexing", status: "completed", submitDate: "2026-10-10T06:00:00Z" },
    ]);
    renderTasks();

    const taskButton = await findTaskButton();
    taskButton.focus();
    fireEvent.click(taskButton);
    fireEvent.keyDown(await screen.findByRole("dialog"), { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // Radix moves the focus on close from a timeout
    await waitFor(() => expect(document.activeElement).toBe(taskButton));
  });

  it("lays the header and the rows out on the same column template", async () => {
    api.listTasks.mockResolvedValue([
      { taskId: TASK_ID, type: "full-reindexing", status: "completed", submitDate: "2026-10-10T06:00:00Z" },
    ]);
    renderTasks();

    const row = await screen.findByTestId("task-row");
    const columnClasses = (element: HTMLElement) =>
      Array.from(element.classList).filter((name) => name.includes("grid-cols-"));

    expect(columnClasses(row)).not.toEqual([]);
    expect(columnClasses(screen.getByTestId("tasks-header"))).toEqual(columnClasses(row));
  });

  it("only truncates the task type from the md breakpoint, and never the dates", async () => {
    api.listTasks.mockResolvedValue([
      {
        taskId: TASK_ID,
        type: "a-newer-server-task-with-a-very-long-unknown-type-name",
        status: "completed",
        submitDate: "2026-10-10T06:00:00Z",
        startedDate: "2026-10-10T06:00:01Z",
        completedDate: "2026-10-10T06:00:02Z",
      },
    ]);
    renderTasks();

    const startedCompleted = await screen.findByTestId("task-started-completed");
    const typeCell = screen.getByText("a-newer-server-task-with-a-very-long-unknown-type-name").parentElement!;

    // The type column truncates from md on; the dates are never cut, they wrap
    expect(typeCell.classList).not.toContain("truncate");
    expect(typeCell.classList).toContain("md:truncate");
    expect(startedCompleted.classList).not.toContain("truncate");
    expect(startedCompleted.classList).not.toContain("md:truncate");
    expect(startedCompleted.title).toContain("→");
  });
});

describe("tasks: end date", () => {
  const endedTask = (status: string, endField: string) => ({
    taskId: TASK_ID,
    type: "calendar-archival",
    status,
    submitDate: "2026-10-16T18:18:45Z",
    startedDate: "2026-10-16T18:18:46Z",
    completedDate: null,
    [endField]: "2026-10-16T18:18:47Z",
  });

  it.each([
    ["failed", "failedDate"],
    ["canceled", "canceledDate"],
  ])("shows the end of a %s task in the Started / Completed column", async (status, endField) => {
    api.listTasks.mockResolvedValue([endedTask(status, endField)]);
    renderTasks();

    const startedCompleted = await screen.findByTestId("task-started-completed");

    expect(startedCompleted.textContent).toContain("→");
    expect(startedCompleted.title).toContain("→");
  });

  it("shows the cancellation date of a cancelled task in its details", async () => {
    api.listTasks.mockResolvedValue([endedTask("canceled", "canceledDate")]);
    renderTasks();

    fireEvent.click(await findTaskButton());
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByText("tasks.cancelledAt")).not.toBeNull();
  });

  it("sorts a failed task by its failure date on the Completed sort", async () => {
    api.listTasks.mockResolvedValue([
      { taskId: "never-ended", type: "never-ended", status: "inProgress", submitDate: "2026-10-16T18:18:40Z" },
      { ...endedTask("failed", "failedDate"), taskId: "failed-task", type: "failed-task" },
      {
        taskId: "earlier-completed",
        type: "earlier-completed",
        status: "completed",
        submitDate: "2026-10-16T18:18:40Z",
        completedDate: "2026-10-16T18:18:41Z",
      },
    ]);
    renderTasks();
    await screen.findAllByTestId("task-row");

    fireEvent.change(screen.getByLabelText("tasks.sort"), { target: { value: "completedDate" } });

    const types = screen.getAllByTestId("task-row").map((row) => row.querySelector("span[title]")!.getAttribute("title"));
    // Recent first: tasks that never ended lead, then the failed task by its failure date
    expect(types).toEqual(["never-ended", "failed-task", "earlier-completed"]);
  });
});

describe("tasks: status label", () => {
  const task = (status: string) => ({ taskId: TASK_ID, type: "full-reindexing", status, submitDate: "2026-10-10T06:00:00Z" });

  it.each([
    ["completed", "tasks.completed"],
    ["inProgress", "tasks.inProgress"],
    ["waiting", "tasks.waiting"],
    ["failed", "tasks.failed"],
  ])("translates the %s status of a row", async (status, label) => {
    api.listTasks.mockResolvedValue([task(status)]);
    renderTasks();

    const row = await screen.findByTestId("task-row");

    expect(within(row).getByText(label)).not.toBeNull();
    expect(within(row).queryByText(status)).toBeNull();
  });

  it("falls back to the raw status when it is unknown", async () => {
    api.listTasks.mockResolvedValue([task("unexpected")]);
    renderTasks();

    expect(within(await screen.findByTestId("task-row")).getByText("unexpected")).not.toBeNull();
  });

  it("translates the status in the task details", async () => {
    api.listTasks.mockResolvedValue([task("inProgress")]);
    renderTasks();

    fireEvent.click(await findTaskButton());
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByText("tasks.inProgress")).not.toBeNull();
    expect(within(dialog).queryByText("inProgress")).toBeNull();
  });
});

describe("tasks: quick status chips", () => {
  const listed = [
    { taskId: "t-waiting", type: "waiting-task", status: "waiting", submitDate: "2026-10-10T06:00:05Z" },
    { taskId: "t-progress", type: "progress-task", status: "inProgress", submitDate: "2026-10-10T06:00:04Z" },
    { taskId: "t-cancel-req", type: "cancel-requested-task", status: "canceledRequested", submitDate: "2026-10-10T06:00:03Z" },
    { taskId: "t-failed", type: "failed-task", status: "failed", submitDate: "2026-10-10T06:00:02Z" },
    { taskId: "t-completed", type: "completed-task", status: "completed", submitDate: "2026-10-10T06:00:01Z" },
    { taskId: "t-cancelled", type: "cancelled-task", status: "canceled", submitDate: "2026-10-10T06:00:00Z" },
  ];
  const chip = (label: string) => screen.getByRole("button", { name: new RegExp(`^${label.replace(/\./g, "\\.")}`) });

  it("counts the fetched tasks of each status", async () => {
    api.listTasks.mockResolvedValue(listed);
    renderTasks();
    await screen.findAllByTestId("task-row");

    expect(chip("tasks.all").textContent).toBe("tasks.all (6)");
    expect(chip("tasks.running").textContent).toBe("tasks.running (3)");
    expect(chip("tasks.chips.failed").textContent).toBe("tasks.chips.failed (1)");
    expect(chip("tasks.chips.completed").textContent).toBe("tasks.chips.completed (1)");
    expect(chip("tasks.chips.cancelled").textContent).toBe("tasks.chips.cancelled (1)");
  });

  it("names the status chips by their own keys, apart from the status pill of a task", async () => {
    api.listTasks.mockResolvedValue(listed);
    renderTasks();
    await screen.findAllByTestId("task-row");

    expect(screen.queryByRole("button", { name: /^tasks\.failed / })).toBeNull();
    expect(screen.queryByRole("button", { name: /^tasks\.completed / })).toBeNull();
    expect(screen.queryByRole("button", { name: /^tasks\.cancelled / })).toBeNull();
  });

  it("lists only the failed tasks at once, without a new request, and keeps the choice in the URL", async () => {
    api.listTasks.mockResolvedValue(listed);
    renderTasks();
    await screen.findAllByTestId("task-row");

    fireEvent.click(chip("tasks.chips.failed"));

    expect(rowTypes()).toEqual(["failed-task"]);
    expect(chip("tasks.chips.failed").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("location").textContent).toBe("/tasks?status=failed");
    expect(api.listTasks).toHaveBeenCalledTimes(1);
    expect(api.listTasks).toHaveBeenLastCalledWith(expect.not.objectContaining({ status: expect.anything() }));
  });

  it("lists waiting, in progress and cancel requested tasks under Running", async () => {
    api.listTasks.mockResolvedValue(listed);
    renderTasks();
    await screen.findAllByTestId("task-row");

    fireEvent.click(chip("tasks.running"));

    expect(rowTypes()).toEqual(["waiting-task", "progress-task", "cancel-requested-task"]);
  });

  it("reads the status back from the URL", async () => {
    api.listTasks.mockResolvedValue(listed);
    renderTasks("/tasks?status=failed");

    await screen.findAllByTestId("task-row");

    expect(rowTypes()).toEqual(["failed-task"]);
  });
});

describe("tasks: type picker and dates", () => {
  it("lists the task types by their name and sends the raw type", async () => {
    api.listTasks.mockResolvedValue([
      { taskId: "t1", type: "a-type-from-a-newer-server", status: "completed", submitDate: "2026-10-10T06:00:00Z" },
    ]);
    renderTasks();
    await screen.findAllByTestId("task-row");
    fireEvent.click(screen.getByText("tasks.filters"));

    const select = screen.getByLabelText("tasks.type") as HTMLSelectElement;
    const options = Array.from(select.options);
    expect(select.tagName).toBe("SELECT");
    expect(options[0]).toMatchObject({ value: "", text: "tasks.allTypes" });
    expect(options.find((o) => o.value === "SubscribeAllTask")?.text).toBe("users.tasks.subscribeAll");
    expect(options.some((o) => o.value === "a-type-from-a-newer-server")).toBe(true);
    // The mail application does not offer the calendar tasks
    expect(options.some((o) => o.value === "calendar-archival")).toBe(false);
    // Types sharing a name are told apart by their key
    expect(options.find((o) => o.value === "deleted-messages-delete")?.text).toBe("commonTasks.purgeDeletedMessages (deleted-messages-delete)");
    const labels = options.slice(1).map((o) => o.text);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));

    fireEvent.change(select, { target: { value: "SubscribeAllTask" } });
    fireEvent.click(screen.getByText("tasks.apply"));

    await waitFor(() => expect(api.listTasks).toHaveBeenLastCalledWith({ type: "SubscribeAllTask" }));
    expect(screen.getByTestId("location").textContent).toBe("/tasks?type=SubscribeAllTask");
  });

  it("folds the date pickers in a closed block, and counts the applied filters on the toggle", async () => {
    api.listTasks.mockResolvedValue([]);
    renderTasks();
    fireEvent.click(screen.getByText("tasks.filters"));

    const dates = screen.getByTestId("tasks-date-filters") as HTMLDetailsElement;
    expect(dates.tagName).toBe("DETAILS");
    expect(dates.open).toBe(false);
    expect(within(dates).getByLabelText("tasks.submittedAfter")).not.toBeNull();

    fireEvent.change(screen.getByLabelText("tasks.submittedAfter"), { target: { value: "2026-10-10T06:00" } });
    fireEvent.click(screen.getByText("tasks.apply"));
    fireEvent.click(screen.getByText("tasks.hideFilters"));

    expect(screen.getByRole("button", { name: /tasks\.filtersActive/ })).not.toBeNull();
    await waitFor(() =>
      expect(api.listTasks).toHaveBeenLastCalledWith({ submittedAfter: new Date("2026-10-10T06:00").toISOString() })
    );
  });

  it("fetches the list once, when the filters are applied", async () => {
    api.listTasks.mockResolvedValue([]);
    renderTasks();
    await waitFor(() => expect(api.listTasks).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText("tasks.filters"));

    fireEvent.change(screen.getByLabelText("tasks.type"), { target: { value: "SubscribeAllTask" } });
    fireEvent.change(screen.getByLabelText("tasks.submittedAfter"), { target: { value: "2026-10-10T06:00" } });
    expect(api.listTasks).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("tasks.apply"));

    await waitFor(() => expect(api.listTasks).toHaveBeenCalledTimes(2));
    expect(api.listTasks).toHaveBeenLastCalledWith(expect.objectContaining({ type: "SubscribeAllTask" }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(api.listTasks).toHaveBeenCalledTimes(2);
  });

  it("reads the filters, the sort and the page back from the URL, and Reset clears them", async () => {
    api.listTasks.mockResolvedValue(
      Array.from({ length: 51 }, (_, index) => ({
        taskId: `task-${index}`,
        type: `type-${String(index).padStart(2, "0")}`,
        status: "failed",
        submitDate: "2026-10-10T06:00:00Z",
      }))
    );
    renderTasks("/tasks?status=failed&type=SubscribeAllTask&sort=type&asc=1&page=2");

    await screen.findAllByTestId("task-row");
    expect(api.listTasks).toHaveBeenLastCalledWith({ type: "SubscribeAllTask" });
    expect(rowTypes()).toEqual(["type-50"]);
    expect((screen.getByLabelText("tasks.sort") as HTMLSelectElement).value).toBe("type");

    fireEvent.click(screen.getByRole("button", { name: /tasks\.filtersActive/ }));
    expect((screen.getByLabelText("tasks.type") as HTMLSelectElement).value).toBe("SubscribeAllTask");
    fireEvent.click(screen.getByText("tasks.reset"));

    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/tasks?sort=type&asc=1"));
    await waitFor(() => expect(api.listTasks).toHaveBeenLastCalledWith({}));
  });

  it("does not keep showing previous tasks when the filtered request fails", async () => {
    api.listTasks.mockResolvedValueOnce([
      { taskId: "task-1", type: "previous-task", status: "completed", submitDate: "2026-10-09T10:00:00Z" },
    ]);
    renderTasks();
    await screen.findByText("previous-task");

    api.listTasks.mockRejectedValue(new Error("Request failed with status code 400"));
    fireEvent.click(screen.getByText("tasks.filters"));
    fireEvent.change(screen.getByLabelText("tasks.type"), { target: { value: "SubscribeAllTask" } });
    fireEvent.click(screen.getByText("tasks.apply"));

    await screen.findByText("common.errorPrefix");
    expect(screen.queryAllByTestId("task-row")).toEqual([]);
  });
});

describe("tasks: live list", () => {
  const running = { taskId: TASK_ID, type: "full-reindexing", status: "inProgress", submitDate: "2026-10-10T06:00:00Z" };
  const completed = { ...running, status: "completed", completedDate: "2026-10-10T06:00:09Z" };

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  });

  it("follows a running task every 5 s, without the loading placeholder, until it is over", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.listTasks.mockResolvedValueOnce([running]).mockResolvedValue([completed]);
    renderTasks();
    await screen.findByText("tasks.inProgress");
    expect(screen.getByTestId("tasks-freshness").textContent).toBe("tasks.autoRefreshing");

    await vi.advanceTimersByTimeAsync(5000);

    expect(await screen.findByText("tasks.completed", { selector: "[data-testid=task-row] span" })).not.toBeNull();
    expect(document.querySelector(".animate-pulse")).toBeNull();
    await waitFor(() => expect(screen.getByTestId("tasks-freshness").textContent).toMatch(/^tasks\.updatedAt/));
    const calls = api.listTasks.mock.calls.length;

    await vi.advanceTimersByTimeAsync(15000);
    expect(api.listTasks.mock.calls.length).toBe(calls);
  });

  it("sends no request while nothing runs", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.listTasks.mockResolvedValue([completed]);
    renderTasks();
    await screen.findByTestId("task-row");

    await vi.advanceTimersByTimeAsync(15000);

    expect(api.listTasks).toHaveBeenCalledTimes(1);
  });

  it("sends no request while the browser tab is hidden, and reads the list again when it is shown", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.listTasks.mockResolvedValue([running]);
    renderTasks();
    await screen.findByTestId("task-row");

    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    await vi.advanceTimersByTimeAsync(15000);
    expect(api.listTasks).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    await waitFor(() => expect(api.listTasks).toHaveBeenCalledTimes(2));
  });
});

describe("tasks filters: field labels", () => {
  it.each([
    ["tasks.sort", "SELECT"],
    ["tasks.type", "SELECT"],
    ["tasks.submittedAfter", "INPUT"],
    ["tasks.failedBefore", "INPUT"],
  ])("names the %s field after its visible label", (label, tagName) => {
    api.listTasks.mockResolvedValue([]);
    renderTasks();
    fireEvent.click(screen.getByText("tasks.filters"));

    expect(screen.getByLabelText(label).tagName).toBe(tagName);
  });
});

describe("tasks: sort", () => {
  const taskOfType = (type: string, index: number) => ({
    taskId: `task-${index}`,
    type,
    status: "completed",
    submitDate: `2026-10-10T06:${String(index % 60).padStart(2, "0")}:00Z`,
  });

  function typesOnPage(): string[] {
    // The muted line "<type> · <short id>"
    return screen.getAllByTestId("task-row").map((row) => row.querySelector(`span[title^="task-"]`)!.textContent!.split(" · ")[0]);
  }

  it("fetches every task instead of a single WebAdmin page", async () => {
    api.listTasks.mockResolvedValue([]);
    renderTasks();

    await waitFor(() => expect(api.listTasks).toHaveBeenCalled());
    expect(api.listTasks).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ offset: expect.anything(), limit: expect.anything() })
    );
  });

  it("sorts the whole task list, not only the current page", async () => {
    const tasks = [
      ...Array.from({ length: 50 }, (_, index) => taskOfType("user-reindexing", index)),
      taskOfType("ClearMailboxContentTask", 50),
    ];
    api.listTasks.mockResolvedValue(tasks);
    renderTasks();
    await screen.findAllByTestId("task-row");

    fireEvent.change(screen.getByLabelText("tasks.sort"), { target: { value: "type" } });
    fireEvent.click(screen.getByText("tasks.desc"));

    expect(typesOnPage()[0]).toBe("ClearMailboxContentTask");
    expect(typesOnPage()).toHaveLength(50);

    fireEvent.click(screen.getByText("common.next"));

    expect(typesOnPage()).toEqual(["user-reindexing"]);
    expect(api.listTasks).toHaveBeenCalledTimes(1);
  });

  it("goes back to the first page when the sort changes", async () => {
    api.listTasks.mockResolvedValue(Array.from({ length: 51 }, (_, index) => taskOfType(`type-${index}`, index)));
    renderTasks();
    await screen.findAllByTestId("task-row");

    fireEvent.click(screen.getByText("common.next"));
    expect(screen.getAllByTestId("task-row")).toHaveLength(1);

    fireEvent.click(screen.getByText("tasks.desc"));

    expect(screen.getAllByTestId("task-row")).toHaveLength(50);
  });

  it("shows under the type what a task worked on", async () => {
    api.listTasks.mockResolvedValue([
      {
        taskId: TASK_ID,
        type: "reprocessing-all",
        status: "completed",
        submitDate: "2026-10-10T06:00:00Z",
        additionalInformation: { repositoryPath: "var/mail/address-error", initialCount: 0 },
      },
    ]);
    renderTasks();

    expect(await screen.findByText("var/mail/address-error")).not.toBeNull();
  });
});
