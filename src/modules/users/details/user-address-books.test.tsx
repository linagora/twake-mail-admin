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
        { _links: { self: { href: "/addressbooks/alice-id/contacts.json" } }, "dav:name": "" },
        { _links: { self: { href: "/addressbooks/alice-id/collected.json" } }, "dav:name": "" },
        { _links: { self: { href: "/addressbooks/alice-id/0f1e2d.json" } }, "dav:name": "contacts" },
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

async function rowOf(name: string): Promise<HTMLElement> {
  const label = await screen.findByText(name, { selector: "p" });
  return label.closest(".group") as HTMLElement;
}

afterEach(cleanup);

describe("user address books: system address books", () => {
  it.each([
    ["users.addressBooks.system.contacts"],
    ["users.addressBooks.system.collected"],
  ])("labels %s as a system address book that cannot be edited nor deleted", async (name) => {
    render(<UserAddressBooks username="alice@example.com" />);
    fireEvent.click(screen.getByText("users.addressBooks.title"));

    const row = within(await rowOf(name));

    expect(row.getByText("users.addressBooks.system.badge")).not.toBeNull();
    expect(row.queryByTitle("users.addressBooks.deleteTitle")).toBeNull();
    expect(row.queryByTitle("users.addressBooks.editTitle")).toBeNull();
  });

  it("keeps a user address book named after a system one editable and deletable", async () => {
    render(<UserAddressBooks username="alice@example.com" />);
    fireEvent.click(screen.getByText("users.addressBooks.title"));

    const row = within(await rowOf("contacts"));

    expect(row.queryByText("users.addressBooks.system.badge")).toBeNull();
    expect(row.getByTitle("users.addressBooks.deleteTitle")).not.toBeNull();
    expect(row.getByTitle("users.addressBooks.editTitle")).not.toBeNull();
  });
});
