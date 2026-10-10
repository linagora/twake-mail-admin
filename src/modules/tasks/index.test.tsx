// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const api = vi.hoisted(() => ({ listTasks: vi.fn() }));

vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => false }));
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

    await screen.findByText(/Request failed with status code 400/);
    expect(screen.queryByText("previous-task")).toBeNull();
  });
});
