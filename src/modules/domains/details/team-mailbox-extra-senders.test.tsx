// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import type { UserExistsStatus } from "@/hooks/use-check-user-exists";

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  toast: vi.fn(),
  userStatus: vi.fn(),
  api: {
    getTeamMailboxExtraSenders: vi.fn(),
    addTeamMailboxExtraSender: vi.fn(),
    removeTeamMailboxExtraSender: vi.fn(),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key} ${JSON.stringify(options)}` : key),
  }),
}));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => mocks.confirm }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/hooks/use-check-user-exists", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/use-check-user-exists")>()),
  useCheckUserExists: mocks.userStatus,
}));
vi.mock("../api-client", () => mocks.api);

import TeamMailboxExtraSenders from "./team-mailbox-extra-senders";

const dialog = () => screen.getByRole("dialog");
const input = () => within(dialog()).getByLabelText("domains.teamMailbox.user") as HTMLInputElement;
const addButton = () => within(dialog()).getByRole("button", { name: "common.add" }) as HTMLButtonElement;

// The + next to the section title opens the modal holding the add form
const badRequest = (message: string) =>
  new AxiosError("Request failed with status code 400", "ERR_BAD_REQUEST", undefined, undefined, {
    status: 400,
    statusText: "Bad Request",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { statusCode: 400, type: "InvalidArgument", message },
  });

const typeSender =(user: string, status: UserExistsStatus) => {
  mocks.userStatus.mockReturnValue(status);
  render(<TeamMailboxExtraSenders domain="example.com" mailbox="sales" />);
  fireEvent.click(screen.getByTitle("domains.extraSenders.addTooltip"));
  fireEvent.change(input(), { target: { value: user } });
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.api.getTeamMailboxExtraSenders.mockResolvedValue([]);
  mocks.api.addTeamMailboxExtraSender.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("team mailbox extra senders: add a sender", () => {
  it("adds an existing user typed in the modal of the + button, without confirmation", async () => {
    typeSender("alice@example.com", "exists");
    fireEvent.click(addButton());

    await waitFor(() =>
      expect(mocks.api.addTeamMailboxExtraSender).toHaveBeenCalledWith("example.com", "sales", "alice@example.com")
    );
    expect(mocks.confirm).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.toast).toHaveBeenCalledWith({ title: "domains.extraSenders.added" });
  });

  it("keeps the modal open with the typed user when the addition is refused", async () => {
    mocks.api.addTeamMailboxExtraSender.mockRejectedValue(new Error("Not allowed"));
    typeSender("alice@example.com", "exists");
    fireEvent.click(addButton());

    expect(await within(dialog()).findByText("Not allowed")).not.toBeNull();
    expect(input().value).toBe("alice@example.com");
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("keeps the modal open with the typed user and shows the reason of a 400", async () => {
    mocks.api.addTeamMailboxExtraSender.mockRejectedValue(badRequest("alice@other.org belongs to another domain"));
    typeSender("alice@other.org", "exists");
    fireEvent.click(addButton());

    expect(await within(dialog()).findByText("alice@other.org belongs to another domain")).not.toBeNull();
    expect(within(dialog()).getByText("common.serverMessage")).not.toBeNull();
    expect(input().value).toBe("alice@other.org");
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(mocks.api.getTeamMailboxExtraSenders).toHaveBeenCalledTimes(1);
  });

  it.each<[string, UserExistsStatus]>([["alice", "exists"], ["alice@", "not_found"]])(
    "disables Add and flags %s, not a mail address",
    (user, status) => {
      typeSender(user, status);

      expect(addButton().disabled).toBe(true);
      expect(within(dialog()).getByText("domains.extraSenders.invalidAddress")).not.toBeNull();
      fireEvent.submit(input());
      expect(mocks.api.addTeamMailboxExtraSender).not.toHaveBeenCalled();
    }
  );

  it("warns, without blocking, about an address of another domain", async () => {
    typeSender("alice@other.org", "exists");

    expect(within(dialog()).getByText(/domains\.extraSenders\.otherDomainWarning/)).not.toBeNull();
    fireEvent.click(addButton());
    await waitFor(() =>
      expect(mocks.api.addTeamMailboxExtraSender).toHaveBeenCalledWith("example.com", "sales", "alice@other.org")
    );
  });

  it("does not warn about an address of the team mailbox domain, whatever its case", () => {
    typeSender("alice@Example.COM", "exists");

    expect(within(dialog()).queryByText(/domains\.extraSenders\.otherDomainWarning/)).toBeNull();
    expect(within(dialog()).queryByText("domains.extraSenders.invalidAddress")).toBeNull();
  });

  it.each<UserExistsStatus>(["invalid", "checking"])("disables Add while the user is %s", (status) => {
    typeSender("a@b@c", status);

    expect(addButton().disabled).toBe(true);
    fireEvent.submit(input());
    expect(mocks.api.addTeamMailboxExtraSender).not.toHaveBeenCalled();
  });

  it("asks for confirmation before adding an unknown user", async () => {
    mocks.confirm.mockResolvedValue(true);
    typeSender("ghost@example.com", "not_found");
    fireEvent.click(addButton());

    await waitFor(() =>
      expect(mocks.api.addTeamMailboxExtraSender).toHaveBeenCalledWith("example.com", "sales", "ghost@example.com")
    );
    expect(mocks.confirm.mock.calls[0][0].header).toBe("common.unknownUserTitle");
  });

  it("does not add an unknown user when the confirmation is cancelled", async () => {
    mocks.confirm.mockResolvedValue(false);
    typeSender("ghost@example.com", "not_found");
    fireEvent.click(addButton());

    await waitFor(() => expect(mocks.confirm).toHaveBeenCalled());
    expect(mocks.api.addTeamMailboxExtraSender).not.toHaveBeenCalled();
    // Still there, to correct the address
    await waitFor(() => expect(addButton().disabled).toBe(false));
    expect(input().value).toBe("ghost@example.com");
  });
});

describe("team mailbox extra senders: remove a sender", () => {
  it("toasts the reason of a 400 and keeps the row", async () => {
    mocks.confirm.mockResolvedValue(true);
    mocks.userStatus.mockReturnValue("idle");
    mocks.api.getTeamMailboxExtraSenders.mockResolvedValue(["bob@example.com"]);
    mocks.api.removeTeamMailboxExtraSender.mockRejectedValue(badRequest("bob@example.com is a team mailbox member"));
    render(<TeamMailboxExtraSenders domain="example.com" mailbox="sales" />);

    fireEvent.click(await screen.findByTitle("domains.extraSenders.removeTooltip"));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    const { title, description } = mocks.toast.mock.calls[0][0];
    expect(title).toBe("domains.extraSenders.errorRemoving");
    render(description);
    expect(screen.getByText("bob@example.com is a team mailbox member")).not.toBeNull();
    expect(screen.getByText("bob@example.com")).not.toBeNull();
  });
});
