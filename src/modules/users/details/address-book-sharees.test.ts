import { describe, expect, it } from "vitest";
import { UserAddressBook } from "../types";
import { currentSharees, userEmailsById } from "./address-book-sharees";

const OWNER = "alice@open-paas.org";
const ALICE_ID = "6ad1aa3f53839e067b41b8c1";
const BOB_ID = "6ad1aa3f53839e067b41b8c2";
const CEDRIC_ID = "6ad1aa3f53839e067b41b8c3";

const USER_EMAILS = userEmailsById([
  { id: ALICE_ID, email: OWNER, firstname: "Alice", lastname: "A" },
  { id: BOB_ID, email: "bob@open-paas.org", firstname: "Bob", lastname: "B" },
  { id: CEDRIC_ID, email: "cedric@open-paas.org", firstname: "Cedric", lastname: "C" },
]);

function ace(privilege: string, id: string) {
  return { privilege, principal: `principals/users/${id}`, protected: true };
}

function addressBook(acl: UserAddressBook["acl"], invite?: UserAddressBook["invite"]): UserAddressBook {
  return { _links: { self: { href: `/addressbooks/${ALICE_ID}/contacts.json` } }, "dav:name": "contacts", acl, invite };
}

describe("address book current sharees", () => {
  it("lists the sharees found in the ACL, as the listing carries no invite", () => {
    const book = addressBook([ace("{DAV:}all", ALICE_ID), ace("{DAV:}read", BOB_ID)]);

    expect(currentSharees(book, OWNER, USER_EMAILS)).toEqual([
      { href: "mailto:bob@open-paas.org", label: "bob@open-paas.org", email: "bob@open-paas.org", right: "read" },
    ]);
  });

  it("reads the right back from the strongest privilege granted", () => {
    const book = addressBook([
      ace("{DAV:}all", ALICE_ID),
      ace("{DAV:}write-content", BOB_ID), ace("{DAV:}bind", BOB_ID), ace("{DAV:}unbind", BOB_ID), ace("{DAV:}read", BOB_ID),
      ace("{DAV:}share", CEDRIC_ID), ace("{DAV:}write-content", CEDRIC_ID), ace("{DAV:}read", CEDRIC_ID),
    ]);

    expect(currentSharees(book, OWNER, USER_EMAILS).map((s) => [s.email, s.right])).toEqual([
      ["bob@open-paas.org", "read-write"],
      ["cedric@open-paas.org", "administration"],
    ]);
  });

  it("never lists the owner, even when it only holds the read privilege", () => {
    const book = addressBook([ace("{DAV:}read", ALICE_ID), ace("{DAV:}read", BOB_ID)]);

    expect(currentSharees(book, OWNER, USER_EMAILS).map((s) => s.email)).toEqual(["bob@open-paas.org"]);
  });

  it("ignores the public right and non user principals", () => {
    const book = addressBook([
      ace("{DAV:}all", ALICE_ID),
      { privilege: "{DAV:}read", principal: "{DAV:}authenticated" },
      { privilege: "{DAV:}read", principal: "principals/domains/abc" },
    ]);

    expect(currentSharees(book, OWNER, USER_EMAILS)).toEqual([]);
  });

  it("keeps a sharee with an unknown e-mail, without any href to address it", () => {
    const book = addressBook([ace("{DAV:}all", ALICE_ID), ace("{DAV:}read", "unknown")]);

    expect(currentSharees(book, OWNER, USER_EMAILS)).toEqual([
      { href: null, label: "unknown", email: null, right: "read" },
    ]);
  });

  it("does not list twice a sharee known both by its invite and its ACL", () => {
    const book = addressBook(
      [ace("{DAV:}all", ALICE_ID), ace("{DAV:}read", BOB_ID)],
      [{ href: "mailto:bob@open-paas.org", principal: `principals/users/${BOB_ID}`, access: 2, comment: null, inviteStatus: 2 }],
    );

    expect(currentSharees(book, OWNER, USER_EMAILS).map((s) => s.email)).toEqual(["bob@open-paas.org"]);
  });
});
