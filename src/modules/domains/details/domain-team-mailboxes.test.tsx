// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  it("opens the section and creates the team mailbox named in the modal of the + button", async () => {
    mocks.api.createTeamMailbox.mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <DomainTeamMailboxes domain="example.com" />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTitle("domains.teamMailboxes.addTooltip"));
    const dialog = screen.getByRole("dialog");
    const name = within(dialog).getByLabelText("domains.teamMailboxes.nameLabel");
    expect(document.activeElement).toBe(name);
    fireEvent.change(name, { target: { value: "support" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "common.add" }));

    expect(await screen.findByRole("heading", { level: 4 })).not.toBeNull();
    await waitFor(() => expect(mocks.api.createTeamMailbox).toHaveBeenCalledWith("example.com", "support"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("says a team mailbox already listed exists instead of announcing its creation", async () => {
    render(
      <MemoryRouter>
        <DomainTeamMailboxes domain="example.com" />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTitle("domains.teamMailboxes.addTooltip"));
    const dialog = screen.getByRole("dialog");
    await screen.findByText("sales@example.com");
    fireEvent.change(within(dialog).getByLabelText("domains.teamMailboxes.nameLabel"), { target: { value: " sales " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "common.add" }));

    expect((await within(dialog).findByRole("alert")).textContent).toBe(
      `domains.teamMailboxes.alreadyExists ${JSON.stringify({ name: "sales" })}`
    );
    expect(mocks.api.createTeamMailbox).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).not.toBeNull();
  });

  it.each([".", ".."])("refuses %s, a URL dot segment, without sending it", async (name) => {
    render(
      <MemoryRouter>
        <DomainTeamMailboxes domain="example.com" />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTitle("domains.teamMailboxes.addTooltip"));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("domains.teamMailboxes.nameLabel"), { target: { value: name } });
    fireEvent.click(within(dialog).getByRole("button", { name: "common.add" }));

    expect((await within(dialog).findByRole("alert")).textContent).toBe("domains.teamMailboxes.dotName");
    expect(mocks.api.createTeamMailbox).not.toHaveBeenCalled();
  });
});
