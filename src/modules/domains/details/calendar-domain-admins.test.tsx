// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const api = vi.hoisted(() => ({
  getDomainAdmins: vi.fn(),
  addDomainAdmin: vi.fn(),
  removeDomainAdmin: vi.fn(),
}));

vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-check-user-exists", () => ({ useCheckUserExists: () => "exists" }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../api-client", () => api);

import CalendarDomainAdmins from "./calendar-domain-admins";

async function typeAdmin(username: string) {
  render(<CalendarDomainAdmins domain="open-paas.org" defaultOpen />);
  await screen.findByText("alice@open-paas.org");
  fireEvent.click(screen.getByTitle("domains.calendarAdmins.addTooltip"));
  fireEvent.change(screen.getByPlaceholderText("domains.calendarAdmins.addPlaceholder"), {
    target: { value: username },
  });
  return screen.getByRole("button", { name: "common.add" }) as HTMLButtonElement;
}

beforeEach(() => {
  api.getDomainAdmins.mockReset();
  api.getDomainAdmins.mockResolvedValue(["alice@open-paas.org"]);
  api.addDomainAdmin.mockReset();
  api.addDomainAdmin.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("calendar domain admins", () => {
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

    expect(api.addDomainAdmin).toHaveBeenCalledWith("open-paas.org", "bob@open-paas.org");
  });
});
