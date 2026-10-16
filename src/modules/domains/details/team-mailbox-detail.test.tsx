// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
vi.mock("@/modules/users/details/user-deleted-message-vault", () => ({ default: () => null }));

import TeamMailboxDetail from "./team-mailbox-detail";

const input = () => screen.getByPlaceholderText("user@domain.tld");
const roleSelect = () => screen.getByLabelText("domains.teamMailbox.role") as HTMLSelectElement;
const addButton = () => screen.getByText("common.add") as HTMLButtonElement;

const typeMember = (user: string, status: UserExistsStatus) => {
  mocks.userStatus.mockReturnValue(status);
  render(<TeamMailboxDetail />);
  fireEvent.change(input(), { target: { value: user } });
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.api.getTeamMailboxMembers.mockResolvedValue([]);
  mocks.api.addTeamMailboxMember.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("team mailbox members: add a member", () => {
  it("adds an existing user without confirmation", async () => {
    typeMember("alice@example.com", "exists");
    fireEvent.click(addButton());

    await waitFor(() =>
      expect(mocks.api.addTeamMailboxMember).toHaveBeenCalledWith("example.com", "sales", "alice@example.com", "member")
    );
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it.each<UserExistsStatus>(["invalid", "checking"])("disables Add while the user is %s", (status) => {
    typeMember("a@b@c", status);

    expect(addButton().disabled).toBe(true);
    fireEvent.keyDown(input(), { key: "Enter" });
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
  });

  it("resets the role to member after an addition", async () => {
    typeMember("alice@example.com", "exists");
    fireEvent.change(roleSelect(), { target: { value: "manager" } });
    fireEvent.click(addButton());

    await waitFor(() =>
      expect(mocks.api.addTeamMailboxMember).toHaveBeenCalledWith("example.com", "sales", "alice@example.com", "manager")
    );
    await waitFor(() => expect(roleSelect().value).toBe("member"));
  });
});
