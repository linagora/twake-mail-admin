// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

const api = vi.hoisted(() => ({
  getFailedEvents: vi.fn(() => Promise.resolve(["event-1"])),
  deleteEvent: vi.fn(),
}));

vi.mock("../api-client", () => api);
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => false }));

import EventListenersDetail from "./event-listener";

afterEach(cleanup);

describe("event dead letter group details", () => {
  it("names the delete button of each event", async () => {
    render(
      <MemoryRouter initialEntries={["/event-dead-letter/group/some-group"]}>
        <Routes>
          <Route path="/event-dead-letter/group/:id" element={<EventListenersDetail />} />
        </Routes>
      </MemoryRouter>
    );

    const deleteButton = await screen.findByRole("button", { name: "eventDeadletter.deleteEventAction" });

    expect(deleteButton.getAttribute("title")).toBe("eventDeadletter.deleteEventAction");
  });
});
