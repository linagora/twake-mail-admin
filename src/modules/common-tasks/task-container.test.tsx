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
  fireEvent.click(screen.getByRole("button", { name: /^common\.run / }));
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
    expect(mocks.toast.mock.calls[0][0].title).toBe("common.taskCreated");
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

describe("task container: optional backend extension", () => {
  const renderSpacePurge = () => {
    render(
      <MemoryRouter>
        <TaskContainer
          nameKey="commonTasks.twakeSpacePurge"
          taskKey={TaskKey.TWAKE_SPACE_PURGE}
          command="curl -XPOST /spaces?action=purge"
          doc=""
          risk="destructive"
          typeToConfirmKey="confirm.deleteWord"
          unavailableKey="commonTasks.twakeSpaceUnavailable"
        />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole("button", { name: /^common\.run / }));
  };

  const confirmOptions = async () => {
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledTimes(1));
    return mocks.confirm.mock.calls[0][0];
  };

  it("explains a 404 as the extension missing from the server", async () => {
    renderSpacePurge();

    const { describeError } = await confirmOptions();
    expect(describeError({ response: { status: 404 } })).toBe("commonTasks.twakeSpaceUnavailable");
  });

  it("leaves any other failure to the server message", async () => {
    renderSpacePurge();

    const { describeError } = await confirmOptions();
    expect(describeError({ response: { status: 500 } })).toBeNull();
  });

  it("asks to type the confirmation word before deleting team mailboxes", async () => {
    renderSpacePurge();

    expect(await confirmOptions()).toMatchObject({ destructive: true, typeToConfirm: "confirm.deleteWord" });
  });

  it("starts the purge task", async () => {
    mocks.runTask.mockResolvedValue("task-id");

    renderSpacePurge();

    await waitFor(() => expect(mocks.runTask).toHaveBeenCalledWith(TaskKey.TWAKE_SPACE_PURGE, undefined, {}));
  });
});

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

describe("task container: command tooltip", () => {
  it("opens the command on the side of the Run button, where it covers no other task", async () => {
    renderTaskWithDoc("");

    fireEvent.focus(screen.getByRole("button", { name: /^common\.run / }));

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.textContent).toBe("POST /calendars?task=scheduleAlarms");
    expect(document.querySelector("[data-side]")?.getAttribute("data-side")).toBe("left");
  });

  it("states the default parameters, as the dialog previews and sends them", async () => {
    render(
      <MemoryRouter>
        <TaskContainer
          nameKey="commonTasks.calendarEventArchival"
          taskKey={TaskKey.CALENDAR_EVENT_ARCHIVAL}
          command="curl -XPOST /calendars?task=archive"
          doc=""
          params={[
            { key: "createdBefore", defaultValue: "", type: "duration" },
            { key: "eventsPerSecond", defaultValue: "100", type: "input" },
          ]}
        />
      </MemoryRouter>
    );

    fireEvent.focus(screen.getByRole("button", { name: /^common\.run / }));

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.textContent).toBe("curl -XPOST /calendars?task=archive&eventsPerSecond=100");
  });
});
