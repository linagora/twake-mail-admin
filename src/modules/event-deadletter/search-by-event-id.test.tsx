// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AxiosError, AxiosHeaders } from "axios";

const api = vi.hoisted(() => ({
  searchDeadLetterEventByEventId: vi.fn(),
}));
const toast = vi.hoisted(() => vi.fn());

vi.mock("./api-client", () => api);
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

import SearchByEventId from "./search-by-event-id";

const httpError = (status: number) =>
  new AxiosError("Request failed", undefined, undefined, undefined, {
    status,
    statusText: "",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: "",
  });

const search = (eventId: string) => {
  render(
    <MemoryRouter>
      <SearchByEventId />
    </MemoryRouter>
  );
  fireEvent.change(screen.getByPlaceholderText("eventDeadletter.searchByEventIdPlaceholder"), {
    target: { value: eventId },
  });
  fireEvent.click(screen.getByRole("button", { name: "common.search" }));
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SearchByEventId", () => {
  it("reports an unknown event as a not-found result, not as an error", async () => {
    api.searchDeadLetterEventByEventId.mockRejectedValue(httpError(404));

    search("a1b2c3d4-c464-11f1-ad63-c75c21872971");

    expect((await screen.findByRole("status")).textContent).toBe("eventDeadletter.notFound");
    expect(toast).not.toHaveBeenCalled();
  });

  it("still toasts the other errors", async () => {
    api.searchDeadLetterEventByEventId.mockRejectedValue(httpError(400));

    search("not-a-uuid");

    await vi.waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "eventDeadletter.searchError" })));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
