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
  validate?: () => string | null;
  action?: () => Promise<unknown>;
}

const dialog = vi.hoisted(() => ({
  accepted: false,
  typedValues: {} as Record<string, string>,
  options: undefined as ConfirmOptions | undefined,
  actionError: undefined as unknown,
  validationError: null as string | null,
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
    if (!dialog.accepted) return false;
    // Like the confirm dialog: an invalid content is reported in the dialog, which stays open
    dialog.validationError = options.validate?.() ?? null;
    if (dialog.validationError) return false;
    // Like the confirm dialog: a failed action is reported in the dialog, which stays open
    try {
      await options.action?.();
      return true;
    } catch (err) {
      dialog.actionError = err;
      return false;
    }
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
  dialog.actionError = undefined;
  dialog.validationError = null;
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

  it.each([
    { limit: "abc", maxRetries: "" },
    { limit: "0", maxRetries: "" },
    { limit: "1.5", maxRetries: "" },
    { limit: "1", maxRetries: "-2" },
    { limit: "", maxRetries: "2e3" },
  ])("refuses to redeliver with parameters that are not positive integers: %o", async (typedValues) => {
    dialog.accepted = true;
    dialog.typedValues = typedValues;
    renderList();

    await clickRedeliver();

    await waitFor(() => expect(dialog.validationError).toBe("eventDeadletter.invalidPositiveInteger"));
    expect(api.redeliverGroupEvents).not.toHaveBeenCalled();
  });

  it("does not redeliver when the dialog is cancelled", async () => {
    renderList();

    await clickRedeliver();

    await waitFor(() => expect(api.getFailedEvents).toHaveBeenCalled());
    expect(api.redeliverGroupEvents).not.toHaveBeenCalled();
  });

  it("reports a refused redelivery in the dialog", async () => {
    dialog.accepted = true;
    const refusal = new Error("Can not parse limit");
    api.redeliverGroupEvents.mockRejectedValueOnce(refusal);
    renderList();

    await clickRedeliver();

    await waitFor(() => expect(dialog.actionError).toBe(refusal));
    expect(toast).not.toHaveBeenCalled();
  });

  it("links the started task once the redelivery is accepted", async () => {
    dialog.accepted = true;
    renderList();

    await clickRedeliver();

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "common.taskCreated" }))
    );
  });
});
