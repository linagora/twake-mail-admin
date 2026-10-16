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
