// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const api = vi.hoisted(() => ({
  getMailboxListenerGroups: vi.fn(() => Promise.resolve(["org.apache.james.SomeGroup"])),
  getFailedEvents: vi.fn(() => Promise.resolve(["event-1"])),
  deleteAllEventsForGroup: vi.fn(),
  redeliverGroupEvents: vi.fn(),
  deleteEvent: vi.fn(),
}));

vi.mock("./api-client", () => api);
vi.mock("./search-by-event-id", () => ({ default: () => null }));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => false }));

import EventListenersList from "./eventl-listeners-list";

afterEach(cleanup);

describe("event dead letter groups", () => {
  it("names the redeliver and clear buttons of each group", async () => {
    render(
      <MemoryRouter>
        <EventListenersList />
      </MemoryRouter>
    );

    const redeliver = await screen.findByRole("button", { name: "eventDeadletter.redeliverGroupAction" });
    const clear = screen.getByRole("button", { name: "eventDeadletter.clearGroupAction" });

    expect(redeliver.getAttribute("title")).toBe("eventDeadletter.redeliverGroupAction");
    expect(clear.getAttribute("title")).toBe("eventDeadletter.clearGroupAction");
  });
});
