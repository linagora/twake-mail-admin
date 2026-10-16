// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { UserExistsStatus } from "@/hooks/use-check-user-exists";

const api = vi.hoisted(() => ({
  getDomainAdmins: vi.fn(),
  addDomainAdmin: vi.fn(),
  removeDomainAdmin: vi.fn(),
}));
const userCheck = vi.hoisted(() => ({ status: "idle" as UserExistsStatus }));

vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => true }));
vi.mock("@/hooks/use-check-user-exists", () => ({ useCheckUserExists: () => userCheck.status }));
vi.mock("../api-client", () => api);

import CalendarDomainAdmins from "./calendar-domain-admins";

async function openAddInput() {
  render(<CalendarDomainAdmins domain="open-paas.org" defaultOpen />);
  await waitFor(() => expect(api.getDomainAdmins).toHaveBeenCalled());
  fireEvent.click(screen.getByTitle("domains.calendarAdmins.addTooltip"));
  const input = screen.getByPlaceholderText("domains.calendarAdmins.addPlaceholder");
  fireEvent.change(input, { target: { value: "nobody@open-paas.org" } });
  return input;
}

const addButton = () => screen.getByRole<HTMLButtonElement>("button", { name: "common.add" });

beforeEach(() => {
  api.getDomainAdmins.mockReset().mockResolvedValue([]);
  api.addDomainAdmin.mockReset().mockResolvedValue(undefined);
  api.removeDomainAdmin.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("CalendarDomainAdmins add admin", () => {
  it.each<UserExistsStatus>(["not_found", "invalid", "checking"])("disables Add and ignores Enter when the user status is %s", async (status) => {
    userCheck.status = status;
    const input = await openAddInput();

    expect(addButton().disabled).toBe(true);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(api.addDomainAdmin).not.toHaveBeenCalled();
  });

  it("adds the admin when the user exists", async () => {
    userCheck.status = "exists";
    await openAddInput();

    expect(addButton().disabled).toBe(false);
    fireEvent.click(addButton());
    await waitFor(() => expect(api.addDomainAdmin).toHaveBeenCalledWith("open-paas.org", "nobody@open-paas.org"));
  });
});

describe("CalendarDomainAdmins existing admin", () => {
  async function typeAdmin(username: string) {
    userCheck.status = "exists";
    api.getDomainAdmins.mockResolvedValue(["alice@open-paas.org"]);
    render(<CalendarDomainAdmins domain="open-paas.org" defaultOpen />);
    await screen.findByText("alice@open-paas.org");
    fireEvent.click(screen.getByTitle("domains.calendarAdmins.addTooltip"));
    fireEvent.change(screen.getByPlaceholderText("domains.calendarAdmins.addPlaceholder"), {
      target: { value: username },
    });
    return addButton();
  }

  it("flags a user who is already an admin and keeps Add disabled", async () => {
    const add = await typeAdmin("alice@open-paas.org");

    expect(screen.getByText("domains.calendarAdmins.alreadyAdmin")).not.toBeNull();
    expect(screen.queryByText("common.userExists")).toBeNull();
    expect(add.disabled).toBe(true);
  });

  it("compares admins case-insensitively and ignores surrounding spaces", async () => {
    const add = await typeAdmin("  Alice@Open-Paas.org ");

    expect(screen.getByText("domains.calendarAdmins.alreadyAdmin")).not.toBeNull();
    expect(add.disabled).toBe(true);
  });

  it("does not send the request when Enter is pressed on an existing admin", async () => {
    await typeAdmin("alice@open-paas.org");

    fireEvent.keyDown(screen.getByPlaceholderText("domains.calendarAdmins.addPlaceholder"), { key: "Enter" });

    expect(api.addDomainAdmin).not.toHaveBeenCalled();
  });

  it("adds a user who is not yet an admin", async () => {
    const add = await typeAdmin("bob@open-paas.org");

    expect(screen.queryByText("domains.calendarAdmins.alreadyAdmin")).toBeNull();
    expect(add.disabled).toBe(false);

    fireEvent.click(add);

    await waitFor(() => expect(api.addDomainAdmin).toHaveBeenCalledWith("open-paas.org", "bob@open-paas.org"));
  });
});
