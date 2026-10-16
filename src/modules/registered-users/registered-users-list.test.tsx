// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConfirmProvider } from "@/components/custom/confirm-provider";

const CHARLOTTE = { id: "6ad1aa3f53839e067b41b8c3", email: "charlotte@open-paas.org", firstname: "Charlotte", lastname: "QA" };

const api = vi.hoisted(() => ({
  getRegisteredUsers: vi.fn(),
  createRegisteredUser: vi.fn(),
  updateRegisteredUser: vi.fn(),
  deleteRegisteredUser: vi.fn(),
}));
const toast = vi.hoisted(() => vi.fn());

vi.mock("./api-client", () => api);
vi.mock("@/lib/config", () => ({ appConfig: { application: "CALENDAR", mode: "GLOBAL", sso: null } }));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/hooks/use-check-user-exists", () => ({ useCheckUserExists: () => "idle" }));
vi.mock("@/modules/domain-admin/domain-context", () => ({ useDomain: () => "" }));

import RegisteredUsersList from "./registered-users-list";

const input = (label: string) => screen.getByLabelText(label, { exact: false }) as HTMLInputElement;

const openEditDialog = async () => {
  render(
    <ConfirmProvider>
      <RegisteredUsersList />
    </ConfirmProvider>
  );
  fireEvent.click(await screen.findByTitle("registeredUsers.editTooltip"));
  await screen.findByText("registeredUsers.editTitle");
};

const confirmDialog = () => fireEvent.click(screen.getByText("common.confirm"));

beforeEach(() => {
  api.getRegisteredUsers.mockResolvedValue([CHARLOTTE]);
  api.updateRegisteredUser.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Edit registered user dialog", () => {
  it("sends the edited user and closes", async () => {
    await openEditDialog();
    fireEvent.change(input("registeredUsers.firstname"), { target: { value: "Charlie" } });
    confirmDialog();

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(api.updateRegisteredUser).toHaveBeenCalledWith(CHARLOTTE.id, { email: CHARLOTTE.email, firstname: "Charlie", lastname: "QA" }, undefined);
    expect(toast).toHaveBeenCalledWith({ title: "registeredUsers.updated" });
  });

  it("does not send a user without firstname", async () => {
    await openEditDialog();
    fireEvent.change(input("registeredUsers.firstname"), { target: { value: "" } });
    confirmDialog();

    expect((await screen.findByRole("alert")).textContent).toBe("registeredUsers.firstnameRequired");
    expect(screen.queryByRole("dialog")).not.toBeNull();
    expect(api.updateRegisteredUser).not.toHaveBeenCalled();
  });

  it("does not send an invalid e-mail", async () => {
    await openEditDialog();
    fireEvent.change(input("registeredUsers.email"), { target: { value: "not an email" } });
    confirmDialog();

    expect((await screen.findByRole("alert")).textContent).toBe("registeredUsers.invalidEmail");
    expect(input("registeredUsers.email").value).toBe("not an email");
    expect(api.updateRegisteredUser).not.toHaveBeenCalled();
  });

  it("stays open with the typed values when the server refuses the request", async () => {
    api.updateRegisteredUser.mockRejectedValue(new Error("Invalid arguments supplied in the user request"));
    await openEditDialog();
    fireEvent.change(input("registeredUsers.lastname"), { target: { value: "Tester" } });
    confirmDialog();

    expect((await screen.findByRole("alert")).textContent).toContain("Invalid arguments supplied in the user request");
    expect(screen.queryByRole("dialog")).not.toBeNull();
    expect(input("registeredUsers.lastname").value).toBe("Tester");
    expect(toast).not.toHaveBeenCalled();
  });
});

describe("registered users list: search", () => {
  const ALICE = { id: "1", email: "alice@example.com", firstname: "Alice", lastname: "Smith" };
  const BOB = { id: "2", email: "bob@example.com", firstname: "Bob", lastname: "Jones" };

  const renderList = async () => {
    api.getRegisteredUsers.mockResolvedValue([ALICE, BOB]);
    render(
      <ConfirmProvider>
        <RegisteredUsersList />
      </ConfirmProvider>
    );
    await screen.findByText("alice@example.com");
  };

  const search = (query: string) =>
    fireEvent.change(screen.getByPlaceholderText("registeredUsers.searchPlaceholder"), { target: { value: query } });

  it("lists the matching users without an empty-state message", async () => {
    await renderList();
    search("BOB");
    expect(screen.getByText("bob@example.com")).not.toBeNull();
    expect(screen.queryByText("alice@example.com")).toBeNull();
    expect(screen.queryByText("registeredUsers.noMatch")).toBeNull();
  });

  it("tells when no registered user matches the search", async () => {
    await renderList();
    search("zzz");
    expect(screen.getByText("registeredUsers.noMatch")).not.toBeNull();
    expect(screen.queryByText("alice@example.com")).toBeNull();
  });

  it("restores the list when the search is cleared", async () => {
    await renderList();
    search("zzz");
    search("");
    expect(screen.getByText("alice@example.com")).not.toBeNull();
    expect(screen.queryByText("registeredUsers.noMatch")).toBeNull();
  });
});
