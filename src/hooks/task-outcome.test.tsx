// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AxiosError } from "axios";

const api = vi.hoisted(() => ({ awaitTask: vi.fn() }));
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/modules/common-tasks/api-client", () => api);
vi.mock("@/hooks/use-toast", () => ({ toast }));

import "@/i18n";
import { followTask } from "./task-outcome";

const roundTimeout = () => new AxiosError("timeout of 25000ms exceeded", "ECONNABORTED");
const task = (status: string) => ({
  taskId: "58ae73fa-5585-417c-b320-1c19667b4743", type: "SubscribeAllTask", status,
  startedDate: "2026-10-24T10:00:00Z", completedDate: status === "completed" ? "2026-10-24T10:00:03Z" : undefined,
  failedDate: status === "failed" ? "2026-10-24T10:00:03Z" : undefined,
});

beforeEach(() => {
  api.awaitTask.mockReset();
  toast.mockReset();
});

describe("following a started task", () => {
  it("asks again after a round without outcome, then tells how the task ended", async () => {
    api.awaitTask
      .mockRejectedValueOnce(roundTimeout())
      .mockResolvedValueOnce(task("inProgress"))
      .mockResolvedValueOnce(task("completed"));

    const ended = await followTask("58ae73fa-5585-417c-b320-1c19667b4743", "Subscribe to all mailboxes", undefined);

    expect(ended).toMatchObject({ status: "completed" });
    expect(api.awaitTask).toHaveBeenCalledTimes(3);
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast.mock.calls[0][0]).toMatchObject({ title: "Task completed" });
  });

  it("keeps a failure on screen until it is read", async () => {
    api.awaitTask.mockResolvedValueOnce(task("failed"));
    await followTask("58ae73fa-5585-417c-b320-1c19667b4743", undefined, undefined);
    expect(toast.mock.calls[0][0]).toMatchObject({ title: "Task failed", variant: "destructive", duration: Infinity });
  });

  it("stops silently when the task cannot be followed", async () => {
    api.awaitTask.mockRejectedValueOnce(new AxiosError("Forbidden", "ERR_BAD_REQUEST", undefined, undefined,
      { status: 403, statusText: "Forbidden", headers: {}, config: {} as never, data: {} }));
    const ended = await followTask("58ae73fa-5585-417c-b320-1c19667b4743", undefined, undefined);
    expect(ended).toBeUndefined();
    expect(toast).not.toHaveBeenCalled();
  });
});
