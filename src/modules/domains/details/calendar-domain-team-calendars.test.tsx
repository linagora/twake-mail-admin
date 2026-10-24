// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options?.email ? `${key} ${options.email}` : key),
  }),
}));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => false }));
vi.mock("@/hooks/use-check-user-exists", () => ({ useCheckUserExists: () => "idle" }));
const createTeamCalendar = vi.hoisted(() => vi.fn());
const updateTeamCalendarMembers = vi.hoisted(() => vi.fn());
vi.mock("../api-client", () => ({
  getTeamCalendars: async () => [{
    id: "sales", domainId: "1", domainName: "example.com", name: "sales", displayName: "Sales", creation: "", updated: "",
  }],
  getTeamCalendarMembers: async () => [{ username: "alice@example.com", role: "member", davRight: "" }],
  getTeamCalendarEventCount: async () => ({ count: 0 }),
  createTeamCalendar,
  updateTeamCalendar: vi.fn(),
  deleteTeamCalendar: vi.fn(),
  updateTeamCalendarMembers,
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
    expect(screen.getByRole("combobox", { name: "domains.teamCalendars.members.email" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "domains.teamCalendars.members.role" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "domains.teamCalendars.members.add" })).toBeTruthy();
  });

  it("lets the add row of the members dialog wrap so it fits a phone-width dialog", async () => {
    await openSection();
    fireEvent.click(screen.getByTitle("domains.teamCalendars.members.tooltip"));

    const email = await screen.findByRole("combobox", { name: "domains.teamCalendars.members.email" });
    expect(email.parentElement!.parentElement!.className).toContain("flex-wrap");
    // The shrinking is on the wrapper that anchors its suggestions
    expect(email.parentElement!.className).toContain("min-w-0");
  });
});

describe("team calendars: members dialog", () => {
  it("closes once the changes are saved", async () => {
    updateTeamCalendarMembers.mockResolvedValue(undefined);
    await openSection();
    fireEvent.click(screen.getByTitle("domains.teamCalendars.members.tooltip"));
    const role = await screen.findByRole("combobox", { name: "domains.teamCalendars.members.roleOf alice@example.com" });
    fireEvent.change(role, { target: { value: "manager" } });
    fireEvent.click(screen.getByRole("button", { name: "domains.teamCalendars.members.apply" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(updateTeamCalendarMembers).toHaveBeenCalled();
  });
});

describe("team calendars: creation modal", () => {
  it("opens the closed section and a modal from the +, then creates the team calendar and closes", async () => {
    createTeamCalendar.mockResolvedValue(undefined);
    render(<CalendarDomainTeamCalendars domain="example.com" />);

    fireEvent.click(screen.getByTitle("domains.teamCalendars.addTooltip"));
    const dialog = await screen.findByRole("dialog", { name: "domains.teamCalendars.newTitle" });
    expect(await screen.findByText("Sales")).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText("domains.teamCalendars.nameLabel", { exact: false }), { target: { value: "support" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "common.create" }));

    await vi.waitFor(() => expect(createTeamCalendar).toHaveBeenCalledWith("example.com", { name: "support", displayName: "support" }));
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("keeps the modal open with the typed values and shows the refusal in it", async () => {
    createTeamCalendar.mockRejectedValue(new Error("Already exists"));
    await openSection();

    fireEvent.click(screen.getByTitle("domains.teamCalendars.addTooltip"));
    const dialog = await screen.findByRole("dialog", { name: "domains.teamCalendars.newTitle" });
    const name = within(dialog).getByLabelText("domains.teamCalendars.nameLabel", { exact: false });
    fireEvent.change(name, { target: { value: "support" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "common.create" }));

    expect((await within(dialog).findByRole("alert")).textContent).toContain("Already exists");
    expect(name).toHaveProperty("value", "support");
  });
});

describe("team calendars: phone layout", () => {
  it("wraps the actions under the name and display name instead of truncating them", async () => {
    await openSection();

    const heading = screen.getByText("Sales").closest("h4")!;
    const nameBlock = heading.parentElement!;
    expect(nameBlock.parentElement!.className).toContain("flex-wrap");
    expect(nameBlock.className).toContain("min-w-48");
    expect(heading.className).toContain("break-words");
    expect(heading.className).not.toContain("truncate");
  });
});
