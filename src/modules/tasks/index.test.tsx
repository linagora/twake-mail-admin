// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";

// Hoisted: the vi.mock factories below run before the module's top-level declarations
const TASK_ID = vi.hoisted(() => "30dcd0fb-0000-4000-8000-000000000001");
const api = vi.hoisted(() => ({ listTasks: vi.fn() }));

vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => false }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/modules/common-tasks/api-client", () => ({ cancelTask: vi.fn() }));
vi.mock("./api-client", () => ({ listTasks: api.listTasks }));

import Tasks from "./index";

function renderTasks() {
  render(
    <MemoryRouter>
      <Tasks />
    </MemoryRouter>
  );
}

function statusSelect(): HTMLSelectElement {
  fireEvent.click(screen.getByText("tasks.filters"));
  return screen.getByDisplayValue("tasks.all") as HTMLSelectElement;
}

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

    const taskButton = await screen.findByRole("button", { name: TASK_ID });
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

    const taskButton = await screen.findByRole("button", { name: TASK_ID });
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

  it("only truncates the task type and dates from the md breakpoint, so phone cards show them in full", async () => {
    api.listTasks.mockResolvedValue([
      {
        taskId: TASK_ID,
        type: "tmail-deleted-messages-blob-store-based-garbage-collection",
        status: "completed",
        submitDate: "2026-10-10T06:00:00Z",
        startedDate: "2026-10-10T06:00:01Z",
        completedDate: "2026-10-10T06:00:02Z",
      },
    ]);
    renderTasks();

    const startedCompleted = await screen.findByTestId("task-started-completed");
    const typeCell = screen.getByText("tmail-deleted-messages-blob-store-based-garbage-collection").parentElement!;

    [startedCompleted, typeCell].forEach((element) => {
      expect(element.classList).not.toContain("truncate");
      expect(element.classList).toContain("md:truncate");
    });
    expect(startedCompleted.title).toContain("→");
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

    fireEvent.click(await screen.findByRole("button", { name: TASK_ID }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByText("tasks.inProgress")).not.toBeNull();
    expect(within(dialog).queryByText("inProgress")).toBeNull();
  });
});

describe("tasks: status filter", () => {
  it("offers the statuses understood by the James TaskManager", () => {
    api.listTasks.mockResolvedValue([]);
    renderTasks();

    const values = Array.from(statusSelect().options).map((option) => option.value);

    expect(values).toEqual(["", "waiting", "inProgress", "canceledRequested", "completed", "canceled", "failed"]);
  });

  it.each([
    ["canceled", "tasks.cancelled"],
    ["canceledRequested", "tasks.cancelRequested"],
  ])("queries status=%s when %s is selected", async (status) => {
    api.listTasks.mockResolvedValue([]);
    renderTasks();

    fireEvent.change(statusSelect(), { target: { value: status } });

    await waitFor(() => expect(api.listTasks).toHaveBeenLastCalledWith(expect.objectContaining({ status })));
  });

  it("does not keep showing previous tasks when the filtered request fails", async () => {
    api.listTasks.mockResolvedValueOnce([
      { taskId: "task-1", type: "previous-task", status: "completed", submitDate: "2026-10-09T10:00:00Z" },
    ]);
    renderTasks();
    await screen.findByText("previous-task");

    api.listTasks.mockRejectedValue(new Error("Request failed with status code 400"));
    fireEvent.change(statusSelect(), { target: { value: "failed" } });

    await screen.findByText("common.errorPrefix");
    expect(screen.queryByText("previous-task")).toBeNull();
  });
});

describe("tasks filters: field labels", () => {
  it.each([
    ["tasks.sort", "SELECT"],
    ["tasks.status", "SELECT"],
    ["tasks.type", "INPUT"],
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
    return screen.getAllByTestId("task-row").map((row) => row.querySelector("span[title]")!.getAttribute("title")!);
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
});
