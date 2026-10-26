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
  fireEvent.click(screen.getByTitle("users.delegation.addTooltip"));
  fireEvent.change(await screen.findByPlaceholderText("users.delegation.placeholder"), { target: { value: user } });
};

const addButton = () => screen.getByRole("button", { name: "common.add" }) as HTMLButtonElement;
const field = () => screen.getByPlaceholderText("users.delegation.placeholder") as HTMLInputElement;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.api.getDelegatedUsers.mockResolvedValue([]);
  mocks.api.addDelegatedUser.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("user delegation: add a delegated user", () => {
  it("opens the section and a modal from the +, and adds an existing user without confirmation", async () => {
    await typeDelegatedUser(ALICE, "exists");

    const dialog = screen.getByRole("dialog");
    expect(screen.getByText("users.delegation.title").closest("button")?.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("common.userExists")).toBeTruthy();
    fireEvent.click(addButton());

    await waitFor(() => expect(mocks.api.addDelegatedUser).toHaveBeenCalledWith(BOB, ALICE));
    expect(mocks.confirm).not.toHaveBeenCalled();
    await waitFor(() => expect(dialog.isConnected).toBe(false));
    expect(mocks.toast).toHaveBeenCalledWith({ title: "users.delegation.added" });
  });

  it("keeps the modal open with the typed user when the delegation is refused", async () => {
    mocks.api.addDelegatedUser.mockRejectedValue(new Error("Forbidden"));
    await typeDelegatedUser(ALICE, "exists");
    fireEvent.click(addButton());

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(field().value).toBe(ALICE);
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("refuses to delegate the user to themself", async () => {
    await typeDelegatedUser(" BOB@example.com ", "exists");

    expect(screen.getByText("users.delegation.selfDelegation")).toBeTruthy();
    expect(addButton().disabled).toBe(true);
    fireEvent.submit(field().closest("form")!);
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
    await waitFor(() => expect(addButton().disabled).toBe(false));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(field().value).toBe("ghost@example.com");
  });
});

describe("user delegation: a long address fits a phone screen", () => {
  it("lets the description break inside the user's address", async () => {
    render(<UserDelegation username="a.very.long.qa.address.for.the.bar@example.com" />);
    fireEvent.click(screen.getByText("users.delegation.title"));

    const description = await screen.findByText(/^users\.delegation\.description/);
    expect(description.className).toContain("[overflow-wrap:anywhere]");
  });
});
