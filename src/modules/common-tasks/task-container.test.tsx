// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  toast: vi.fn(),
  runTask: vi.fn(),
  actionError: undefined as unknown,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key} ${JSON.stringify(options)}` : key),
  }),
}));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => mocks.confirm }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/hooks/use-run-task", () => ({ useRunTask: () => mocks.runTask }));

import TaskContainer from "./task-container";
import { TaskKey } from "./types";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.actionError = undefined;
  // Like the confirm dialog: a failed action is reported in the dialog, which stays open
  mocks.confirm.mockImplementation(async ({ action }: { action: () => Promise<unknown> }) => {
    try {
      await action();
      return true;
    } catch (err) {
      mocks.actionError = err;
      return false;
    }
  });
});

afterEach(cleanup);

const renderBlobGc = () => {
  render(
    <MemoryRouter>
      <TaskContainer
        nameKey="commonTasks.blobGarbageCollection"
        taskKey={TaskKey.BLOB_GARBAGE_COLLECTION}
        command="DELETE /blobs?scope=unreferenced"
        doc="https://example.com"
      />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole("button", { name: "common.run" }));
};

describe("task container: run task", () => {
  it("lets the dialog report a refused task instead of closing it", async () => {
    const refusal = new Error("DELETE /blobs can not be found");
    mocks.runTask.mockRejectedValue(refusal);

    renderBlobGc();

    await waitFor(() => expect(mocks.actionError).toBe(refusal));
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("announces the running task on success", async () => {
    mocks.runTask.mockResolvedValue("task-id");

    renderBlobGc();

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1));
    expect(mocks.toast.mock.calls[0][0].title).toBe("common.taskRunning");
  });
});

const renderTaskWithDoc = (doc: string) => {
  render(
    <MemoryRouter>
      <TaskContainer
        nameKey="commonTasks.alarmRescheduling"
        taskKey={TaskKey.ALARM_RESCHEDULING}
        command="POST /calendars?task=scheduleAlarms"
        doc={doc}
      />
    </MemoryRouter>
  );
};

describe("task container: doc link", () => {
  it("links to the task documentation", () => {
    renderTaskWithDoc("https://example.com/doc");
    expect(screen.getByRole("link", { name: "(doc)" }).getAttribute("href")).toBe("https://example.com/doc");
  });

  it("renders no doc link when the task has no documentation", () => {
    renderTaskWithDoc("");
    expect(screen.queryByRole("link")).toBeNull();
  });
});
