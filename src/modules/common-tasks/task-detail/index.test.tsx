// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { TaskStatus } from "../types";

const TASK_ID = vi.hoisted(() => "4ebc9187-1542-4277-8cdb-9ca7576948a2");
const api = vi.hoisted(() => ({ getTaskDetail: vi.fn(), cancelTask: vi.fn() }));
const confirm = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => confirm }));
vi.mock("@/modules/domain-admin/domain-context", () => ({ useDomain: () => null }));
vi.mock("@/components/custom/header", () => ({ default: () => null }));
vi.mock("../api-client", () => api);

import TaskDetail from "./index";

function renderTaskDetail() {
  render(
    <MemoryRouter initialEntries={[`/task/${TASK_ID}`]}>
      <Routes>
        <Route path="/task/:id" element={<TaskDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

function findTaskJson() {
  return screen.findByText((_, element) => element?.tagName === "PRE");
}

afterEach(() => {
  cleanup();
  api.getTaskDetail.mockReset();
  api.cancelTask.mockReset();
  confirm.mockReset();
  toast.mockReset();
});

describe("task detail", () => {
  it("displays the task exactly as returned by WebAdmin", async () => {
    const taskDetail = {
      taskId: TASK_ID,
      type: "full-reindexing",
      status: "inProgress",
      submitDate: "2026-10-11T18:39:32.907+0000",
      startedDate: "2026-10-11T18:39:32.921+0000",
      completedDate: null,
      additionalInformation: { timestamp: "2026-10-11T18:39:32.907318528Z" },
    };
    api.getTaskDetail.mockResolvedValue(taskDetail);
    renderTaskDetail();

    const json = await findTaskJson();

    expect(JSON.parse(json.textContent ?? "")).toEqual(taskDetail);
  });

  it("names the refresh and cancel buttons of a running task", async () => {
    api.getTaskDetail.mockResolvedValue({ taskId: TASK_ID, status: TaskStatus.IN_PROGRESS });
    renderTaskDetail();

    await findTaskJson();

    expect(screen.getByRole("button", { name: "tasks.refresh" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "tasks.cancelButton" })).not.toBeNull();
  });

  it("only names the refresh button of a completed task", async () => {
    api.getTaskDetail.mockResolvedValue({ taskId: TASK_ID, status: TaskStatus.COMPLETED });
    renderTaskDetail();

    await findTaskJson();

    expect(screen.getByRole("button", { name: "tasks.refresh" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "tasks.cancelButton" })).toBeNull();
  });

  it.each([TaskStatus.FAILED, TaskStatus.CANCELLED, TaskStatus.CANCEL_REQUESTED])(
    "does not offer to cancel a %s task",
    async (status) => {
      api.getTaskDetail.mockResolvedValue({ taskId: TASK_ID, status });
      renderTaskDetail();

      await findTaskJson();

      expect(screen.queryByRole("button", { name: "tasks.cancelButton" })).toBeNull();
    }
  );

  it("offers to cancel a waiting task", async () => {
    api.getTaskDetail.mockResolvedValue({ taskId: TASK_ID, status: TaskStatus.WAITING });
    renderTaskDetail();

    await findTaskJson();

    expect(screen.getByRole("button", { name: "tasks.cancelButton" })).not.toBeNull();
  });

  it("does not offer to cancel a task that could not be loaded", async () => {
    api.getTaskDetail.mockRejectedValue(new Error("can not be found"));
    renderTaskDetail();

    await screen.findByText("common.errorPrefix");

    expect(screen.getByRole("button", { name: "tasks.refresh" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "tasks.cancelButton" })).toBeNull();
  });

  it("asks for a confirmation before cancelling the task", async () => {
    api.getTaskDetail.mockResolvedValue({ taskId: TASK_ID, type: "ExpireMailboxTask", status: TaskStatus.IN_PROGRESS });
    confirm.mockResolvedValue(false);
    renderTaskDetail();
    await findTaskJson();

    fireEvent.click(screen.getByRole("button", { name: "tasks.cancelButton" }));

    await waitFor(() => expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ header: "tasks.cancelTitle" })));
    expect(api.cancelTask).not.toHaveBeenCalled();
  });

  it("cancels the task and says so once confirmed", async () => {
    api.getTaskDetail.mockResolvedValue({ taskId: TASK_ID, type: "ExpireMailboxTask", status: TaskStatus.IN_PROGRESS });
    api.cancelTask.mockResolvedValue(undefined);
    confirm.mockResolvedValue(true);
    renderTaskDetail();
    await findTaskJson();

    fireEvent.click(screen.getByRole("button", { name: "tasks.cancelButton" }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: "tasks.taskCancelled" }));
    expect(api.cancelTask).toHaveBeenCalledWith(TASK_ID, undefined);
  });
});
