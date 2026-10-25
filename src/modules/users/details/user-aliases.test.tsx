// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  accounts: new Set<string>(),
  api: {
    getUserAliases: vi.fn(),
    addUserAlias: vi.fn(),
    removeUserAlias: vi.fn(),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key} ${JSON.stringify(options)}` : key),
  }),
}));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => vi.fn(async () => true) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../api-client", () => mocks.api);
vi.mock("@/hooks/use-check-user-exists", () => ({
  useCheckUserExists: (value: string) =>
    !value.trim() ? "idle" : value.trim() === "pending@example.com" ? "checking" : mocks.accounts.has(value.trim()) ? "exists" : "not_found",
}));

import UserAliases from "./user-aliases";

const ALICE = "alice@example.com";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.accounts.clear();
  mocks.accounts.add(ALICE);
  mocks.accounts.add("bob@example.com");
  mocks.api.getUserAliases.mockResolvedValue([]);
  mocks.api.addUserAlias.mockResolvedValue(undefined);
});

afterEach(cleanup);

const openAddDialog = async (alias: string) => {
  render(<UserAliases username={ALICE} />);
  fireEvent.click(await screen.findByTitle("users.aliases.addTooltip"));
  fireEvent.change(screen.getByLabelText("users.aliases.fieldLabel"), { target: { value: alias } });
};
const addButton = () => screen.getByRole("button", { name: "common.add" }) as HTMLButtonElement;

describe("user aliases: the alias address is checked against the accounts", () => {
  it("refuses an existing account, naming the user its mail would be diverted to", async () => {
    await openAddDialog("bob@example.com");

    expect(screen.getByRole("alert").textContent).toBe(
      `common.sourceIsAccount ${JSON.stringify({ source: "bob@example.com", destination: ALICE })}`
    );
    expect(addButton().disabled).toBe(true);
    fireEvent.submit(addButton().closest("form")!);
    expect(mocks.api.addUserAlias).not.toHaveBeenCalled();
  });

  it("waits for the check before allowing the creation", async () => {
    await openAddDialog("pending@example.com");

    expect(screen.getByText("common.checking")).not.toBeNull();
    expect(addButton().disabled).toBe(true);
  });

  it("adds an address that is not an account, without any warning", async () => {
    await openAddDialog("bob.alias@example.com");

    expect(screen.queryByRole("alert")).toBeNull();
    expect(addButton().disabled).toBe(false);
    fireEvent.click(addButton());
    await vi.waitFor(() => expect(mocks.api.addUserAlias).toHaveBeenCalledWith(ALICE, "bob.alias@example.com"));
  });
});
