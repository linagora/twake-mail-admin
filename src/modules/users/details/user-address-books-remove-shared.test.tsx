// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  registeredUsers: vi.fn(),
  getUserAddressBooks: vi.fn(),
  deleteUserAddressBook: vi.fn(),
  updateUserAddressBookInvitees: vi.fn(),
}));

vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => mocks.confirm }));
vi.mock("@/components/custom/dav-collection-actions", () => ({
  CollectionCountBadge: () => null,
  ExportCollectionButton: () => null,
  ImportCollectionButton: () => null,
}));
vi.mock("@/modules/registered-users/api-client", () => ({ getRegisteredUsers: mocks.registeredUsers }));
vi.mock("../api-client", () => ({
  getUserAddressBooks: mocks.getUserAddressBooks,
  createUserAddressBook: vi.fn(),
  deleteUserAddressBook: mocks.deleteUserAddressBook,
  exportUserAddressBook: vi.fn(),
  getUserAddressBookContactCount: vi.fn(),
  importUserAddressBook: vi.fn(),
  setUserAddressBookPublicRight: vi.fn(),
  updateUserAddressBook: vi.fn(),
  updateUserAddressBookInvitees: mocks.updateUserAddressBookInvitees,
}));

import UserAddressBooks from "./user-address-books";

const BOB = "bob@open-paas.org";
const CHARLOTTE = "charlotte@open-paas.org";

const mirror = (name: string, subscriptionType: string) => ({
  _links: { self: { href: `/addressbooks/bob-id/${name}-copy.json` } },
  "dav:name": name,
  "openpaas:source": `/addressbooks/charlotte-id/${name}.json`,
  "openpaas:subscription-type": subscriptionType,
  acl: [{ principal: "principals/users/bob-id", privilege: "{DAV:}read" }],
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.confirm.mockResolvedValue(true);
  mocks.registeredUsers.mockResolvedValue([{ id: "charlotte-id", email: CHARLOTTE }]);
  mocks.getUserAddressBooks.mockResolvedValue({
    _embedded: { "dav:addressbook": [mirror("shared", "delegation"), mirror("public", "public")] },
  });
});

afterEach(cleanup);

// The owner, when given, is awaited on the page: the share can only be revoked once it is known
async function removeRow(name: string, owner?: string) {
  render(<MemoryRouter><UserAddressBooks username={BOB} /></MemoryRouter>);
  fireEvent.click(screen.getByText("users.addressBooks.title"));
  const label = await screen.findByText(name, { selector: "p" });
  if (owner) await screen.findAllByText(owner);
  fireEvent.click(within(label.closest(".group") as HTMLElement).getByTitle("users.addressBooks.removeSharedTitle"));
  await waitFor(() => expect(mocks.confirm).toHaveBeenCalled());
  return mocks.confirm.mock.calls[0][0];
}

describe("removing an address book shared with the user", () => {
  it("revokes the share on the owner's address book rather than deleting the copy", async () => {
    const options = await removeRow("shared", CHARLOTTE);

    expect(options.message).toBe("users.addressBooks.revokeShareConfirm");
    await waitFor(() => expect(mocks.updateUserAddressBookInvitees).toHaveBeenCalledWith(CHARLOTTE, "shared", {
      "dav:sharee": [{ "dav:href": `mailto:${BOB}`, "dav:share-access": 4 }],
    }));
    expect(mocks.deleteUserAddressBook).not.toHaveBeenCalled();
  });

  it("deletes the copy, saying the share stays, when the owner is unknown", async () => {
    mocks.registeredUsers.mockResolvedValue([]);

    const options = await removeRow("shared");

    expect(options.message).toBe("users.addressBooks.removeKeptShareConfirm");
    await waitFor(() => expect(mocks.deleteUserAddressBook).toHaveBeenCalledWith(BOB, "shared-copy"));
    expect(mocks.updateUserAddressBookInvitees).not.toHaveBeenCalled();
  });

  it("deletes a subscription to a public address book, which is no share", async () => {
    const options = await removeRow("public");

    expect(options.message).toBe("users.addressBooks.removeSharedConfirm");
    await waitFor(() => expect(mocks.deleteUserAddressBook).toHaveBeenCalledWith(BOB, "public-copy"));
    expect(mocks.updateUserAddressBookInvitees).not.toHaveBeenCalled();
  });
});
