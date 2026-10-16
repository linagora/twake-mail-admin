// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options?.email ? `${key} ${options.email}` : key),
  }),
}));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => false }));
vi.mock("@/hooks/use-check-user-exists", () => ({ useCheckUserExists: () => "idle" }));
vi.mock("../api-client", () => ({
  getTeamCalendars: async () => [{
    id: "sales", domainId: "1", domainName: "example.com", name: "sales", displayName: "Sales", creation: "", updated: "",
  }],
  getTeamCalendarMembers: async () => [{ username: "alice@example.com", role: "member", davRight: "" }],
  getTeamCalendarEventCount: async () => ({ count: 0 }),
  createTeamCalendar: vi.fn(),
  updateTeamCalendar: vi.fn(),
  deleteTeamCalendar: vi.fn(),
  updateTeamCalendarMembers: vi.fn(),
  exportTeamCalendar: vi.fn(),
  importTeamCalendar: vi.fn(),
  setTeamCalendarPublicRight: vi.fn(),
}));

import CalendarDomainTeamCalendars from "./calendar-domain-team-calendars";

afterEach(cleanup);

async function openSection() {
  render(<CalendarDomainTeamCalendars domain="example.com" defaultOpen />);
  await screen.findByText("Sales");
}

describe("team calendars: field labels", () => {
  it.each(["domains.teamCalendars.nameLabel", "domains.teamCalendars.displayNameLabel"])(
    "names the %s field of the creation form",
    async (label) => {
      await openSection();
      fireEvent.click(screen.getByTitle("domains.teamCalendars.addTooltip"));

      expect(screen.getByLabelText(label, { exact: false }).tagName).toBe("INPUT");
    },
  );

  it("names the role selects and the add button of the members dialog", async () => {
    await openSection();
    fireEvent.click(screen.getByTitle("domains.teamCalendars.members.tooltip"));

    expect(await screen.findByRole("combobox", { name: "domains.teamCalendars.members.roleOf alice@example.com" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "domains.teamCalendars.members.email" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "domains.teamCalendars.members.role" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "domains.teamCalendars.members.add" })).toBeTruthy();
  });
});
