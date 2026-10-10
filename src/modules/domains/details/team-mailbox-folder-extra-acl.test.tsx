// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const api = vi.hoisted(() => ({
  getTeamMailboxFolderExtraAcl: vi.fn(),
  setTeamMailboxFolderExtraAclEntry: vi.fn(),
  removeTeamMailboxFolderExtraAclEntry: vi.fn(),
  clearTeamMailboxFolderExtraAcl: vi.fn(),
}));

vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-check-user-exists", () => ({ useCheckUserExists: () => "exists" }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../api-client", () => api);

import TeamMailboxFolderExtraAcl from "./team-mailbox-folder-extra-acl";

function openAddForm() {
  render(<TeamMailboxFolderExtraAcl domain="example.com" mailbox="sales" folder="INBOX" />);
  fireEvent.click(screen.getByText("Extra ACL"));
  fireEvent.click(screen.getByTitle("domains.extraAcl.addEntry"));
}

beforeEach(() => {
  api.getTeamMailboxFolderExtraAcl.mockReset();
  api.getTeamMailboxFolderExtraAcl.mockResolvedValue({});
});

afterEach(cleanup);

describe("team mailbox folder extra ACL rights", () => {
  it("exposes every right as an accessible checkbox", () => {
    openAddForm();

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(11);
    checkboxes.forEach((checkbox) => expect(checkbox.className).not.toContain("hidden"));
  });

  it("toggles a right from its checkbox, as the keyboard Space key does", () => {
    openAddForm();

    const write = screen.getByRole("checkbox", { name: /Write$/ }) as HTMLInputElement;
    expect(write.checked).toBe(false);

    fireEvent.click(write);

    expect(write.checked).toBe(true);
    expect(screen.getByText("lrw")).not.toBeNull();
  });
});
