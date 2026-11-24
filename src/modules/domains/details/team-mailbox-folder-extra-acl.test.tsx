// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { UserExistsStatus } from "@/hooks/use-check-user-exists";

const api = vi.hoisted(() => ({
  getTeamMailboxFolderExtraAcl: vi.fn(),
  setTeamMailboxFolderExtraAclEntry: vi.fn(),
  removeTeamMailboxFolderExtraAclEntry: vi.fn(),
  clearTeamMailboxFolderExtraAcl: vi.fn(),
}));
const mocks = vi.hoisted(() => ({ confirm: vi.fn(), toast: vi.fn(), userStatus: vi.fn() }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key} ${JSON.stringify(options)}` : key),
  }),
}));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-check-user-exists", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/use-check-user-exists")>()),
  useCheckUserExists: mocks.userStatus,
}));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => mocks.confirm }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("../api-client", () => api);

import TeamMailboxFolderExtraAcl from "./team-mailbox-folder-extra-acl";

// The + next to the section title opens the section and the modal holding the add form
function openAddForm() {
  render(<TeamMailboxFolderExtraAcl domain="example.com" mailbox="sales" folder="INBOX" />);
  fireEvent.click(screen.getByTitle("domains.extraAcl.addEntry"));
}

const dialog = () => screen.getByRole("dialog");
const input = () => within(dialog()).getByLabelText("domains.teamMailbox.user") as HTMLInputElement;

const typeUser = (user: string, status: UserExistsStatus) => {
  mocks.userStatus.mockReturnValue(status);
  openAddForm();
  fireEvent.change(input(), { target: { value: user } });
};

const addButton = () => within(dialog()).getByRole("button", { name: "common.add" }) as HTMLButtonElement;

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

    const write = screen.getByRole("checkbox", { name: /extraAcl\.write$/ }) as HTMLInputElement;
    expect(write.checked).toBe(false);

    fireEvent.click(write);

    expect(write.checked).toBe(true);
    expect(screen.getByText("lrw")).not.toBeNull();
  });
});

describe("team mailbox folder extra ACL: add an entry", () => {
  it("opens the section and adds the entry typed in the modal of the + button, without confirmation", async () => {
    typeUser("alice@example.com", "exists");
    fireEvent.click(addButton());

    expect(await screen.findByText("domains.extraAcl.empty")).not.toBeNull();
    await waitFor(() =>
      expect(api.setTeamMailboxFolderExtraAclEntry).toHaveBeenCalledWith("example.com", "sales", "INBOX", "alice@example.com", "lr")
    );
    expect(mocks.confirm).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.toast).toHaveBeenCalledWith({ title: "domains.extraAcl.entrySet" });
  });

  it("keeps the modal open with the typed user when the entry is refused", async () => {
    api.setTeamMailboxFolderExtraAclEntry.mockRejectedValue(new Error("Not allowed"));
    typeUser("alice@example.com", "exists");
    fireEvent.click(addButton());

    expect(await within(dialog()).findByText("Not allowed")).not.toBeNull();
    expect(input().value).toBe("alice@example.com");
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it.each<UserExistsStatus>(["invalid", "checking"])("disables Add while the user is %s", (status) => {
    typeUser("a@b@c", status);

    expect(addButton().disabled).toBe(true);
    fireEvent.submit(input());
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
    // Still there, to correct the address
    await waitFor(() => expect(addButton().disabled).toBe(false));
    expect(input().value).toBe("ghost@example.com");
  });
});

describe("team mailbox folder extra ACL: entry rows", () => {
  it("names each remove button after the user of its row, keeping the short tooltip", async () => {
    api.getTeamMailboxFolderExtraAcl.mockResolvedValue({ "alice@example.com": "lr", "emma@example.com": "lrw" });
    render(<TeamMailboxFolderExtraAcl domain="example.com" mailbox="sales" folder="INBOX" />);
    fireEvent.click(screen.getByText("domains.extraAcl.title"));

    const alice = await screen.findByRole("button", { name: 'domains.extraAcl.removeNamed {"item":"alice@example.com"}' });
    const emma = screen.getByRole("button", { name: 'domains.extraAcl.removeNamed {"item":"emma@example.com"}' });

    expect(alice.getAttribute("title")).toBe("domains.extraAcl.removeTooltip");
    expect(emma.getAttribute("title")).toBe("domains.extraAcl.removeTooltip");
  });
});
