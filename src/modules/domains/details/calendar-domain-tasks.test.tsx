// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, within, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ConfirmProvider } from "@/components/custom/confirm-provider";

const api = vi.hoisted(() => ({
  deleteAllUsersData: vi.fn(),
  syncDomainMembers: vi.fn(),
  republishDomainContacts: vi.fn(),
}));
const toast = vi.hoisted(() => vi.fn());

vi.mock("../api-client", () => api);
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

import CalendarDomainTasks from "./calendar-domain-tasks";

const DOMAIN = "open-paas.org";

const openRepublishDialog = () => {
  render(
    <MemoryRouter>
      <ConfirmProvider>
        <CalendarDomainTasks domain={DOMAIN} defaultOpen />
      </ConfirmProvider>
    </MemoryRouter>
  );
  const row = screen.getByText("domains.calendarTasks.republishContactsButton").closest("[data-task-row]") as HTMLElement;
  fireEvent.click(within(row).getByRole("button", { name: /^common\.run / }));
};

const contactsPerSecondInput = () => screen.getByLabelText("contactsPerSecond (common.optional)") as HTMLInputElement;
const clickConfirm = () => fireEvent.click(screen.getByRole("button", { name: /^(confirmTask.start|commonTasks.archiveAllEvents)$/ }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("calendar domain tasks: republish contacts dialog", () => {
  it("stays open with the typed values when the request fails", async () => {
    api.republishDomainContacts.mockRejectedValueOnce(new Error("POST /domains/open-paas.org/contacts can not be found"));
    openRepublishDialog();
    fireEvent.change(contactsPerSecondInput(), { target: { value: "7" } });

    clickConfirm();

    expect((await screen.findByRole("alert")).textContent).toContain("can not be found");
    expect(screen.getByText("domains.calendarTasks.republishContactsTitle")).not.toBeNull();
    expect(contactsPerSecondInput().value).toBe("7");
    expect(toast).not.toHaveBeenCalled();
  });

  it("closes once the request is accepted", async () => {
    api.republishDomainContacts.mockResolvedValueOnce({ taskId: "task-1" });
    openRepublishDialog();
    fireEvent.change(contactsPerSecondInput(), { target: { value: "7" } });

    clickConfirm();

    await waitFor(() => expect(screen.queryByText("domains.calendarTasks.republishContactsTitle")).toBeNull());
    expect(api.republishDomainContacts).toHaveBeenCalledWith(DOMAIN, expect.objectContaining({ contactsPerSecond: "7" }));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "common.taskCreated" }));
  });
});

describe("calendar domain tasks: sync domain members dialog", () => {
  it("stays open and shows the refusal in the dialog, not in a toast", async () => {
    api.syncDomainMembers.mockRejectedValueOnce(new Error("POST /addressbook/domain-members/open-paas.org can not be found"));
    render(
      <MemoryRouter>
        <ConfirmProvider>
          <CalendarDomainTasks domain={DOMAIN} defaultOpen />
        </ConfirmProvider>
      </MemoryRouter>
    );
    const row = screen.getByText("domains.calendarTasks.syncButton").closest("[data-task-row]") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: /^common\.run / }));
    fireEvent.click(screen.getByRole("button", { name: "common.confirm" }));

    expect((await screen.findByRole("alert")).textContent).toContain("can not be found");
    expect(screen.getByText("domains.calendarTasks.syncTitle")).not.toBeNull();
    expect(toast).not.toHaveBeenCalled();
  });
});
