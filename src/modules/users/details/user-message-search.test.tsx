// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  username: "bob@example.com",
  api: {
    searchUserMails: vi.fn(),
    getUserMailboxes: vi.fn(),
  },
}));

// The page header is covered by its own tests
vi.mock("@/components/custom/header", () => ({ default: () => null }));
vi.mock("@/hooks/use-breadcrumbs", () => ({ useBreadcrumbs: () => ({ user: () => [] }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("react-router", () => ({ useParams: () => ({ username: mocks.username }) }));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("../api-client", () => mocks.api);

import UserMessageSearch from "./user-message-search";

const notFound = (message: string) => ({ response: { status: 404, data: { message } } });

const search = () => {
  fireEvent.change(screen.getByLabelText(/users.messageSearch.reasonLabel/), { target: { value: "ux-audit-1 check" } });
  fireEvent.click(screen.getByRole("button", { name: "common.search" }));
};

beforeEach(() => {
  sessionStorage.clear();
  vi.resetAllMocks();
  mocks.username = "bob@example.com";
  mocks.api.getUserMailboxes.mockResolvedValue([]);
});

afterEach(cleanup);

describe("user message search on a server without the route", () => {
  it("replaces the form with a 'not available' box on the first route-missing 404", async () => {
    mocks.api.searchUserMails.mockRejectedValue(notFound("POST /users/bob%40example.com/mails can not be found"));
    render(<UserMessageSearch />);
    search();

    expect((await screen.findByRole("status")).textContent).toContain("users.messageSearch.unavailableTitle");
    expect(screen.queryByRole("button", { name: "common.search" })).toBeNull();
  });

  it("opens directly on that box for another user of the same session", async () => {
    mocks.api.searchUserMails.mockRejectedValue(notFound("POST /users/bob%40example.com/mails can not be found"));
    const { unmount } = render(<UserMessageSearch />);
    search();
    await screen.findByRole("status");
    unmount();

    mocks.username = "alice@example.com";
    render(<UserMessageSearch />);

    expect(screen.getByRole("status").textContent).toContain("users.messageSearch.unavailableTitle");
    expect(screen.queryByLabelText(/users.messageSearch.reasonLabel/)).toBeNull();
  });

  it("still shows the 404 of an unknown user as an error", async () => {
    mocks.api.searchUserMails.mockRejectedValue(notFound("User 'ghost@example.com' does not exist"));
    render(<UserMessageSearch />);
    search();

    await screen.findByText(/does not exist/);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: "common.search" })).not.toBeNull();
  });
});
