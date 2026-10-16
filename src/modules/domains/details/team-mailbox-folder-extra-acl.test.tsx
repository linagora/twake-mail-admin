// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { UserExistsStatus } from "@/hooks/use-check-user-exists";

const api = vi.hoisted(() => ({
  getTeamMailboxFolderExtraAcl: vi.fn(),
  setTeamMailboxFolderExtraAclEntry: vi.fn(),
  removeTeamMailboxFolderExtraAclEntry: vi.fn(),
  clearTeamMailboxFolderExtraAcl: vi.fn(),
}));
const mocks = vi.hoisted(() => ({ confirm: vi.fn(), userStatus: vi.fn() }));

vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-check-user-exists", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/use-check-user-exists")>()),
  useCheckUserExists: mocks.userStatus,
}));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => mocks.confirm }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../api-client", () => api);

import TeamMailboxFolderExtraAcl from "./team-mailbox-folder-extra-acl";

function openAddForm() {
  render(<TeamMailboxFolderExtraAcl domain="example.com" mailbox="sales" folder="INBOX" />);
  fireEvent.click(screen.getByText("Extra ACL"));
  fireEvent.click(screen.getByTitle("domains.extraAcl.addEntry"));
}

const typeUser = (user: string, status: UserExistsStatus) => {
  mocks.userStatus.mockReturnValue(status);
  openAddForm();
  fireEvent.change(screen.getByPlaceholderText("user@domain.tld"), { target: { value: user } });
};

const addButton = () => screen.getByText("Add") as HTMLButtonElement;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.userStatus.mockReturnValue("exists");
  api.getTeamMailboxFolderExtraAcl.mockResolvedValue({});
  api.setTeamMailboxFolderExtraAclEntry.mockResolvedValue(undefined);
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

describe("team mailbox folder extra ACL: add an entry", () => {
  it("adds an existing user without confirmation", async () => {
    typeUser("alice@example.com", "exists");
    fireEvent.click(addButton());

    await waitFor(() =>
      expect(api.setTeamMailboxFolderExtraAclEntry).toHaveBeenCalledWith("example.com", "sales", "INBOX", "alice@example.com", "lr")
    );
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it.each<UserExistsStatus>(["invalid", "checking"])("disables Add while the user is %s", (status) => {
    typeUser("a@b@c", status);

    expect(addButton().disabled).toBe(true);
    fireEvent.keyDown(screen.getByPlaceholderText("user@domain.tld"), { key: "Enter" });
    expect(api.setTeamMailboxFolderExtraAclEntry).not.toHaveBeenCalled();
  });

  it("asks for confirmation before adding an unknown user", async () => {
    mocks.confirm.mockResolvedValue(true);
    typeUser("ghost@example.com", "not_found");
    fireEvent.click(addButton());

    await waitFor(() => expect(api.setTeamMailboxFolderExtraAclEntry).toHaveBeenCalled());
    expect(mocks.confirm.mock.calls[0][0].header).toBe("common.unknownUserTitle");
  });

  it("does not add an unknown user when the confirmation is cancelled", async () => {
    mocks.confirm.mockResolvedValue(false);
    typeUser("ghost@example.com", "not_found");
    fireEvent.click(addButton());

    await waitFor(() => expect(mocks.confirm).toHaveBeenCalled());
    expect(api.setTeamMailboxFolderExtraAclEntry).not.toHaveBeenCalled();
  });
});
