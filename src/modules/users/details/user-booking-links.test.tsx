// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
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
// Calendars cannot be listed, so the calendar is typed in a free-text field.
vi.mock("@/lib/proxy-resolver-context", () => ({
  useIsAllowed: (method: string, path: string) => !(method === "GET" && path === "/users/{username}/calendars"),
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
