// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => false }));
vi.mock("@/components/custom/dav-collection-actions", () => ({
  CollectionCountBadge: () => null,
  ExportCollectionButton: () => null,
  ImportCollectionButton: () => null,
}));
vi.mock("../api-client", () => ({
  getUserAddressBooks: async () => ({
    _embedded: {
      "dav:addressbook": [
        {
          _links: { self: { href: "/addressbooks/bob-id/0ed751.json" } },
          "dav:name": "",
          "openpaas:source": "/addressbooks/alice-id/contacts.json",
          acl: [
            { principal: "principals/users/bob-id", privilege: "{DAV:}read" },
            { principal: "principals/users/bob-id", privilege: "{DAV:}write-properties" },
          ],
        },
        {
          _links: { self: { href: "/addressbooks/bob-id/9a8b7c.json" } },
          "dav:name": "Team",
          "openpaas:source": "/addressbooks/alice-id/4d5e6f.json",
          acl: [
            { principal: "principals/users/bob-id", privilege: "{DAV:}read" },
            { principal: "principals/users/bob-id", privilege: "{DAV:}write-content" },
            { principal: "principals/users/bob-id", privilege: "{DAV:}share" },
          ],
        },
        { _links: { self: { href: "/addressbooks/bob-id/1a2b3c.json" } }, "dav:name": "Own" },
      ],
    },
  }),
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

async function rowOf(name: string) {
  const label = await screen.findByText(name, { selector: "p" });
  return within(label.closest(".group") as HTMLElement);
}

function renderOpened() {
  render(<UserAddressBooks username="bob@example.com" />);
  fireEvent.click(screen.getByText("users.addressBooks.title"));
}

afterEach(cleanup);

describe("user address books: shared address books", () => {
  it("names an unnamed mirror of a system address book as on its owner's page", async () => {
    renderOpened();

    expect(await rowOf("users.addressBooks.system.contacts")).not.toBeNull();
  });

  it("offers neither sharing nor visibility on a read-only mirror, but still its removal", async () => {
    renderOpened();

    const row = await rowOf("users.addressBooks.system.contacts");

    expect(row.queryByTitle("users.addressBooks.invitees.title")).toBeNull();
    expect(row.queryByTitle("users.addressBooks.publicRight.privateTitle")).toBeNull();
    // Removed from this user only: the owner's address book is kept
    expect(row.getByTitle("users.addressBooks.removeSharedTitle")).not.toBeNull();
    expect(row.queryByTitle("users.addressBooks.deleteTitle")).toBeNull();
  });

  it("keeps deleting an owned address book", async () => {
    renderOpened();

    expect((await rowOf("Own")).getByTitle("users.addressBooks.deleteTitle")).not.toBeNull();
  });

  it("offers sharing and visibility on a mirror shared with the administration right", async () => {
    renderOpened();

    const row = await rowOf("Team");

    expect(row.getByTitle("users.addressBooks.invitees.title")).not.toBeNull();
    expect(row.getByTitle("users.addressBooks.publicRight.privateTitle")).not.toBeNull();
  });

  it("offers sharing and visibility on an owned address book", async () => {
    renderOpened();

    const row = await rowOf("Own");

    expect(row.getByTitle("users.addressBooks.invitees.title")).not.toBeNull();
    expect(row.getByTitle("users.addressBooks.publicRight.privateTitle")).not.toBeNull();
  });
});
