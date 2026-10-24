// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/test/resize-observer";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options?.count !== undefined ? `${key} ${options.count}` : key),
  }),
}));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/modules/users/api-client", () => ({ listUsernames: async () => ["alice@open-paas.org", "bob@open-paas.org"] }));

// Each section reports its count, open or not, as the real ones do once loaded
const section = vi.hoisted(() => (id: string, count: number) => async () => {
  const { useSectionFact, useSectionOpen } = await import("@/components/custom/collapsible-section");
  return {
    default: function Section() {
      const [open] = useSectionOpen(id);
      useSectionFact(id, count);
      return <p>{open ? `${id} open` : `${id} closed`}</p>;
    },
  };
});
vi.mock("./calendar-domain-admins", section("admins", 0));
vi.mock("./calendar-domain-resources", section("resources", 1));
vi.mock("./calendar-domain-team-calendars", section("team-calendars", 2));
vi.mock("./calendar-domain-settings", () => ({ default: () => null }));
vi.mock("./calendar-domain-tasks", () => ({ default: () => null }));
vi.mock("./domain-address-book-counts", () => ({ default: () => null }));

import CalendarDomainDetail from "./calendar-domain-detail";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("calendar domain page: summary", () => {
  it("heads the page with its users and what its sections counted, each chip opening its section", async () => {
    render(
      <MemoryRouter initialEntries={["/domains/domain/open-paas.org"]}>
        <Routes><Route path="/domains/domain/:domain" element={<CalendarDomainDetail />} /></Routes>
      </MemoryRouter>
    );

    expect((await screen.findByRole("link", { name: "domains.summary.users 2" })).getAttribute("href")).toBe("/users?domain=open-paas.org");
    expect(screen.getByRole("button", { name: "domains.summary.admins 0" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "domains.summary.teamCalendars 2" })).not.toBeNull();

    expect(screen.getByText("resources closed")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "domains.summary.resources 1" }));
    expect(screen.getByText("resources open")).not.toBeNull();
  });
});
