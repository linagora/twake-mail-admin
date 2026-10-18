// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { BookingLink, GetUserCalendarsResponseType } from "../types";

const mocks = vi.hoisted(() => ({
  canListCalendars: false,
  api: {
    createUserBookingLink: vi.fn(),
    deleteUserBookingLink: vi.fn(),
    deleteUserBookingLinkEvents: vi.fn(),
    getUserBookingLinks: vi.fn(),
    getUserCalendars: vi.fn(),
    resetUserBookingLinkPublicId: vi.fn(),
    updateUserBookingLink: vi.fn(),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
// Unless canListCalendars is set, calendars cannot be listed, so the calendar is typed in a free-text field.
vi.mock("@/lib/proxy-resolver-context", () => ({
  useIsAllowed: (method: string, path: string) =>
    mocks.canListCalendars || !(method === "GET" && path === "/users/{username}/calendars"),
}));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("react-router", () => ({ Link: () => null }));
vi.mock("../api-client", () => mocks.api);

import UserBookingLinks from "./user-booking-links";

const USERNAME = "alice@open-paas.org";
const CALENDAR_URL = "/calendars/alice/alice";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.canListCalendars = false;
  mocks.api.getUserBookingLinks.mockResolvedValue([
    { publicId: "abc", calendarUrl: CALENDAR_URL, durationMinutes: 30, active: true },
  ]);
  mocks.api.createUserBookingLink.mockResolvedValue({});
  mocks.api.updateUserBookingLink.mockResolvedValue({});
});

afterEach(cleanup);

const openSection = async () => {
  render(<UserBookingLinks username={USERNAME} />);
  fireEvent.click(screen.getByText("users.bookingLinks.title"));
  await screen.findByText("30 min");
};

const durationField = () => screen.getByLabelText(/users.bookingLinks.durationMinutes/) as HTMLInputElement;
const typeDuration = (value: string) => fireEvent.change(durationField(), { target: { value } });

const openCreate = async () => {
  await openSection();
  fireEvent.click(screen.getByText("users.bookingLinks.create"));
  fireEvent.change(screen.getByPlaceholderText("/calendars/..."), { target: { value: CALENDAR_URL } });
};

const createButton = () => screen.getByRole("button", { name: "common.create" });
const saveButton = () => screen.getByRole("button", { name: "common.save" });

describe("UserBookingLinks create dialog duration", () => {
  it("can be emptied and retyped", async () => {
    await openCreate();

    typeDuration("");
    expect(durationField().value).toBe("");
    typeDuration("45");
    expect(durationField().value).toBe("45");

    fireEvent.click(createButton());
    await vi.waitFor(() => expect(mocks.api.createUserBookingLink).toHaveBeenCalled());
    expect(mocks.api.createUserBookingLink).toHaveBeenCalledWith(
      USERNAME,
      expect.objectContaining({ durationMinutes: 45 }),
    );
  });

  it.each(["", "0", "-5"])("flags %j and disables Create", async (value) => {
    await openCreate();

    typeDuration(value);

    expect(durationField().value).toBe(value);
    expect(durationField().getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("users.bookingLinks.durationInvalid")).toBeTruthy();
    expect(createButton()).toHaveProperty("disabled", true);
  });
});

describe("UserBookingLinks edit dialog duration", () => {
  const openEdit = async () => {
    await openSection();
    fireEvent.click(screen.getByTitle("users.bookingLinks.editTitle"));
  };

  it.each(["", "0", "-5"])("flags %j and disables Save", async (value) => {
    await openEdit();

    typeDuration(value);

    expect(durationField().getAttribute("aria-invalid")).toBe("true");
    expect(saveButton()).toHaveProperty("disabled", true);
  });

  it("sends the retyped duration", async () => {
    await openEdit();

    typeDuration("");
    typeDuration("45");
    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(mocks.api.updateUserBookingLink).toHaveBeenCalled());
    expect(mocks.api.updateUserBookingLink).toHaveBeenCalledWith(
      USERNAME,
      "abc",
      expect.objectContaining({ durationMinutes: 45 }),
    );
  });
});

describe("booking link dialog: field labels", () => {
  const openCreateDialog = async () => {
    mocks.canListCalendars = true;
    mocks.api.getUserCalendars.mockResolvedValue({
      _embedded: { "dav:calendar": [{ "dav:name": "Work", _links: { self: { href: "/calendars/bob/work.json" } } }] },
    });
    await openSection();
    fireEvent.click(screen.getByText("users.bookingLinks.create"));
    await screen.findByRole("option", { name: "Work" });
  };

  it.each([
    ["users.bookingLinks.calendarUrl", "SELECT"],
    ["users.bookingLinks.name", "INPUT"],
    ["users.bookingLinks.description", "TEXTAREA"],
    ["users.bookingLinks.durationMinutes", "INPUT"],
    ["users.bookingLinks.color", "INPUT"],
  ])("names the %s field after its visible label", async (label, tagName) => {
    await openCreateDialog();

    expect(screen.getByLabelText(label, { exact: false }).tagName).toBe(tagName);
  });

  it.each([
    "users.bookingLinks.ruleDay",
    "users.bookingLinks.ruleStart",
    "users.bookingLinks.ruleEnd",
    "users.bookingLinks.timeZone",
  ])("names the %s field of an availability rule", async (label) => {
    await openCreateDialog();
    fireEvent.click(screen.getByText("users.bookingLinks.addRule"));

    expect(screen.getByLabelText(label)).toBeTruthy();
  });

  it("lets an availability rule row wrap so it fits a phone-width dialog", async () => {
    await openCreateDialog();
    fireEvent.click(screen.getByText("users.bookingLinks.addRule"));

    const row = screen.getByLabelText("users.bookingLinks.ruleDay").parentElement!;
    expect(row.className).toContain("flex-wrap");
  });
});

const ALICE = "alice@example.com";

const calendars = (...names: string[]): GetUserCalendarsResponseType => ({
  _embedded: {
    "dav:calendar": names.map((name) => ({ _links: { self: { href: `/calendars/alice/${name}.json` } }, "dav:name": name })),
  },
}) as GetUserCalendarsResponseType;

const LINK = {
  publicId: "abc",
  calendarUrl: "/calendars/alice/Gone",
  durationMinutes: 30,
  active: true,
  name: "Intro call",
} as BookingLink;

const offeredCalendars = () =>
  screen.getAllByRole("option").map((o) => o.textContent).filter((label) => label !== "users.bookingLinks.selectCalendar");

const expandSection = async () => {
  render(<UserBookingLinks username={ALICE} />);
  fireEvent.click(screen.getByText("users.bookingLinks.title"));
  await screen.findByText("Intro call");
  await waitFor(() => expect(mocks.api.getUserCalendars).toHaveBeenCalledTimes(1));
};

describe("booking link dialogs: calendar list", () => {
  beforeEach(() => {
    mocks.canListCalendars = true;
    mocks.api.getUserBookingLinks.mockResolvedValue([LINK]);
    mocks.api.getUserCalendars.mockResolvedValueOnce(calendars("Gone")).mockResolvedValue(calendars("New"));
  });

  it("offers the current calendars in the create dialog", async () => {
    await expandSection();

    fireEvent.click(screen.getByText("users.bookingLinks.create"));

    await waitFor(() => expect(offeredCalendars()).toEqual(["New"]));
  });

  it("offers the current calendars in the edit dialog", async () => {
    await expandSection();

    fireEvent.click(screen.getByTitle("users.bookingLinks.editTitle"));

    await waitFor(() => expect(offeredCalendars()).toContain("New"));
    expect(offeredCalendars()).not.toContain("Gone");
  });

  it("does not fetch the calendars while the section is collapsed", () => {
    render(<UserBookingLinks username={ALICE} />);

    expect(mocks.api.getUserCalendars).not.toHaveBeenCalled();
  });
});

describe("booking link whose calendar was deleted", () => {
  beforeEach(() => {
    mocks.canListCalendars = true;
    mocks.api.getUserBookingLinks.mockResolvedValue([LINK]);
    mocks.api.getUserCalendars.mockResolvedValue(calendars("New"));
  });

  it("is flagged in its row instead of showing the raw calendar URL", async () => {
    await expandSection();

    expect(await screen.findByText("users.bookingLinks.calendarDeleted")).toBeTruthy();
    expect(screen.queryByText(LINK.calendarUrl)).toBeNull();
  });

  it("must be moved to an existing calendar before saving", async () => {
    await expandSection();
    fireEvent.click(screen.getByTitle("users.bookingLinks.editTitle"));

    const select = (await screen.findByLabelText("users.bookingLinks.calendarUrl")) as HTMLSelectElement;
    expect(select.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("users.bookingLinks.calendarUnavailable")).toBeTruthy();
    expect(saveButton()).toHaveProperty("disabled", true);

    fireEvent.change(select, { target: { value: "/calendars/alice/New" } });

    expect(saveButton()).toHaveProperty("disabled", false);
    expect(screen.queryByText("users.bookingLinks.calendarUnavailable")).toBeNull();
  });

  it("is noticed once the Calendars section deleted its calendar", async () => {
    mocks.api.getUserCalendars.mockReset();
    mocks.api.getUserCalendars.mockResolvedValueOnce(calendars("Gone")).mockResolvedValue(calendars("New"));
    const { rerender } = render(<UserBookingLinks username={ALICE} calendarsVersion={0} />);
    fireEvent.click(screen.getByText("users.bookingLinks.title"));
    expect(await screen.findByText("Gone")).toBeTruthy();

    rerender(<UserBookingLinks username={ALICE} calendarsVersion={1} />);

    expect(await screen.findByText("users.bookingLinks.calendarDeleted")).toBeTruthy();
  });
});

describe("booking link dialog: availability rules", () => {
  const addRule = async () => {
    await openCreate();
    fireEvent.click(screen.getByText("users.bookingLinks.addRule"));
  };

  it("accepts the default rule", async () => {
    await addRule();

    expect(screen.queryByText("users.bookingLinks.ruleRangeInvalid")).toBeNull();
    expect(screen.queryByText("users.bookingLinks.timeZoneInvalid")).toBeNull();
    expect(createButton()).toHaveProperty("disabled", false);
  });

  it("flags an unknown time zone next to the rule and disables Create", async () => {
    await addRule();

    const timeZone = screen.getByLabelText("users.bookingLinks.timeZone");
    fireEvent.change(timeZone, { target: { value: "Mars/Olympus" } });

    expect(timeZone.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("users.bookingLinks.timeZoneInvalid")).toBeTruthy();
    expect(createButton()).toHaveProperty("disabled", true);
  });

  it("flags a rule ending before it starts and disables Create", async () => {
    await addRule();

    fireEvent.change(screen.getByLabelText("users.bookingLinks.ruleStart"), { target: { value: "12:00" } });
    fireEvent.change(screen.getByLabelText("users.bookingLinks.ruleEnd"), { target: { value: "09:00" } });

    expect(screen.getByLabelText("users.bookingLinks.ruleEnd").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("users.bookingLinks.ruleRangeInvalid")).toBeTruthy();
    expect(createButton()).toHaveProperty("disabled", true);
  });

  it("disables Save of the edit dialog on an invalid rule", async () => {
    mocks.api.getUserBookingLinks.mockResolvedValue([
      {
        publicId: "abc",
        calendarUrl: CALENDAR_URL,
        durationMinutes: 30,
        active: true,
        availabilityRules: [{ type: "weekly", dayOfWeek: "MON", start: "09:00", end: "17:00", timeZone: "UTC" }],
      },
    ]);
    await openSection();
    fireEvent.click(screen.getByTitle("users.bookingLinks.editTitle"));
    expect(saveButton()).toHaveProperty("disabled", false);

    fireEvent.change(screen.getByLabelText("users.bookingLinks.timeZone"), { target: { value: "Nowhere" } });

    expect(saveButton()).toHaveProperty("disabled", true);
  });
});
