import { describe, expect, it } from "vitest";
import { ownerEmail, parseAddressBookSource } from "./address-book-source";

const ALICE = { id: "6ad1aa3f53839e067b41b8c1", email: "alice@open-paas.org", firstname: "Alice", lastname: "A" };

describe("address book source", () => {
  it("reads the owner id and the address book id of the source", () => {
    expect(parseAddressBookSource("/addressbooks/6ad1aa3f53839e067b41b8c1/contacts.json"))
      .toEqual({ ownerId: "6ad1aa3f53839e067b41b8c1", addressBookId: "contacts" });
  });

  it("ignores the DAV base URI prefixing the source", () => {
    expect(parseAddressBookSource("https://dav.example.com/esn-sabre/addressbooks/6ad1aa3f53839e067b41b8c1/collected.json"))
      .toEqual({ ownerId: "6ad1aa3f53839e067b41b8c1", addressBookId: "collected" });
  });

  it("accepts a source given as a HAL link", () => {
    expect(parseAddressBookSource({ _links: { self: { href: "/addressbooks/6ad1aa3f53839e067b41b8c1/contacts.json" } } }))
      .toEqual({ ownerId: "6ad1aa3f53839e067b41b8c1", addressBookId: "contacts" });
  });

  it("has no source for an owned address book", () => {
    expect(parseAddressBookSource(undefined)).toBeNull();
    expect(parseAddressBookSource("")).toBeNull();
    expect(parseAddressBookSource("/calendars/6ad1aa3f53839e067b41b8c1/events.json")).toBeNull();
  });

  it("resolves the owner email from the registered users", () => {
    const source = parseAddressBookSource("/addressbooks/6ad1aa3f53839e067b41b8c1/contacts.json");
    expect(ownerEmail(source, [ALICE])).toBe("alice@open-paas.org");
  });

  it("has no owner email when the owner is unknown or users are not loaded", () => {
    const source = parseAddressBookSource("/addressbooks/unknown/contacts.json");
    expect(ownerEmail(source, [ALICE])).toBeNull();
    expect(ownerEmail(source, null)).toBeNull();
    expect(ownerEmail(null, [ALICE])).toBeNull();
  });
});
