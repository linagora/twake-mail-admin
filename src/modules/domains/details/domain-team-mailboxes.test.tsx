// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const mocks = vi.hoisted(() => ({
  api: {
    getTeamMailboxes: vi.fn(),
    createTeamMailbox: vi.fn(),
    deleteTeamMailbox: vi.fn(),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key} ${JSON.stringify(options)}` : key),
  }),
}));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../api-client", () => mocks.api);

import DomainTeamMailboxes from "./domain-team-mailboxes";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.api.getTeamMailboxes.mockResolvedValue([{ name: "sales", emailAddress: "sales@example.com" }]);
});

afterEach(cleanup);

describe("domain team mailboxes: row heading", () => {
  it("separates the counter, the name and the address in the text read by assistive technologies", async () => {
    render(
      <MemoryRouter>
        <DomainTeamMailboxes domain="example.com" defaultOpen />
      </MemoryRouter>
    );

    const heading = await screen.findByRole("heading", { level: 4 });
    expect(heading.textContent).toBe("1/ sales — sales@example.com");
  });
});

describe("domain team mailboxes: add", () => {
  it("focuses the name field revealed by the + button", async () => {
    render(
      <MemoryRouter>
        <DomainTeamMailboxes domain="example.com" defaultOpen />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByTitle("domains.teamMailboxes.addTooltip"));

    expect(document.activeElement).toBe(screen.getByPlaceholderText("domains.teamMailboxes.namePlaceholder"));
  });
});
