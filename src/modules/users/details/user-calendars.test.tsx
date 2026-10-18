// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { UserExistsStatus } from "@/hooks/use-check-user-exists";

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  toast: vi.fn(),
  userStatus: vi.fn(),
  api: {
    createUserCalendar: vi.fn(),
    deleteUserCalendar: vi.fn(),
    exportUserCalendar: vi.fn(),
    getUserCalendarEventCount: vi.fn(),
    getUserCalendars: vi.fn(),
    importUserCalendar: vi.fn(),
    setUserCalendarPublicRight: vi.fn(),
    updateUserCalendar: vi.fn(),
    updateUserCalendarInvitees: vi.fn(),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options?.email ? `${key} ${options.email}` : key),
  }),
}));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => mocks.confirm }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/hooks/use-check-user-exists", () => ({ useCheckUserExists: mocks.userStatus }));
vi.mock("@/modules/domain-admin/domain-context", () => ({ useDomain: () => null }));
vi.mock("@/modules/registered-users/api-client", () => ({ getRegisteredUsers: async () => [] }));
vi.mock("../api-client", () => mocks.api);

import UserCalendars from "./user-calendars";

const HOME = "6ad1f971f59875607bf8e747";
const CHARLOTTE = "charlotte@open-paas.org";
const BOB = "bob@open-paas.org";
const CEDRIC = "cedric@open-paas.org";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.userStatus.mockReturnValue("idle");
  mocks.api.getUserCalendarEventCount.mockResolvedValue({ count: 0 });
  mocks.api.getUserCalendars.mockResolvedValue({
    _embedded: {
      "dav:calendar": [
        {
          _links: { self: { href: `/calendars/${HOME}/${HOME}.json` } },
          "dav:name": "#default",
          invite: [{ href: `mailto:${CEDRIC}`, access: 2 }],
        },
        {
          _links: { self: { href: `/calendars/${HOME}/073e50b9.json` } },
          "dav:name": "Work",
          invite: [{ href: "mailto:alice@example.com", principal: "principals/users/alice", access: 2 }],
        },
      ],
    },
  });
});

afterEach(cleanup);

const openCalendars = async () => {
  render(<UserCalendars username="frank@open-paas.org" />);
  fireEvent.click(screen.getByText("users.calendars.title"));
  await screen.findByText("#default");
};

const typeInvitee = async (invitee: string, status: UserExistsStatus) => {
  mocks.userStatus.mockReturnValue(status);
  render(<UserCalendars username={CHARLOTTE} />);
  fireEvent.click(screen.getByText("users.calendars.title"));
  const [mainCalendarInvitees] = await screen.findAllByTitle("users.calendars.invitees.title");
  fireEvent.click(mainCalendarInvitees);
  fireEvent.change(inviteeInput(), { target: { value: invitee } });
};

const inviteeInput = () => screen.getByPlaceholderText("users.calendars.invitees.placeholder");

const stageButton = () => inviteeInput().parentElement!.querySelector("button")!;

describe("UserCalendars delete button", () => {
  it("is disabled on the main calendar and explains why", async () => {
    await openCalendars();

    const mainDelete = screen.getByTitle("users.calendars.mainCalendarUndeletable");
    expect(mainDelete).toHaveProperty("disabled", true);
    fireEvent.click(mainDelete);
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it("stays available on the other calendars", async () => {
    mocks.confirm.mockResolvedValue(false);
    await openCalendars();

    const deleteButtons = screen.getAllByTitle("users.calendars.deleteTitle");
    expect(deleteButtons).toHaveLength(1);
    fireEvent.click(deleteButtons[0]);
    expect(mocks.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ message: "users.calendars.deleteConfirm" }),
    );
  });
});

describe("calendar dialogs: field labels", () => {
  it.each([
    "users.calendars.name",
    "users.calendars.color",
    "users.calendars.colorCode",
    "users.calendars.description",
  ])("names the %s field of the create dialog", async (label) => {
    await openCalendars();
    fireEvent.click(screen.getByTitle("users.calendars.createTitle"));

    expect(screen.getByLabelText(new RegExp(`^${label}( \\*)?$`)).tagName).toBe("INPUT");
  });

  it("names the right selects and the add button of the delegation dialog", async () => {
    await openCalendars();
    const [, workDelegation] = screen.getAllByTitle("users.calendars.invitees.title");
    fireEvent.click(workDelegation);

    expect(screen.getByRole("combobox", { name: "users.calendars.invitees.rightOf alice@example.com" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "users.calendars.invitees.email" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "users.calendars.invitees.right" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "users.calendars.invitees.add" })).toBeTruthy();
  });

  it("lets the add row of the delegation dialog wrap so it fits a phone-width dialog", async () => {
    await openCalendars();
    const [, workDelegation] = screen.getAllByTitle("users.calendars.invitees.title");
    fireEvent.click(workDelegation);

    const email = screen.getByRole("textbox", { name: "users.calendars.invitees.email" });
    expect(email.parentElement!.className).toContain("flex-wrap");
    expect(email.className).toContain("min-w-0");
  });
});

describe("calendar delegation: stage an invitee", () => {
  it("refuses to delegate the calendar to its owner", async () => {
    await typeInvitee(" CHARLOTTE@open-paas.org ", "exists");

    expect(screen.getByText("users.calendars.invitees.isOwner")).toBeTruthy();
    expect(screen.queryByText("common.userExists")).toBeNull();
    expect(stageButton().disabled).toBe(true);
    fireEvent.keyDown(inviteeInput(), { key: "Enter" });
    expect(screen.queryByText(CHARLOTTE)).toBeNull();
  });

  it("refuses an invitee already in the list", async () => {
    await typeInvitee(CEDRIC, "exists");

    expect(screen.getByText("users.calendars.invitees.alreadyInvited")).toBeTruthy();
    expect(stageButton().disabled).toBe(true);
  });

  it("stages another existing user", async () => {
    await typeInvitee(BOB, "exists");

    expect(screen.getByText("common.userExists")).toBeTruthy();
    expect(stageButton().disabled).toBe(false);
    fireEvent.click(stageButton());

    await waitFor(() => expect(screen.getByText(BOB)).toBeTruthy());
  });
});
