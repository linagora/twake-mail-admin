// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { AxiosError, AxiosHeaders } from "axios";
import type { UserExistsStatus } from "@/hooks/use-check-user-exists";

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  toast: vi.fn(),
  userStatus: vi.fn(),
  api: {
    getTeamMailboxMembers: vi.fn(),
    addTeamMailboxMember: vi.fn(),
    removeTeamMailboxMember: vi.fn(),
    searchTeamMailboxDeletedMessages: vi.fn(),
    restoreTeamMailboxDeletedMessages: vi.fn(),
  },
}));

// The page header is covered by its own tests; only its actions (Expand all / Collapse all) matter here
vi.mock("@/components/custom/header", () => ({ default: ({ actions }: { actions?: ReactNode }) => actions ?? null }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key} ${JSON.stringify(options)}` : key),
  }),
}));
vi.mock("react-router", () => ({ useParams: () => ({ domain: "example.com", mailbox: "sales" }) }));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => mocks.confirm }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/hooks/use-check-user-exists", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/use-check-user-exists")>()),
  useCheckUserExists: mocks.userStatus,
}));
vi.mock("../api-client", () => mocks.api);
vi.mock("./team-mailbox-folders", () => ({ default: () => null }));
vi.mock("./team-mailbox-quota", () => ({ default: () => null }));
vi.mock("./team-mailbox-extra-senders", () => ({ default: () => null }));
vi.mock("./team-mailbox-space", () => ({ default: () => null }));
vi.mock("@/modules/users/details/user-deleted-message-vault", () => ({ default: () => null }));

import TeamMailboxDetail from "./team-mailbox-detail";

const dialog = () => screen.getByRole("dialog");
const input = () => within(dialog()).getByLabelText("domains.teamMailbox.user") as HTMLInputElement;
const roleSelect = () => within(dialog()).getByLabelText("domains.teamMailbox.role") as HTMLSelectElement;
const addButton = () => within(dialog()).getByRole("button", { name: "common.add" }) as HTMLButtonElement;

// The + next to the section title opens the modal holding the add form
const typeMember = (user: string, status: UserExistsStatus) => {
  mocks.userStatus.mockReturnValue(status);
  render(<TeamMailboxDetail />);
  fireEvent.click(screen.getByTitle("domains.teamMailbox.addMember"));
  fireEvent.change(input(), { target: { value: user } });
};

const webAdminError = (message: string) =>
  new AxiosError("Request failed with status code 400", "ERR_BAD_REQUEST", undefined, undefined, {
    status: 400,
    statusText: "Bad Request",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { statusCode: 400, type: "InvalidArgument", message, details: message },
  });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.api.getTeamMailboxMembers.mockResolvedValue([]);
  mocks.api.addTeamMailboxMember.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("team mailbox: Expand all / Collapse all", () => {
  it("also folds and unfolds the members section", async () => {
    render(<TeamMailboxDetail />);
    const members = () => screen.getByRole("button", { name: /domains.teamMailbox.members/ });
    expect(members().getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(await screen.findByRole("button", { name: "common.collapseAll" }));
    await waitFor(() => expect(members().getAttribute("aria-expanded")).toBe("false"));

    fireEvent.click(screen.getByRole("button", { name: "common.expandAll" }));
    await waitFor(() => expect(members().getAttribute("aria-expanded")).toBe("true"));
  });
});

describe("team mailbox members: add a member", () => {
  it("adds an existing user typed in the modal of the + button, without confirmation", async () => {
    typeMember("alice@example.com", "exists");
    fireEvent.click(addButton());

    await waitFor(() =>
      expect(mocks.api.addTeamMailboxMember).toHaveBeenCalledWith("example.com", "sales", "alice@example.com", "member")
    );
    expect(mocks.confirm).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("keeps the modal open with the typed user when the addition is refused", async () => {
    mocks.api.addTeamMailboxMember.mockRejectedValue(new Error("Not allowed"));
    typeMember("alice@example.com", "exists");
    fireEvent.click(addButton());

    expect(await within(dialog()).findByText("Not allowed")).not.toBeNull();
    expect(input().value).toBe("alice@example.com");
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it.each<UserExistsStatus>(["invalid", "checking"])("disables Add while the user is %s", (status) => {
    typeMember("a@b@c", status);

    expect(addButton().disabled).toBe(true);
    fireEvent.submit(input());
    expect(mocks.api.addTeamMailboxMember).not.toHaveBeenCalled();
  });

  it("asks for confirmation before adding an unknown user", async () => {
    mocks.confirm.mockResolvedValue(true);
    typeMember("ghost@example.com", "not_found");
    fireEvent.click(addButton());

    await waitFor(() =>
      expect(mocks.api.addTeamMailboxMember).toHaveBeenCalledWith("example.com", "sales", "ghost@example.com", "member")
    );
    expect(mocks.confirm.mock.calls[0][0].header).toBe("common.unknownUserTitle");
  });

  it("does not add an unknown user when the confirmation is cancelled", async () => {
    mocks.confirm.mockResolvedValue(false);
    typeMember("ghost@example.com", "not_found");
    fireEvent.click(addButton());

    await waitFor(() => expect(mocks.confirm).toHaveBeenCalled());
    expect(mocks.api.addTeamMailboxMember).not.toHaveBeenCalled();
    // Still there, to correct the address
    await waitFor(() => expect(addButton().disabled).toBe(false));
    expect(input().value).toBe("ghost@example.com");
  });

  it("shows the server message of a 400 refusing a member of another domain, the list unchanged", async () => {
    mocks.api.addTeamMailboxMember.mockRejectedValue(webAdminError("User bob@other.org does not belong to domain example.com"));
    typeMember("bob@other.org", "exists");
    fireEvent.click(addButton());

    expect(await within(dialog()).findByText("User bob@other.org does not belong to domain example.com")).not.toBeNull();
    expect(input().value).toBe("bob@other.org");
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(mocks.api.getTeamMailboxMembers).toHaveBeenCalledTimes(1);
    expect(screen.getByText("domains.teamMailbox.noMembers")).not.toBeNull();
  });

  it("resets the role to member after an addition", async () => {
    typeMember("alice@example.com", "exists");
    fireEvent.change(roleSelect(), { target: { value: "manager" } });
    fireEvent.click(addButton());

    await waitFor(() =>
      expect(mocks.api.addTeamMailboxMember).toHaveBeenCalledWith("example.com", "sales", "alice@example.com", "manager")
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByTitle("domains.teamMailbox.addMember"));
    expect(roleSelect().value).toBe("member");
  });
});

describe("team mailbox members: member of another domain", () => {
  const hint = () => within(dialog()).queryByText(/domains.teamMailbox.otherDomainHint/);

  it("warns, tied to the field, that the server may refuse a user of another domain", () => {
    typeMember("bob@other.org", "exists");

    expect(hint()?.textContent).toBe('domains.teamMailbox.otherDomainHint {"domain":"example.com"}');
    expect(input().getAttribute("aria-describedby")).toBe(hint()?.id);
    // Cross-domain sharing may be enabled: the operator can still try
    expect(addButton().disabled).toBe(false);
  });

  it.each(["alice@example.com", "alice@EXAMPLE.com", "alice"])("does not warn for %s", (user) => {
    typeMember(user, "exists");

    expect(hint()).toBeNull();
    expect(input().getAttribute("aria-describedby")).toBeNull();
  });
});
