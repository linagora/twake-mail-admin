// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { UserExistsStatus } from "@/hooks/use-check-user-exists";

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  toast: vi.fn(),
  userStatus: vi.fn(),
  api: {
    getDelegatedUsers: vi.fn(),
    addDelegatedUser: vi.fn(),
    removeDelegatedUser: vi.fn(),
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
vi.mock("@/hooks/use-check-user-exists", () => ({ useCheckUserExists: mocks.userStatus }));
vi.mock("../api-client", () => mocks.api);

import UserDelegation from "./user-delegation";

const BOB = "bob@example.com";
const ALICE = "alice@example.com";

const typeDelegatedUser = async (user: string, status: UserExistsStatus) => {
  mocks.userStatus.mockReturnValue(status);
  render(<UserDelegation username={BOB} />);
  fireEvent.click(screen.getByText("users.delegation.title"));
  fireEvent.click(await screen.findByTitle("users.delegation.addTooltip"));
  fireEvent.change(screen.getByPlaceholderText("users.delegation.placeholder"), { target: { value: user } });
};

const addButton = () => screen.getByText("common.add") as HTMLButtonElement;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.api.getDelegatedUsers.mockResolvedValue([]);
  mocks.api.addDelegatedUser.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("user delegation: add a delegated user", () => {
  it("adds an existing user without confirmation", async () => {
    await typeDelegatedUser(ALICE, "exists");
    fireEvent.click(addButton());

    await waitFor(() => expect(mocks.api.addDelegatedUser).toHaveBeenCalledWith(BOB, ALICE));
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it("refuses to delegate the user to themself", async () => {
    await typeDelegatedUser(" BOB@example.com ", "exists");

    expect(screen.getByText("users.delegation.selfDelegation")).toBeTruthy();
    expect(addButton().disabled).toBe(true);
    fireEvent.keyDown(screen.getByPlaceholderText("users.delegation.placeholder"), { key: "Enter" });
    expect(mocks.api.addDelegatedUser).not.toHaveBeenCalled();
  });

  it.each<UserExistsStatus>(["invalid", "checking"])("disables Add while the user is %s", async (status) => {
    await typeDelegatedUser("not an email", status);

    expect(addButton().disabled).toBe(true);
  });

  it("asks for confirmation before delegating to an unknown user", async () => {
    mocks.confirm.mockResolvedValue(true);
    await typeDelegatedUser("ghost@example.com", "not_found");
    fireEvent.click(addButton());

    await waitFor(() => expect(mocks.api.addDelegatedUser).toHaveBeenCalledWith(BOB, "ghost@example.com"));
    expect(mocks.confirm.mock.calls[0][0].header).toBe("users.delegation.unknownUserTitle");
  });

  it("does not delegate to an unknown user when the confirmation is cancelled", async () => {
    mocks.confirm.mockResolvedValue(false);
    await typeDelegatedUser("ghost@example.com", "not_found");
    fireEvent.click(addButton());

    await waitFor(() => expect(mocks.confirm).toHaveBeenCalled());
    expect(mocks.api.addDelegatedUser).not.toHaveBeenCalled();
  });
});
