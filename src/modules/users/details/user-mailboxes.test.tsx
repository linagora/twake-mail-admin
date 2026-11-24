// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  confirm: vi.fn(),
  awaitTask: vi.fn(),
  api: {
    getUserMailboxes: vi.fn(),
    createUserMailbox: vi.fn(),
    deleteUserMailbox: vi.fn(),
    clearMailboxContent: vi.fn(),
    getMailboxMessageCount: vi.fn(),
    getMailboxUnseenCount: vi.fn(),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key} ${JSON.stringify(options)}` : key),
  }),
}));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => mocks.confirm }));
vi.mock("@/modules/common-tasks/api-client", () => ({ awaitTask: mocks.awaitTask }));
vi.mock("@/hooks/use-toast", () => ({ toast: mocks.toast, useToast: () => ({ toast: mocks.toast }) }));
vi.mock("../api-client", () => mocks.api);

import UserMailboxes from "./user-mailboxes";
import { markFeatureUnavailable } from "@/lib/unavailable-features";

const ALICE = "alice@example.com";

beforeEach(() => {
  sessionStorage.clear();
  vi.resetAllMocks();
  mocks.api.getUserMailboxes.mockResolvedValue([]);
  mocks.api.getMailboxMessageCount.mockResolvedValue(0);
  mocks.api.getMailboxUnseenCount.mockResolvedValue(0);
});

afterEach(cleanup);

const renderMailboxes = () => render(<MemoryRouter><UserMailboxes username={ALICE} /></MemoryRouter>);

describe("user mailboxes: create a mailbox", () => {
  it("opens the section and a modal from the +, and creates the typed mailbox", async () => {
    mocks.api.createUserMailbox.mockResolvedValue(undefined);
    renderMailboxes();
    fireEvent.click(screen.getByTitle("users.mailboxes.createTooltip"));

    const dialog = await screen.findByRole("dialog");
    expect(screen.getByText("users.mailboxes.title").closest("button")?.getAttribute("aria-expanded")).toBe("true");
    fireEvent.change(screen.getByLabelText("users.mailboxes.nameLabel"), { target: { value: " INBOX.work " } });
    fireEvent.click(screen.getByRole("button", { name: "common.create" }));

    await waitFor(() => expect(mocks.api.createUserMailbox).toHaveBeenCalledWith(ALICE, "INBOX.work"));
    await waitFor(() => expect(dialog.isConnected).toBe(false));
    expect(mocks.toast).toHaveBeenCalledWith({ title: "users.mailboxes.created" });
  });

  it("keeps the modal open with the typed name when the creation is refused", async () => {
    mocks.api.createUserMailbox.mockRejectedValue(new Error("Mailbox already exists"));
    renderMailboxes();
    fireEvent.click(screen.getByTitle("users.mailboxes.createTooltip"));
    fireEvent.change(await screen.findByLabelText("users.mailboxes.nameLabel"), { target: { value: "INBOX" } });
    fireEvent.click(screen.getByRole("button", { name: "common.create" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect((screen.getByLabelText("users.mailboxes.nameLabel") as HTMLInputElement).value).toBe("INBOX");
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it.each(["INBOX", "inbox"])("refuses %s when INBOX exists, without sending it", async (name) => {
    mocks.api.getUserMailboxes.mockResolvedValue([{ mailboxName: "INBOX", mailboxId: "1" }]);
    renderMailboxes();
    await waitFor(() => expect(mocks.api.getUserMailboxes).toHaveBeenCalled());
    fireEvent.click(screen.getByTitle("users.mailboxes.createTooltip"));
    fireEvent.change(await screen.findByLabelText("users.mailboxes.nameLabel"), { target: { value: name } });
    fireEvent.click(screen.getByRole("button", { name: "common.create" }));

    expect((await screen.findByRole("alert")).textContent).toContain("users.mailboxes.alreadyExists");
    expect(mocks.api.createUserMailbox).not.toHaveBeenCalled();
  });
});

describe("user mailboxes: message search link", () => {
  it("links to the message search of the user", () => {
    renderMailboxes();
    expect(screen.getByTitle("users.mailboxes.searchMessages").getAttribute("href")).toBe(`/users/user/${encodeURIComponent(ALICE)}/message-search`);
  });

  it("is disabled, saying why, once message search was found missing on this server", () => {
    markFeatureUnavailable("messageSearch");
    renderMailboxes();

    const button = screen.getByRole("button", { name: "users.mailboxes.searchMessages" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-description")).toBe("users.messageSearch.unavailableTitle");
    expect(screen.queryByRole("link", { name: "users.mailboxes.searchMessages" })).toBeNull();
  });

  it("says why message search is disabled on a tap, not in a native title", () => {
    markFeatureUnavailable("messageSearch");
    renderMailboxes();
    const wrapper = screen.getByRole("button", { name: "users.mailboxes.searchMessages" }).parentElement!;

    expect(wrapper.getAttribute("title")).toBeNull();
    fireEvent.click(wrapper);
    expect(screen.getByRole("tooltip").textContent).toBe("users.messageSearch.unavailableTitle");
  });
});

describe("user mailboxes: clear the content of a mailbox", () => {
  const TASK_ID = "58ae73fa-5585-417c-b320-1c19667b4743";

  it("shows the counters of the cleared mailbox again once its task ended", async () => {
    mocks.api.getUserMailboxes.mockResolvedValue([{ mailboxName: "INBOX", mailboxId: "1" }]);
    mocks.api.getMailboxMessageCount.mockResolvedValueOnce(1).mockResolvedValue(0);
    mocks.api.getMailboxUnseenCount.mockResolvedValueOnce(1).mockResolvedValue(0);
    mocks.api.clearMailboxContent.mockResolvedValue({ taskId: TASK_ID });
    mocks.confirm.mockResolvedValue(true);
    mocks.awaitTask.mockResolvedValue({ taskId: TASK_ID, type: "ClearMailboxContentTask", status: "completed" });
    renderMailboxes();
    fireEvent.click(screen.getByText("users.mailboxes.title"));
    await waitFor(() => expect(mocks.api.getMailboxMessageCount).toHaveBeenCalledTimes(1));

    fireEvent.click(await screen.findByTitle("users.mailboxes.clearTooltip"));

    await waitFor(() => expect(mocks.api.clearMailboxContent).toHaveBeenCalledWith(ALICE, "INBOX"));
    await waitFor(() => expect(mocks.api.getMailboxMessageCount).toHaveBeenCalledTimes(2));
    expect(mocks.api.getMailboxUnseenCount).toHaveBeenCalledTimes(2);
    expect(mocks.awaitTask).toHaveBeenCalledWith(TASK_ID, undefined);
  });
});
