// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  toast: vi.fn(),
  runTask: vi.fn(),
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
  mocks.confirm.mockResolvedValue(true);
});

afterEach(cleanup);

const runBlobGc = async () => {
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
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1));
  return mocks.toast.mock.calls[0][0];
};

describe("task container: run task toast", () => {
  it("titles the error toast with an explicit error naming the task", async () => {
    mocks.runTask.mockRejectedValue(new Error("DELETE /blobs can not be found"));

    const { title } = await runBlobGc();

    expect(title).toBe('commonTasks.errorRunTask {"name":"commonTasks.blobGarbageCollection"}');
  });

  it("announces the running task on success", async () => {
    mocks.runTask.mockResolvedValue("task-id");

    const { title } = await runBlobGc();

    expect(title).toBe("common.taskRunning");
  });
});
