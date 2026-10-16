// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { ConfirmProvider } from "@/components/custom/confirm-provider";

const USERNAME = "emma@open-paas.org";

const api = vi.hoisted(() => ({
  getRegisteredUsers: vi.fn(),
  createRegisteredUser: vi.fn(),
}));
const toast = vi.hoisted(() => vi.fn());

vi.mock("@/modules/registered-users/api-client", () => api);
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/modules/domain-admin/domain-context", () => ({ useDomain: () => "" }));
vi.mock("./calendar-user-tasks", () => ({ default: () => null }));
vi.mock("./user-calendars", () => ({ default: () => null }));
vi.mock("./user-booking-links", () => ({ default: () => null }));
vi.mock("./user-address-books", () => ({ default: () => null }));

import CalendarUserDetail from "./calendar-user-detail";

const input = (label: string) => screen.getByLabelText(label, { exact: false }) as HTMLInputElement;

const openRegisterDialog = async () => {
  render(
    <MemoryRouter initialEntries={[`/users/${USERNAME}`]}>
      <ConfirmProvider>
        <Routes>
          <Route path="/users/:username" element={<CalendarUserDetail />} />
        </Routes>
      </ConfirmProvider>
    </MemoryRouter>
  );
  fireEvent.click(await screen.findByText("users.registration.register"));
  await screen.findByText("users.registration.registerTitle");
};

const confirmDialog = () => fireEvent.click(screen.getByText("common.confirm"));

beforeEach(() => {
  api.getRegisteredUsers.mockResolvedValue([]);
  api.createRegisteredUser.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Register user dialog", () => {
  it("does not register a user without lastname", async () => {
    await openRegisterDialog();
    confirmDialog();

    expect((await screen.findByRole("alert")).textContent).toBe("registeredUsers.lastnameRequired");
    expect(input("registeredUsers.firstname").value).toBe("emma");
    expect(api.createRegisteredUser).not.toHaveBeenCalled();
  });

  it("registers the user with the typed names", async () => {
    await openRegisterDialog();
    fireEvent.change(input("registeredUsers.lastname"), { target: { value: "Smith" } });
    confirmDialog();

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(api.createRegisteredUser).toHaveBeenCalledWith({ id: USERNAME, email: USERNAME, firstname: "emma", lastname: "Smith" }, undefined);
  });

  it("stays open with the typed names when the server refuses the request", async () => {
    api.createRegisteredUser.mockRejectedValue(new Error("Invalid arguments supplied in the user request"));
    await openRegisterDialog();
    fireEvent.change(input("registeredUsers.firstname"), { target: { value: "Emma" } });
    fireEvent.change(input("registeredUsers.lastname"), { target: { value: "Smith" } });
    confirmDialog();

    expect((await screen.findByRole("alert")).textContent).toContain("Invalid arguments supplied in the user request");
    expect(input("registeredUsers.firstname").value).toBe("Emma");
    expect(input("registeredUsers.lastname").value).toBe("Smith");
    expect(toast).not.toHaveBeenCalled();
  });
});
