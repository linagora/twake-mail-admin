// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ReactElement } from "react";

const GROUP = "org.apache.james.vault.DeletedMessageVaultDeletionListener$DeletedMessageVaultListenerGroup";

const api = vi.hoisted(() => ({
  getMailboxListenerGroups: vi.fn(() => Promise.resolve(["org.apache.james.SomeGroup"])),
  getFailedEvents: vi.fn(() => Promise.resolve(["event-1"])),
  deleteAllEventsForGroup: vi.fn(),
  redeliverGroupEvents: vi.fn(() => Promise.resolve({ taskId: "task-1" })),
  deleteEvent: vi.fn(),
}));

type ParamsCallback = (key: string, value: string | boolean) => void;

interface ConfirmOptions {
  header: string;
  message: ReactElement<{ getParamValues: ParamsCallback }>;
}

const dialog = vi.hoisted(() => ({
  accepted: false,
  typedValues: {} as Record<string, string>,
  options: undefined as ConfirmOptions | undefined,
}));
const toast = vi.hoisted(() => vi.fn());

vi.mock("./api-client", () => api);
vi.mock("./search-by-event-id", () => ({ default: () => null }));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/hooks/use-confirm", () => ({
  useConfirm: () => async (options: ConfirmOptions) => {
    dialog.options = options;
    Object.entries(dialog.typedValues).forEach(([key, value]) => options.message.props.getParamValues(key, value));
    return dialog.accepted;
  },
}));

import EventListenersList from "./eventl-listeners-list";

const renderList = () =>
  render(
    <MemoryRouter>
      <EventListenersList />
    </MemoryRouter>
  );

const clickRedeliver = async () =>
  fireEvent.click(await screen.findByRole("button", { name: "eventDeadletter.redeliverGroupAction" }));

beforeEach(() => {
  dialog.accepted = false;
  dialog.typedValues = {};
  dialog.options = undefined;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("event dead letter groups", () => {
  it("names the redeliver and clear buttons of each group", async () => {
    renderList();

    const redeliver = await screen.findByRole("button", { name: "eventDeadletter.redeliverGroupAction" });
    const clear = screen.getByRole("button", { name: "eventDeadletter.clearGroupAction" });

    expect(redeliver.getAttribute("title")).toBe("eventDeadletter.redeliverGroupAction");
    expect(clear.getAttribute("title")).toBe("eventDeadletter.clearGroupAction");
  });

  it("previews the redeliver request actually sent for the group", async () => {
    api.getMailboxListenerGroups.mockResolvedValueOnce([GROUP]);
    renderList();
    await clickRedeliver();
    await waitFor(() => expect(dialog.options).toBeDefined());
    cleanup();

    render(<>{dialog.options?.message}</>);
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "1" } });

    expect(dialog.options?.header).toBe("eventDeadletter.redeliverGroupAction");
    expect(screen.getByText(/curl -XPOST/).textContent).toContain(
      "curl -XPOST /events/deadLetter/groups/org.apache.james.vault.DeletedMessageVaultDeletionListener%24DeletedMessageVaultListenerGroup?action=reDeliver&limit=1"
    );
    expect(screen.queryByText(/redeliver_group_events/)).toBeNull();
  });

  it("sends the limit and maxRetries typed in the redeliver dialog", async () => {
    dialog.accepted = true;
    dialog.typedValues = { limit: "1", maxRetries: " 3 " };
    renderList();

    await clickRedeliver();

    await waitFor(() =>
      expect(api.redeliverGroupEvents).toHaveBeenCalledWith("org.apache.james.SomeGroup", {
        limit: 1,
        maxRetries: 3,
      })
    );
  });

  it("leaves out the redeliver parameters left empty", async () => {
    dialog.accepted = true;
    dialog.typedValues = { limit: "", maxRetries: "" };
    renderList();

    await clickRedeliver();

    await waitFor(() =>
      expect(api.redeliverGroupEvents).toHaveBeenCalledWith("org.apache.james.SomeGroup", {
        limit: undefined,
        maxRetries: undefined,
      })
    );
  });

  it("does not redeliver when the dialog is cancelled", async () => {
    renderList();

    await clickRedeliver();

    await waitFor(() => expect(api.getFailedEvents).toHaveBeenCalled());
    expect(api.redeliverGroupEvents).not.toHaveBeenCalled();
  });

  it("shows an error toast when the redelivery is refused", async () => {
    dialog.accepted = true;
    api.redeliverGroupEvents.mockRejectedValueOnce(new Error("Bad request"));
    renderList();

    await clickRedeliver();

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "eventDeadletter.runTaskError", variant: "destructive" })
      )
    );
  });
});
