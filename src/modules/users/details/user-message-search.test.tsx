// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("../api-client", () => ({
  searchUserMails: vi.fn(),
  getUserMailboxes: async () => [],
}));

import UserMessageSearch from "./user-message-search";

const FILTERS: [string | RegExp, string][] = [
  ["users.messageSearch.fullText", "INPUT"],
  ["users.messageSearch.from", "INPUT"],
  ["users.messageSearch.to", "INPUT"],
  ["users.messageSearch.subject", "INPUT"],
  ["users.messageSearch.hasAttachment", "SELECT"],
  [/^users\.messageSearch\.hasKeywords /, "INPUT"],
  [/^users\.messageSearch\.inMailboxes /, "INPUT"],
  [/^users\.messageSearch\.excludeMailboxes /, "INPUT"],
  ["users.messageSearch.receivedAfter", "INPUT"],
  ["users.messageSearch.receivedBefore", "INPUT"],
];

function renderSearch() {
  render(
    <MemoryRouter initialEntries={["/users/bob@example.com/search"]}>
      <Routes>
        <Route path="/users/:username/search" element={<UserMessageSearch />} />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(cleanup);

describe("user message search: field labels", () => {
  it("names the reason field after its label rather than its placeholder", () => {
    renderSearch();

    expect(screen.getByLabelText(/^users\.messageSearch\.reasonLabel/).tagName).toBe("INPUT");
  });

  it.each(FILTERS)("names the %s filter after its label", (label, tagName) => {
    renderSearch();
    fireEvent.click(screen.getByText("users.messageSearch.filters"));

    expect(screen.getByLabelText(label).tagName).toBe(tagName);
  });

  it("names the sort field and direction selects", () => {
    renderSearch();

    expect(screen.getByLabelText("users.messageSearch.sortField").tagName).toBe("SELECT");
    expect(screen.getByLabelText("users.messageSearch.sortDirection").tagName).toBe("SELECT");
  });
});
