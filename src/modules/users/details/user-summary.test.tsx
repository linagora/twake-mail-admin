// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SectionsProvider, useSectionFact } from "@/components/custom/collapsible-section";

const api = vi.hoisted(() => ({ getUserQuota: vi.fn(), getUserVacation: vi.fn() }));
vi.mock("../api-client", () => api);
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));

import { CalendarUserSummary, MailUserSummary } from "./user-summary";

function Facts({ facts }: { facts: Record<string, unknown> }) {
  for (const [id, value] of Object.entries(facts)) {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- fixed set of facts per render
    useSectionFact(id, value);
  }
  return null;
}

beforeEach(() => {
  window.localStorage.clear();
  api.getUserQuota.mockResolvedValue({
    global: null, domain: null, user: null,
    computed: { size: 50 * 1024 * 1024, count: null },
    occupation: { size: 1126, count: 2, ratio: { size: 0.95, count: 0.002, max: 0.95 } },
  });
  api.getUserVacation.mockResolvedValue({ enabled: true });
});
afterEach(cleanup);

describe("mail user summary", () => {
  it("states quota usage with a written percentage, and the counts reported by the sections", async () => {
    render(
      <SectionsProvider page="user">
        <Facts facts={{ mailboxes: 1, aliases: 0, forwards: { destinations: [{ mailAddress: "charlotte@example.com" }], copyKept: true } }} />
        <MailUserSummary username="bob@example.com" />
      </SectionsProvider>
    );

    expect(await screen.findByText("users.summary.quota")).not.toBeNull();
    expect(document.querySelector(".bg-red-500")).not.toBeNull();
    expect(screen.getByText("users.summary.mailboxes")).not.toBeNull();
    expect(screen.getByText("users.summary.aliases")).not.toBeNull();
    expect(screen.getByText("users.summary.forwardsTo")).not.toBeNull();
    expect(await screen.findByText("users.summary.vacationOn")).not.toBeNull();
  });

  it("shows a used zero size limit as full, not the NaN of older backends", async () => {
    api.getUserQuota.mockResolvedValue({
      global: null, domain: null, user: { size: 0, count: null },
      computed: { size: 0, count: null },
      occupation: { size: 1126, count: 2, ratio: { size: "NaN", count: 0, max: "NaN" } },
    });
    render(
      <SectionsProvider page="user">
        <MailUserSummary username="bob@example.com" />
      </SectionsProvider>
    );

    expect(await screen.findByText("users.summary.quota")).not.toBeNull();
    const bar = document.querySelector<HTMLElement>(".bg-red-500");
    expect(bar?.style.width).toBe("100%");
  });

  it("opens the section of a fact when clicked", async () => {
    render(
      <SectionsProvider page="user">
        <MailUserSummary username="bob@example.com" />
      </SectionsProvider>
    );

    fireEvent.click(await screen.findByText("users.summary.quota"));

    expect(window.localStorage.getItem("section:user:quota")).toBe("true");
  });
});

describe("calendar user summary", () => {
  it("shows what the sections counted", () => {
    render(
      <SectionsProvider page="user">
        <Facts facts={{ calendars: 2, "address-books": 3, "booking-links": 0 }} />
        <CalendarUserSummary />
      </SectionsProvider>
    );

    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "users.summary.calendars", "users.summary.addressBooks", "users.summary.bookingLinks",
    ]);
  });
});
