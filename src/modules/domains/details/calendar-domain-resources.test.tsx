// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Resource } from "../types";

const api = vi.hoisted(() => ({
  getResources: vi.fn(),
  createResource: vi.fn(),
  deleteResource: vi.fn(),
  getResourceEventCount: vi.fn(),
  exportResource: vi.fn(),
  importResource: vi.fn(),
  setResourcePublicRight: vi.fn(),
}));

vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => true }));
const userStatus = vi.hoisted(() => ({ byUser: {} as Record<string, string> }));
vi.mock("@/hooks/use-check-user-exists", () => ({ useCheckUserExists: (user: string) => userStatus.byUser[user.trim()] ?? "idle" }));
vi.mock("../api-client", () => api);

import CalendarDomainResources from "./calendar-domain-resources";

const resource = (id: string, name: string | null): Resource => ({
  id,
  name,
  deleted: false,
  description: "",
  icon: "projector",
  domain: "open-paas.org",
  creator: "alice@open-paas.org",
  administrators: [],
});

beforeEach(() => {
  api.getResources.mockReset();
  api.createResource.mockReset();
  userStatus.byUser = {};
});

afterEach(() => {
  cleanup();
});

describe("CalendarDomainResources", () => {
  it("lists a resource without a name under its ID, sorted with the named ones", async () => {
    api.getResources.mockResolvedValue([
      resource("room-2", "QA Room 2"),
      resource("abc-nameless", null),
    ]);
    render(<CalendarDomainResources domain="open-paas.org" defaultOpen />);

    const links = await screen.findAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["abc-nameless", "QA Room 2"]);
  });

  it("shows who administers a resource, the chip opening the resource page", async () => {
    api.getResources.mockResolvedValue([
      { ...resource("room-2", "QA Room 2"), administrators: [{ email: "bob@open-paas.org" }] },
      resource("room-3", "QA Room 3"),
    ]);
    render(<CalendarDomainResources domain="open-paas.org" defaultOpen />);

    const chip = await screen.findByRole("link", { name: /domains.calendarResources.administeredBy/ });
    expect(chip.getAttribute("href")).toBe("/domains/domain/open-paas.org/resource/room-2");
    // No chip for a resource without administrators
    expect(screen.getAllByRole("link", { name: /domains.calendarResources.administeredBy/ })).toHaveLength(1);
  });

  it("ties every field of the creation form to its caption", async () => {
    api.getResources.mockResolvedValue([]);
    render(<CalendarDomainResources domain="open-paas.org" defaultOpen />);

    fireEvent.click(await screen.findByTitle("domains.calendarResources.addTooltip"));

    expect(screen.getByRole("textbox", { name: "domains.calendarResources.fieldName *" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "domains.calendarResources.fieldDescription" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "domains.calendarResources.creatorLabel *" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "domains.calendarResources.administratorsLabel" })).toBeTruthy();
  });
});

describe("CalendarDomainResources: phone layout", () => {
  it("wraps the actions under a readable name instead of breaking it in the middle of a word", async () => {
    api.getResources.mockResolvedValue([resource("room-2", "QA Room 2")]);
    render(<CalendarDomainResources domain="open-paas.org" defaultOpen />);

    const heading = (await screen.findByRole("link", { name: "QA Room 2" })).closest("h4")!;
    expect(heading.parentElement!.className).toContain("flex-wrap");
    expect(heading.className).toContain("min-w-48");
    expect(heading.className).toContain("break-words");
    expect(heading.className).not.toContain("break-all");
  });
});

describe("CalendarDomainResources creation modal", () => {
  const fillAndCreate = async () => {
    userStatus.byUser = { "alice@open-paas.org": "exists" };
    fireEvent.click(await screen.findByTitle("domains.calendarResources.addTooltip"));
    const dialog = await screen.findByRole("dialog", { name: "domains.calendarResources.newTitle" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "domains.calendarResources.fieldName *" }), { target: { value: "Room" } });
    fireEvent.change(within(dialog).getByLabelText(/domains.calendarResources.creatorLabel/), { target: { value: "alice@open-paas.org" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "common.create" }));
    return dialog;
  };

  it("opens the closed section and a modal from the +, then creates the resource and closes", async () => {
    api.getResources.mockResolvedValue([]);
    api.createResource.mockResolvedValue(undefined);
    render(<CalendarDomainResources domain="open-paas.org" />);

    await fillAndCreate();

    await vi.waitFor(() => expect(api.createResource).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Room", domain: "open-paas.org", creator: "alice@open-paas.org" }),
    ));
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByPlaceholderText("domains.calendarResources.searchPlaceholder")).toBeTruthy();
  });

  it("keeps the modal open with the typed values and shows the refusal in it", async () => {
    api.getResources.mockResolvedValue([]);
    api.createResource.mockRejectedValue(new Error("Resource already exists"));
    render(<CalendarDomainResources domain="open-paas.org" defaultOpen />);

    const dialog = await fillAndCreate();

    expect((await within(dialog).findByRole("alert")).textContent).toContain("Resource already exists");
    expect(within(dialog).getByRole("textbox", { name: "domains.calendarResources.fieldName *" })).toHaveProperty("value", "Room");
  });

  it("sends the name trimmed and the icon without its extension", async () => {
    api.getResources.mockResolvedValue([]);
    api.createResource.mockResolvedValue(undefined);
    userStatus.byUser = { "alice@open-paas.org": "exists" };
    render(<CalendarDomainResources domain="open-paas.org" defaultOpen />);

    fireEvent.click(await screen.findByTitle("domains.calendarResources.addTooltip"));
    fireEvent.change(screen.getByRole("textbox", { name: "domains.calendarResources.fieldName *" }), { target: { value: "  Room  " } });
    fireEvent.change(screen.getByLabelText(/domains.calendarResources.creatorLabel/), { target: { value: "alice@open-paas.org" } });
    fireEvent.click(screen.getByRole("button", { name: "common.create" }));

    await vi.waitFor(() => expect(api.createResource).toHaveBeenCalledWith(expect.objectContaining({ name: "Room", icon: "home" })));
  });

  it.each(["", "   "])("keeps Create disabled for the blank name %j", async (blank) => {
    api.getResources.mockResolvedValue([]);
    userStatus.byUser = { "alice@open-paas.org": "exists" };
    render(<CalendarDomainResources domain="open-paas.org" defaultOpen />);

    fireEvent.click(await screen.findByTitle("domains.calendarResources.addTooltip"));
    fireEvent.change(screen.getByRole("textbox", { name: "domains.calendarResources.fieldName *" }), { target: { value: blank } });
    fireEvent.change(screen.getByLabelText(/domains.calendarResources.creatorLabel/), { target: { value: "alice@open-paas.org" } });
    const create = screen.getByText("common.create").closest("button") as HTMLButtonElement;
    fireEvent.click(create);

    expect(create.disabled).toBe(true);
    expect(api.createResource).not.toHaveBeenCalled();
  });
});

describe("CalendarDomainResources creation: a typed administrator is never dropped", () => {
  const fill = async (admin: string) => {
    api.getResources.mockResolvedValue([]);
    api.createResource.mockResolvedValue(undefined);
    userStatus.byUser = { "alice@open-paas.org": "exists", "bob@open-paas.org": "exists", "nobody@open-paas.org": "not_found" };
    render(<CalendarDomainResources domain="open-paas.org" defaultOpen />);
    fireEvent.click(await screen.findByTitle("domains.calendarResources.addTooltip"));
    fireEvent.change(screen.getByRole("textbox", { name: "domains.calendarResources.fieldName *" }), { target: { value: "Room" } });
    fireEvent.change(screen.getByLabelText(/domains.calendarResources.creatorLabel/), { target: { value: "alice@open-paas.org" } });
    fireEvent.change(screen.getByLabelText("domains.calendarResources.administratorsLabel"), { target: { value: admin } });
  };
  const createButton = () => screen.getByText("common.create").closest("button") as HTMLButtonElement;

  it("creates the resource with the administrator typed but not added", async () => {
    await fill("bob@open-paas.org");
    fireEvent.click(createButton());

    await vi.waitFor(() => expect(api.createResource).toHaveBeenCalledWith(
      expect.objectContaining({ administrators: [{ email: "bob@open-paas.org" }] }),
    ));
  });

  it("keeps Create disabled and says why while the typed administrator is unknown", async () => {
    await fill("nobody@open-paas.org");

    expect(createButton().disabled).toBe(true);
    expect(screen.getByText("common.addOrClearPending")).toBeTruthy();
  });
});
