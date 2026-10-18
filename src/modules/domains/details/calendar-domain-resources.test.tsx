// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
vi.mock("@/hooks/use-check-user-exists", () => ({ useCheckUserExists: () => "idle" }));
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

  it("ties every field of the creation form to its caption", async () => {
    api.getResources.mockResolvedValue([]);
    render(<CalendarDomainResources domain="open-paas.org" defaultOpen />);

    fireEvent.click(await screen.findByTitle("domains.calendarResources.addTooltip"));

    expect(screen.getByRole("textbox", { name: "domains.calendarResources.namePlaceholder" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "domains.calendarResources.fieldDescription" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "domains.calendarResources.creatorLabel *" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "domains.calendarResources.administratorsLabel" })).toBeTruthy();
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
