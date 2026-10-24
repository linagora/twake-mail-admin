// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
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
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("../api-client", () => mocks.api);

import UserMailboxes from "./user-mailboxes";

const ALICE = "alice@example.com";

beforeEach(() => {
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
