// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/test/resize-observer";
import { cleanup, fireEvent, render as renderComponent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ReactElement } from "react";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  confirm: vi.fn(),
  api: {
    getUserForwards: vi.fn(),
    addUserForward: vi.fn(),
    removeUserForward: vi.fn(),
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
vi.mock("../api-client", () => mocks.api);
vi.mock("@/hooks/use-managed-domains", () => ({ useManagedDomains: () => new Set(["example.com"]) }));

import UserForwards from "./user-forwards";

// The destinations link to their user pages
const render = (ui: ReactElement) => renderComponent(<MemoryRouter>{ui}</MemoryRouter>);

const ALICE = "alice@example.com";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.api.getUserForwards.mockResolvedValue([]);
});

afterEach(cleanup);

// Opens "Add forward" from the + and types a destination
const typeDestination = async (destination = "bob@example.com") => {
  fireEvent.click(screen.getByTitle("users.forwards.addTooltip"));
  fireEvent.change(await screen.findByPlaceholderText("users.forwards.placeholder"), { target: { value: destination } });
};
const submit = () => fireEvent.click(screen.getByRole("button", { name: "common.add" }));

describe("user forwards: add a forward", () => {
  it("opens the section and a modal from the +, and adds the typed destination", async () => {
    mocks.api.addUserForward.mockResolvedValue(undefined);
    render(<UserForwards username={ALICE} />);
    await typeDestination(" bob@example.com ");

    const dialog = screen.getByRole("dialog");
    expect(screen.getByText("users.forwards.title").closest("button")?.getAttribute("aria-expanded")).toBe("true");
    submit();

    await waitFor(() => expect(mocks.api.addUserForward).toHaveBeenCalledWith(ALICE, "bob@example.com"));
    // A copy is kept by default: alice is added as a destination too
    await waitFor(() => expect(mocks.api.addUserForward).toHaveBeenCalledWith(ALICE, ALICE));
    await waitFor(() => expect(dialog.isConnected).toBe(false));
    expect(mocks.toast).toHaveBeenCalledWith({ title: "users.forwards.added" });
  });

  it("keeps the modal open with the typed destination when the forward is refused", async () => {
    mocks.api.addUserForward.mockRejectedValue(new Error("Forbidden"));
    render(<UserForwards username={ALICE} />);
    await typeDestination();
    submit();

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect((screen.getByPlaceholderText("users.forwards.placeholder") as HTMLInputElement).value).toBe("bob@example.com");
    expect(mocks.toast).not.toHaveBeenCalled();
  });
});

describe("user forwards: keep a copy", () => {

  it("only forwards when the copy is unticked, and says so", async () => {
    mocks.api.addUserForward.mockResolvedValue(undefined);
    render(<UserForwards username={ALICE} />);
    await typeDestination();

    fireEvent.click(screen.getByRole("checkbox", { name: /users.forwards.keepCopyIn/ }));
    expect(screen.getByText(/users.forwards.onlyForwardedHint/)).not.toBeNull();
    submit();

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({ title: "users.forwards.added" }));
    expect(mocks.api.addUserForward).toHaveBeenCalledTimes(1);
    expect(mocks.api.addUserForward).toHaveBeenCalledWith(ALICE, "bob@example.com");
  });

  it("does not ask again when a copy is already kept", async () => {
    mocks.api.getUserForwards.mockResolvedValue([{ mailAddress: ALICE }, { mailAddress: "emma@example.com" }]);
    render(<UserForwards username={ALICE} />);
    await typeDestination();

    expect(screen.queryByRole("checkbox", { name: /users.forwards.keepCopyIn/ })).toBeNull();
  });

  it("does not report success when keeping the copy is refused", async () => {
    mocks.api.addUserForward.mockImplementation(async (_user: string, destination: string) => {
      if (destination === ALICE) throw new Error("Forbidden");
    });
    render(<UserForwards username={ALICE} />);
    await typeDestination();
    submit();

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("lists only the other destinations and warns when no copy is kept", async () => {
    mocks.api.getUserForwards.mockResolvedValue([{ mailAddress: "emma@example.com" }]);
    render(<UserForwards username={ALICE} />);
    fireEvent.click(screen.getByText("users.forwards.title"));

    expect(await screen.findByText(/users.forwards.onlyForwarded /)).not.toBeNull();
    expect(screen.getByText("(1)")).not.toBeNull();
  });

  it("does not count nor list the user's own address", async () => {
    mocks.api.getUserForwards.mockResolvedValue([{ mailAddress: ALICE }, { mailAddress: "emma@example.com" }]);
    render(<UserForwards username={ALICE} />);
    fireEvent.click(screen.getByText("users.forwards.title"));

    expect(await screen.findByText("emma@example.com")).not.toBeNull();
    expect(screen.getByText("(1)")).not.toBeNull();
    expect(screen.queryByText(ALICE)).toBeNull();
    expect(screen.queryByText(/users.forwards.onlyForwarded /)).toBeNull();
  });
});

describe("user forwards: destinations", () => {
  it("links a local destination to its user page, not an external one", async () => {
    mocks.api.getUserForwards.mockResolvedValue([{ mailAddress: "emma@example.com" }, { mailAddress: "someone@gmail.com" }]);
    render(<UserForwards username={ALICE} />);
    fireEvent.click(screen.getByText("users.forwards.title"));

    expect((await screen.findByRole("link", { name: "emma@example.com" })).getAttribute("href")).toBe("/users/user/emma%40example.com");
    expect(screen.getByText("someone@gmail.com").closest("a")).toBeNull();
  });
});

describe("user forwards: remove a forward", () => {
  const removeEmma = async () => {
    render(<UserForwards username={ALICE} />);
    fireEvent.click(screen.getByText("users.forwards.title"));
    await screen.findByText("emma@example.com");
    mocks.confirm.mockResolvedValue(true);
    fireEvent.click(screen.getAllByTitle("users.forwards.removeTooltip")[0]);
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({ title: "users.forwards.removed" }));
  };

  it("also removes the copy kept for the user with the last forward", async () => {
    mocks.api.getUserForwards.mockResolvedValue([{ mailAddress: ALICE }, { mailAddress: "emma@example.com" }]);
    await removeEmma();
    expect(mocks.api.removeUserForward.mock.calls).toEqual([[ALICE, "emma@example.com"], [ALICE, ALICE]]);
  });

  it("keeps the copy while another forward remains", async () => {
    mocks.api.getUserForwards.mockResolvedValue([{ mailAddress: ALICE }, { mailAddress: "emma@example.com" }, { mailAddress: "zoe@example.com" }]);
    await removeEmma();
    expect(mocks.api.removeUserForward.mock.calls).toEqual([[ALICE, "emma@example.com"]]);
  });
});
