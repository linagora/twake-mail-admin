// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const input = () => screen.getByPlaceholderText("user@domain.tld");
const addButton = () => screen.getByText("common.add") as HTMLButtonElement;

const typeSender = (user: string, status: UserExistsStatus) => {
  mocks.userStatus.mockReturnValue(status);
  render(<TeamMailboxExtraSenders domain="example.com" mailbox="sales" />);
  fireEvent.change(input(), { target: { value: user } });
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.api.getTeamMailboxExtraSenders.mockResolvedValue([]);
  mocks.api.addTeamMailboxExtraSender.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("team mailbox extra senders: add a sender", () => {
  it("adds an existing user without confirmation", async () => {
    typeSender("alice@example.com", "exists");
    fireEvent.click(addButton());

    await waitFor(() =>
      expect(mocks.api.addTeamMailboxExtraSender).toHaveBeenCalledWith("example.com", "sales", "alice@example.com")
    );
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it.each<UserExistsStatus>(["invalid", "checking"])("disables Add while the user is %s", (status) => {
    typeSender("a@b@c", status);

    expect(addButton().disabled).toBe(true);
    fireEvent.keyDown(input(), { key: "Enter" });
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
  });
});
