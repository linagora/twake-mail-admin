// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => false }));
vi.mock("@/hooks/use-check-user-exists", () => ({ useCheckUserExists: () => "idle" }));
vi.mock("../api-client", () => ({
  getTeamMailboxMembers: async () => [],
  addTeamMailboxMember: vi.fn(),
  removeTeamMailboxMember: vi.fn(),
  searchTeamMailboxDeletedMessages: vi.fn(),
  restoreTeamMailboxDeletedMessages: vi.fn(),
}));
vi.mock("./team-mailbox-folders", () => ({ default: () => null }));
vi.mock("./team-mailbox-quota", () => ({ default: () => null }));
vi.mock("./team-mailbox-extra-senders", () => ({ default: () => null }));
vi.mock("@/modules/users/details/user-deleted-message-vault", () => ({ default: () => null }));

import TeamMailboxDetail from "./team-mailbox-detail";

afterEach(cleanup);

describe("team mailbox members", () => {
  it("names the role select of the add member form", () => {
    render(
      <MemoryRouter initialEntries={["/domains/example.com/team-mailboxes/sales"]}>
        <Routes>
          <Route path="/domains/:domain/team-mailboxes/:mailbox" element={<TeamMailboxDetail />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("combobox", { name: "domains.teamMailbox.role" }).tagName).toBe("SELECT");
  });
});
