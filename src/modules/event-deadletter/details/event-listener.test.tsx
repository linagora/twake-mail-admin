// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import EventListenersDetail from "./event-listener";
import { getFailedEvents } from "../api-client";

vi.mock("../api-client", () => ({
  getFailedEvents: vi.fn(),
  deleteEvent: vi.fn(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
  }),
}));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => vi.fn() }));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));

const GROUP = "org.apache.james.vault.DeletedMessageVaultListenerGroup";

function renderDetail(search: string) {
  render(
    <MemoryRouter initialEntries={[`/event-dead-letter/group/${GROUP}${search}`]}>
      <Routes>
        <Route path="/event-dead-letter/group/:id" element={<EventListenersDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

const paginationInfo = () => screen.findByText(/eventDeadletter\.paginationInfo/);

afterEach(() => {
  cleanup();
  vi.mocked(getFailedEvents).mockReset();
});

describe("event dead letter group detail", () => {
  it("shows the number of events of the group as total, whatever the URL says", async () => {
    vi.mocked(getFailedEvents).mockResolvedValue(["0eb84d76-56ae-4b42-a1d6-20b54c58f08b"]);

    renderDetail("?&page=1&size=10");

    expect((await paginationInfo()).textContent).toContain('"total":1');
    expect(screen.getByText("common.next").hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("common.last").hasAttribute("disabled")).toBe(true);
  });

  it("paginates the events client side", async () => {
    const keys = Array.from({ length: 250 }, (_, index) => `insertion-${index}`);
    vi.mocked(getFailedEvents).mockResolvedValue(keys);

    renderDetail("?page=2");

    expect((await paginationInfo()).textContent).toContain('"total":250');
    expect(screen.getByText("insertion-200")).not.toBeNull();
    expect(screen.queryByText("insertion-199")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(50);
    expect(screen.getByText("common.next").hasAttribute("disabled")).toBe(true);
  });

  it("enables the next page when more events remain", async () => {
    const keys = Array.from({ length: 250 }, (_, index) => `insertion-${index}`);
    vi.mocked(getFailedEvents).mockResolvedValue(keys);

    renderDetail("?page=1");

    expect((await paginationInfo()).textContent).toContain('"total":250');
    expect(screen.getAllByRole("listitem")).toHaveLength(200);
    expect(screen.getByText("common.next").hasAttribute("disabled")).toBe(false);
  });
});
