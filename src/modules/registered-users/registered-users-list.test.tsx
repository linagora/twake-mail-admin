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
const userStatus = vi.hoisted(() => ({ current: "idle" }));

vi.mock("./api-client", () => api);
vi.mock("@/lib/config", () => ({ appConfig: { application: "CALENDAR", mode: "GLOBAL", sso: null } }));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/hooks/use-check-user-exists", () => ({ useCheckUserExists: () => userStatus.current }));
vi.mock("@/modules/domain-admin/domain-context", () => ({ useDomain: () => "" }));

import RegisteredUsersList, { EditUserForm } from "./registered-users-list";
import { RegisterUserForm } from "./register-user-form";
import { MemoryRouter } from "react-router";

const input = (label: string) => screen.getByLabelText(label, { exact: false }) as HTMLInputElement;

const openEditDialog = async () => {
  render(
    <MemoryRouter>
      <ConfirmProvider>
        <RegisteredUsersList />
      </ConfirmProvider>
    </MemoryRouter>
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
  userStatus.current = "idle";
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

describe("Add registered user", () => {
  const EMMA = "emma@open-paas.org";

  const openRegisterDialog = async () => {
    userStatus.current = "exists";
    api.createRegisteredUser.mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <ConfirmProvider>
          <RegisteredUsersList />
        </ConfirmProvider>
      </MemoryRouter>
    );
    await screen.findByText(CHARLOTTE.email);
    fireEvent.click(screen.getByRole("button", { name: "registeredUsers.registerButton" }));
    await screen.findByText("users.registration.registerTitle");
    fireEvent.change(screen.getByPlaceholderText("registeredUsers.placeholder"), { target: { value: EMMA } });
  };

  it("asks for the names, suggesting the local part as firstname", async () => {
    await openRegisterDialog();

    expect(input("registeredUsers.firstname").value).toBe("emma");
    expect(input("registeredUsers.lastname").value).toBe("");
    expect(api.createRegisteredUser).not.toHaveBeenCalled();
  });

  it("does not send a user without lastname", async () => {
    await openRegisterDialog();
    fireEvent.click(screen.getByText("registeredUsers.registerSubmit"));

    expect((await screen.findByRole("alert")).textContent).toBe("registeredUsers.lastnameRequired");
    expect(screen.queryByRole("dialog")).not.toBeNull();
    expect(api.createRegisteredUser).not.toHaveBeenCalled();
  });

  it("registers the user with the typed names", async () => {
    await openRegisterDialog();
    fireEvent.change(input("registeredUsers.lastname"), { target: { value: "QA" } });
    fireEvent.click(screen.getByText("registeredUsers.registerSubmit"));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(api.createRegisteredUser).toHaveBeenCalledWith({ id: EMMA, email: EMMA, firstname: "emma", lastname: "QA" }, undefined);
    expect(toast).toHaveBeenCalledWith({ title: "registeredUsers.registered" });
  });

  it("stays open with the typed values when the server refuses the request", async () => {
    await openRegisterDialog();
    api.createRegisteredUser.mockRejectedValue(new Error("Missing lastname"));
    fireEvent.change(input("registeredUsers.lastname"), { target: { value: "QA" } });
    fireEvent.click(screen.getByText("registeredUsers.registerSubmit"));

    expect((await screen.findByRole("alert")).textContent).toContain("Missing lastname");
    expect(input("registeredUsers.lastname").value).toBe("QA");
    expect(toast).not.toHaveBeenCalled();
  });

  it.each([CHARLOTTE.email, "Charlotte@Open-Paas.org"])("tells that %s is already registered and keeps Register disabled", async (typed) => {
    userStatus.current = "exists";
    render(
      <MemoryRouter>
        <ConfirmProvider>
          <RegisteredUsersList />
        </ConfirmProvider>
      </MemoryRouter>
    );
    await screen.findAllByText(CHARLOTTE.email);
    fireEvent.click(screen.getByRole("button", { name: "registeredUsers.registerButton" }));
    fireEvent.change(screen.getByPlaceholderText("registeredUsers.placeholder"), { target: { value: typed } });

    expect(screen.getByText("registeredUsers.alreadyRegistered")).toBeTruthy();
    expect(screen.queryByText("common.userExists")).toBeNull();
    expect(screen.getByText("registeredUsers.registerSubmit").closest("button")).toHaveProperty("disabled", true);
  });
});

describe("registered users list: search", () => {
  const ALICE = { id: "1", email: "alice@example.com", firstname: "Alice", lastname: "Smith" };
  const BOB = { id: "2", email: "bob@example.com", firstname: "Bob", lastname: "Jones" };

  const renderList = async () => {
    api.getRegisteredUsers.mockResolvedValue([ALICE, BOB]);
    render(
      <MemoryRouter>
        <ConfirmProvider>
          <RegisteredUsersList />
        </ConfirmProvider>
      </MemoryRouter>
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

  it.each(["Alice Smith", "smith alice", "Alice", "Smith"])("finds a user by the full name its row shows: %s", async (query) => {
    await renderList();
    search(query);
    expect(screen.getByText("alice@example.com")).not.toBeNull();
    expect(screen.queryByText("bob@example.com")).toBeNull();
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

describe("registered user forms: field labels", () => {
  it.each(["registeredUsers.email", "registeredUsers.firstname", "registeredUsers.lastname"])(
    "names the %s field of the edit form after its visible label",
    (label) => {
      render(<EditUserForm user={{ id: "1", email: "bob@example.com", firstname: "Bob", lastname: "Smith" }} onChange={() => {}} />);

      expect(screen.getByLabelText(label, { exact: false }).tagName).toBe("INPUT");
    },
  );

  it.each(["registeredUsers.firstname", "registeredUsers.lastname"])(
    "names the %s field of the registration form after its visible label",
    (label) => {
      render(<RegisterUserForm username="bob@example.com" defaults={{ firstname: "", lastname: "" }} onChange={() => {}} />);

      expect(screen.getByLabelText(label, { exact: false }).tagName).toBe("INPUT");
    },
  );
});


describe("registered users list: link to the user page", () => {
  it("opens the page of the user from their e-mail", async () => {
    api.getRegisteredUsers.mockResolvedValue([{ id: "1", email: "alice@example.com", firstname: "Alice", lastname: "Smith" }]);
    render(
      <MemoryRouter>
        <ConfirmProvider>
          <RegisteredUsersList />
        </ConfirmProvider>
      </MemoryRouter>
    );

    const link = await screen.findByRole("link", { name: "alice@example.com" });
    expect(link.getAttribute("href")).toBe("/users/user/alice%40example.com");
    expect(screen.getByTitle("registeredUsers.editTooltip")).toBeTruthy();
  });
});
