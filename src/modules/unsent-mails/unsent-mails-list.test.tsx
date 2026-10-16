// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { UnsentMail, UnsentMailId } from "./types";

const MAIL: UnsentMail = {
  id: "mail-1",
  mailFrom: "alice@example.com",
  rcptTo: ["bob@example.com"],
  body: "",
  createdAt: "2026-10-16T10:00:00Z",
  sendingTrials: [],
};

const getUnsentMailIds = vi.fn(async (): Promise<UnsentMailId[]> => [{ id: MAIL.id }]);

vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => vi.fn(async () => false) }));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }), toast: vi.fn() }));
vi.mock("./api-client", () => ({
  getUnsentMailIds: () => getUnsentMailIds(),
  getUnsentMail: vi.fn(async () => MAIL),
  deleteUnsentMail: vi.fn(),
  deleteAllUnsentMails: vi.fn(),
  resendAllUnsentMails: vi.fn(),
  resendUnsentMail: vi.fn(),
  downloadUnsentMail: vi.fn(),
}));

import UnsentMailsList from "./unsent-mails-list";

function renderList() {
  render(
    <MemoryRouter>
      <UnsentMailsList />
    </MemoryRouter>
  );
}

function filterByRecipient(query: string) {
  fireEvent.change(screen.getByPlaceholderText("unsentMails.searchRecipient"), {
    target: { value: query },
  });
}

afterEach(() => {
  cleanup();
  getUnsentMailIds.mockReset();
  getUnsentMailIds.mockImplementation(async () => [{ id: MAIL.id }]);
});

describe("unsent mails list: empty state", () => {
  it("tells when there is no unsent mail", async () => {
    getUnsentMailIds.mockImplementation(async () => []);
    renderList();
    expect(await screen.findByText("unsentMails.empty")).not.toBeNull();
    expect(screen.queryByText("unsentMails.noMatch")).toBeNull();
  });

  it("tells when no unsent mail matches the filters", async () => {
    getUnsentMailIds.mockImplementation(async () => []);
    renderList();
    await screen.findByText("unsentMails.empty");
    filterByRecipient("bob@open-paas.org");
    expect(screen.getByText("unsentMails.noMatch")).not.toBeNull();
    expect(screen.queryByText("unsentMails.empty")).toBeNull();
  });

  it("tells when the filters exclude every listed mail", async () => {
    renderList();
    await screen.findByText("alice@example.com");
    filterByRecipient("carol@example.com");
    expect(screen.getByText("unsentMails.noMatch")).not.toBeNull();
    expect(screen.queryByText(MAIL.id)).toBeNull();
  });

  it("shows no empty-state message when mails are listed", async () => {
    renderList();
    await screen.findByText("alice@example.com");
    expect(screen.queryByText("unsentMails.empty")).toBeNull();
    expect(screen.queryByText("unsentMails.noMatch")).toBeNull();
  });
});
