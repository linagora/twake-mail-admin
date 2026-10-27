// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
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
  Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
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
  await screen.findByText("users.calendars.mainCalendar");
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

const stageButton = () => inviteeInput().parentElement!.parentElement!.querySelector("button")!;

describe("UserCalendars delete button", () => {
  it("is disabled on the main calendar and explains why", async () => {
    await openCalendars();

    const mainDelete = screen.getByText("users.calendars.mainCalendarUndeletable", { selector: "[hidden]" })
      .previousElementSibling!.querySelector("button")!;
    expect(mainDelete).toHaveProperty("disabled", true);
    const hint = mainDelete.parentElement!;
    expect(hint.tabIndex).toBe(0);
    expect(document.getElementById(hint.getAttribute("aria-describedby")!)!.textContent)
      .toBe("users.calendars.mainCalendarUndeletable");
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

describe("calendar creation", () => {
  // jsdom does not submit a form on Enter: submitting the field's form is what the browser does then
  it("creates the calendar on Enter in its name, closes and gives the focus back to the +", async () => {
    mocks.api.createUserCalendar.mockResolvedValue(undefined);
    await openCalendars();
    const plus = screen.getByTitle("users.calendars.createTitle");
    plus.focus();
    fireEvent.click(plus);
    const name = screen.getByLabelText("users.calendars.name *");
    fireEvent.change(name, { target: { value: "QA Cal2" } });
    fireEvent.submit(name.closest("form")!);

    await waitFor(() => expect(mocks.api.createUserCalendar).toHaveBeenCalledWith("frank@open-paas.org", { "dav:name": "QA Cal2" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTitle("users.calendars.createTitle")));
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
    expect(screen.getByRole("combobox", { name: "users.calendars.invitees.email" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "users.calendars.invitees.right" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "users.calendars.invitees.add" })).toBeTruthy();
  });

  it("lets the add row of the delegation dialog wrap so it fits a phone-width dialog", async () => {
    await openCalendars();
    const [, workDelegation] = screen.getAllByTitle("users.calendars.invitees.title");
    fireEvent.click(workDelegation);

    const email = screen.getByRole("combobox", { name: "users.calendars.invitees.email" });
    expect(email.parentElement!.parentElement!.className).toContain("flex-wrap");
    // The shrinking is on the wrapper that anchors its suggestions
    expect(email.parentElement!.className).toContain("min-w-0");
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

describe("UserCalendars shared with chip", () => {
  it("shows on each owned calendar shared with someone, not on an owner-only one", async () => {
    mocks.api.getUserCalendars.mockResolvedValue({
      _embedded: {
        "dav:calendar": [
          {
            _links: { self: { href: `/calendars/${HOME}/${HOME}.json` } },
            "dav:name": "#default",
            invite: [{ href: `mailto:${CHARLOTTE}`, access: 1 }, { href: `mailto:${BOB}`, access: 3 }],
          },
          {
            _links: { self: { href: `/calendars/${HOME}/073e50b9.json` } },
            "dav:name": "Private",
            invite: [{ href: `mailto:${CHARLOTTE}`, access: 1 }],
          },
        ],
      },
    });
    await openCalendars();

    const chips = screen.getAllByRole("button", { name: "common.sharedWith" });
    expect(chips).toHaveLength(1);
    fireEvent.focus(chips[0]);
    expect((await screen.findAllByText(`${BOB} — users.calendars.invitees.rights.read-write`)).length).toBeGreaterThan(0);
  });

  it("opens the delegation dialog when clicked", async () => {
    await openCalendars();

    fireEvent.click(screen.getAllByRole("button", { name: "common.sharedWith" })[0]);

    expect(await screen.findByText(/users.calendars.invitees.title —/)).not.toBeNull();
  });
});

describe("delegation dialog: nothing typed or staged is lost", () => {
  const applyButton = () => screen.getByText("users.calendars.invitees.apply").closest("button") as HTMLButtonElement;

  it("applies an address typed but not added", async () => {
    mocks.api.updateUserCalendarInvitees.mockResolvedValue(undefined);
    await typeInvitee(BOB, "exists");

    expect(applyButton().disabled).toBe(false);
    fireEvent.click(applyButton());

    await waitFor(() => expect(mocks.api.updateUserCalendarInvitees).toHaveBeenCalledWith(
      CHARLOTTE,
      expect.anything(),
      { set: [{ "dav:href": `mailto:${BOB}`, "dav:read": true }] },
    ));
  });

  it("blocks Apply and says why while the typed address is unknown", async () => {
    await typeInvitee("nobody@open-paas.org", "not_found");

    expect(applyButton().disabled).toBe(true);
    expect(screen.getByText("common.addOrClearPending")).toBeTruthy();
  });

  it("asks before discarding staged changes, and keeps them when told to", async () => {
    mocks.confirm.mockResolvedValue(false);
    await typeInvitee(BOB, "exists");
    fireEvent.keyDown(inviteeInput(), { key: "Enter" });
    expect(screen.getByText("common.pendingChanges")).toBeTruthy();

    fireEvent.click(screen.getByText("common.cancel"));

    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ header: "common.discardTitle", destructive: true })));
    expect(screen.getByText(BOB)).toBeTruthy();
  });

  it("closes at once without staged change", async () => {
    await typeInvitee("", "idle");

    fireEvent.click(screen.getByText("common.cancel"));

    expect(mocks.confirm).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByPlaceholderText("users.calendars.invitees.placeholder")).toBeNull());
  });
});

describe("UserCalendars export", () => {
  it("names the file after the calendar as shown, not the server's #default", async () => {
    mocks.api.exportUserCalendar.mockResolvedValue(new Blob(["BEGIN:VCALENDAR"]));
    window.URL.createObjectURL = vi.fn(() => "blob:main");
    window.URL.revokeObjectURL = vi.fn();
    const names: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.getAttribute("download") ?? "");
    });
    await openCalendars();

    fireEvent.click(screen.getAllByTitle("users.calendars.exportTitle")[0]);

    await waitFor(() => expect(names).toEqual(["users.calendars.mainCalendar.ics"]));
    click.mockRestore();
  });
});

describe("calendars shared with the user: removed, not deleted", () => {
  const TEAM = "6adcb34cba47760f66fe6baa";
  const renderWithTeamCopy = async () => {
    mocks.api.getUserCalendars.mockResolvedValue({
      _embedded: {
        "dav:calendar": [
          { _links: { self: { href: `/calendars/${HOME}/${HOME}.json` } }, "dav:name": "#default" },
          {
            _links: { self: { href: `/calendars/${HOME}/copy1.json` } },
            "dav:name": "UX Audit Support Team",
            "calendarserver:delegatedsource": `/calendars/${TEAM}/${TEAM}.json`,
            invite: [{ href: `mailto:${TEAM}@open-paas.org`, principal: `principals/team-calendars/${TEAM}`, access: 2 }],
          },
        ],
      },
    });
    render(<MemoryRouter><UserCalendars username="alice@open-paas.org" /></MemoryRouter>);
    fireEvent.click(screen.getByText("users.calendars.title"));
    await screen.findByText("UX Audit Support Team");
  };

  it("names the domain of a team calendar copy, linking to its page", async () => {
    await renderWithTeamCopy();
    expect(screen.getByText("users.calendars.teamCalendarOf")).not.toBeNull();
    expect(screen.getByRole("link", { name: "open-paas.org" }).getAttribute("href")).toBe("/domains/domain/open-paas.org");
  });

  it("removes the copy from the user with a non-destructive confirmation", async () => {
    mocks.confirm.mockResolvedValue(true);
    mocks.api.deleteUserCalendar.mockResolvedValue(undefined);
    await renderWithTeamCopy();
    const remove = screen.getByTitle("users.calendars.removeSharedTitle");
    expect(remove.querySelector("svg")!.getAttribute("class")).toContain("text-gray-600");
    fireEvent.click(remove);

    await waitFor(() => expect(mocks.api.deleteUserCalendar).toHaveBeenCalledWith("alice@open-paas.org", "copy1"));
    const options = mocks.confirm.mock.calls[0][0];
    expect(options.header).toBe("users.calendars.removeSharedTitle");
    expect(options.destructive).toBeUndefined();
    expect(options.confirmLabel).toBe("common.remove");
    expect(mocks.toast).toHaveBeenCalledWith({ title: "users.calendars.removedShared" });
  });
});

describe("resource calendars delegated to their administrators", () => {
  const ROOM = "6adf93a15ad990042c0824e1";

  it("names the domain of the resource, linking to the resource page", async () => {
    mocks.api.getUserCalendars.mockResolvedValue({
      _embedded: {
        "dav:calendar": [
          {
            _links: { self: { href: `/calendars/${HOME}/room-copy.json` } },
            "dav:name": "QA Room 2",
            "calendarserver:delegatedsource": `/calendars/${ROOM}/${ROOM}.json`,
            invite: [
              { href: `mailto:${ROOM}@open-paas.org`, principal: `principals/resources/${ROOM}`, access: 1 },
              { href: `mailto:${BOB}`, principal: `principals/users/${HOME}`, access: 5 },
            ],
          },
        ],
      },
    });
    render(<MemoryRouter><UserCalendars username={BOB} /></MemoryRouter>);
    fireEvent.click(screen.getByText("users.calendars.title"));
    await screen.findByText("QA Room 2");

    expect(screen.getByText("users.calendars.resourceOf")).not.toBeNull();
    expect(screen.queryByText("users.calendars.teamCalendarOf")).toBeNull();
    expect(screen.getByRole("link", { name: "open-paas.org" }).getAttribute("href"))
      .toBe(`/domains/domain/open-paas.org/resource/${ROOM}`);
  });
});
