// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";

vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => false }));
vi.mock("@/hooks/use-check-user-exists", () => ({ useCheckUserExists: () => "idle" }));
vi.mock("@/components/custom/dav-collection-actions", () => ({
  CollectionCountBadge: () => null,
  ExportCollectionButton: () => null,
  ImportCollectionButton: () => null,
}));
vi.mock("@/modules/registered-users/api-client", () => ({
  getRegisteredUsers: async () => [
    { id: "bob-id", email: "bob@example.com" },
    { id: "charlotte-id", email: "charlotte@example.com" },
    { id: "emma-id", email: "emma@example.com" },
  ],
}));

// bob's copy of charlotte's "contacts", shared with the Administration right: its ACL only holds bob
const LISTINGS: Record<string, unknown[]> = {
  "bob@example.com": [
    {
      _links: { self: { href: "/addressbooks/bob-id/760bcebf.json" } },
      "dav:name": "Team",
      "openpaas:source": "/addressbooks/charlotte-id/contacts.json",
      acl: [
        { principal: "principals/users/bob-id", privilege: "{DAV:}share" },
        { principal: "principals/users/bob-id", privilege: "{DAV:}read" },
      ],
    },
  ],
  "charlotte@example.com": [
    {
      _links: { self: { href: "/addressbooks/charlotte-id/contacts.json" } },
      "dav:name": "Team",
      acl: [
        { principal: "principals/users/charlotte-id", privilege: "{DAV:}all" },
        { principal: "principals/users/bob-id", privilege: "{DAV:}share" },
        { principal: "principals/users/bob-id", privilege: "{DAV:}read" },
        { principal: "principals/users/emma-id", privilege: "{DAV:}read" },
      ],
    },
  ],
};

vi.mock("../api-client", () => ({
  getUserAddressBooks: async (username: string) => ({ _embedded: { "dav:addressbook": LISTINGS[username] ?? [] } }),
  createUserAddressBook: vi.fn(),
  deleteUserAddressBook: vi.fn(),
  exportUserAddressBook: vi.fn(),
  getUserAddressBookContactCount: vi.fn(),
  importUserAddressBook: vi.fn(),
  setUserAddressBookPublicRight: vi.fn(),
  updateUserAddressBook: vi.fn(),
  updateUserAddressBookInvitees: vi.fn(),
}));

import UserAddressBooks from "./user-address-books";

afterEach(cleanup);

describe("user address books: sharing dialog of a shared copy", () => {
  it("lists the sharees of the owner's address book", async () => {
    render(<MemoryRouter><UserAddressBooks username="bob@example.com" /></MemoryRouter>);
    fireEvent.click(screen.getByText("users.addressBooks.title"));
    // The owner is resolved from the registered users before the copy's row names it
    await screen.findByText("charlotte@example.com", { exact: false });
    const label = await screen.findByText("Team", { selector: "p" });
    fireEvent.click(within(label.closest(".group") as HTMLElement).getByTitle("users.addressBooks.invitees.title"));

    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("emma@example.com")).toBeTruthy();
    expect(within(dialog).getByText("bob@example.com")).toBeTruthy();
    expect(within(dialog).queryByText("users.addressBooks.invitees.empty")).toBeNull();
    expect(within(dialog).queryByText("charlotte@example.com")).toBeNull();
  });
});
