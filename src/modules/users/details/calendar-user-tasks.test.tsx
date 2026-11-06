// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ConfirmProvider } from "@/components/custom/confirm-provider";

const api = vi.hoisted(() => ({
  deleteUserData: vi.fn(),
  archiveUserCalendarEvents: vi.fn(),
  republishUserContacts: vi.fn(),
}));
const toast = vi.hoisted(() => vi.fn());

vi.mock("../api-client", () => api);
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

import CalendarUserTasks from "./calendar-user-tasks";

const USERNAME = "alice@open-paas.org";

const renderTasks = () => {
  render(
    <MemoryRouter>
      <ConfirmProvider>
        <CalendarUserTasks username={USERNAME} />
      </ConfirmProvider>
    </MemoryRouter>
  );
  fireEvent.click(screen.getByText("users.calendarTasks.title"));
};

const runTask = (label: string) => {
  const row = screen.getByText(label).closest("[data-task-row]") as HTMLElement;
  fireEvent.click(row.querySelector("button")!);
};

const paramInput = (key: string) => screen.getByLabelText(`${key} (common.optional)`) as HTMLInputElement;

const typeInto = (key: string, value: string) => fireEvent.change(paramInput(key), { target: { value } });

const clickConfirm = () => fireEvent.click(screen.getByRole("button", { name: /^(confirmTask.start|commonTasks.archiveAllEvents)$/ }));

beforeEach(() => {
  api.archiveUserCalendarEvents.mockResolvedValue({ taskId: "task-1" });
  api.republishUserContacts.mockResolvedValue({ taskId: "task-2" });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("calendar user tasks: dialogs stay open until the request is accepted", () => {
  it("keeps the archive dialog open with the typed values when WebAdmin rejects them", async () => {
    api.archiveUserCalendarEvents.mockRejectedValueOnce(new Error("Illegal value supplied for query parameter 'eventsPerSecond'"));
    renderTasks();
    runTask("users.calendarTasks.archiveButton");
    typeInto("eventsPerSecond", "abc");

    clickConfirm();

    expect((await screen.findByRole("alert")).textContent).toContain("Illegal value supplied for query parameter 'eventsPerSecond'");
    expect(screen.getByText("users.calendarTasks.archiveTitle")).not.toBeNull();
    expect(paramInput("eventsPerSecond").value).toBe("abc");
    expect(toast).not.toHaveBeenCalled();
  });

  it("sends the corrected values and closes the archive dialog once accepted", async () => {
    api.archiveUserCalendarEvents.mockRejectedValueOnce(new Error("Illegal value"));
    renderTasks();
    runTask("users.calendarTasks.archiveButton");
    typeInto("eventsPerSecond", "abc");
    clickConfirm();
    await screen.findByRole("alert");

    typeInto("eventsPerSecond", "50");
    clickConfirm();

    await waitFor(() => expect(screen.queryByText("users.calendarTasks.archiveTitle")).toBeNull());
    expect(api.archiveUserCalendarEvents).toHaveBeenLastCalledWith(USERNAME, expect.objectContaining({ eventsPerSecond: "50" }));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "common.taskCreated" }));
  });

  it("keeps the republish contacts dialog open with the typed values when the request fails", async () => {
    api.republishUserContacts.mockRejectedValueOnce(new Error("POST /users/alice%40open-paas.org/contacts can not be found"));
    renderTasks();
    runTask("users.calendarTasks.republishContactsButton");
    typeInto("contactsPerSecond", "7");

    clickConfirm();

    expect((await screen.findByRole("alert")).textContent).toContain("can not be found");
    expect(paramInput("contactsPerSecond").value).toBe("7");
    expect(api.republishUserContacts).toHaveBeenCalledWith(USERNAME, { contactsPerSecond: "7" });
    expect(toast).not.toHaveBeenCalled();
  });
});

describe("calendar user tasks: resuming a data deletion", () => {
  const STEP = "DavDomainMemberDeletionTaskStep";
  const fromStepField = () => screen.getByLabelText("deleteUserDataForm.fromStep");

  const openDeleteDialog = async () => {
    renderTasks();
    runTask("users.tasks.deleteData");
    await screen.findByLabelText("confirm.typeToConfirm");
  };

  it("previews the command without a step until one is typed", async () => {
    await openDeleteDialog();

    expect(screen.getByRole("dialog").textContent).toContain(`curl -XPOST /users/${USERNAME}?action=deleteData`);
    expect(screen.getByRole("dialog").textContent).not.toContain("&fromStep=");
  });

  it("shows the domain member step in the preview and sends it unchanged", async () => {
    api.deleteUserData.mockResolvedValueOnce({ taskId: "task-3" });
    await openDeleteDialog();

    fireEvent.change(fromStepField(), { target: { value: STEP } });

    expect(await screen.findByText(new RegExp(`action=deleteData&fromStep=${STEP}`))).not.toBeNull();

    fireEvent.change(screen.getByLabelText("confirm.typeToConfirm"), { target: { value: USERNAME } });
    fireEvent.click(screen.getByRole("button", { name: "confirm.deleteUserData" }));

    await waitFor(() => expect(api.deleteUserData).toHaveBeenCalledWith(USERNAME, STEP));
  });
});

describe("calendar user tasks: archival without criteria", () => {
  const archiveButton = () => screen.getByRole("button", { name: /^(confirmTask.start|commonTasks.archiveAllEvents)$/ });

  it("warns that every event of the user moves, on a red Archive all events", async () => {
    renderTasks();
    runTask("users.calendarTasks.archiveButton");

    expect((await screen.findByRole("status")).textContent).toBe("users.calendarTasks.archiveAllWarning");
    await waitFor(() => expect(archiveButton().textContent).toBe("commonTasks.archiveAllEvents"));
    expect(archiveButton().className).toContain("bg-destructive");
  });

  it("drops the warning once a criterion is set", async () => {
    renderTasks();
    runTask("users.calendarTasks.archiveButton");
    await screen.findByRole("status");

    typeInto("createdBefore", "30");

    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    expect(archiveButton().textContent).toBe("confirmTask.start");
    expect(archiveButton().className).not.toContain("bg-destructive");
    expect(screen.getByText(/createdBefore=30d/)).not.toBeNull();
  });
});
