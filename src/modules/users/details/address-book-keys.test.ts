import { describe, expect, it } from "vitest";
import type { UserAddressBook } from "../types";
import { addressBookKeys } from "./address-book-keys";

const book = (href: string) => ({ _links: { self: { href } } }) as UserAddressBook;

describe("addressBookKeys", () => {
  it("keys each address book by its href", () => {
    expect(addressBookKeys([book("/addressbooks/a/contacts.json"), book("/addressbooks/a/collected.json")]))
      .toEqual(["/addressbooks/a/contacts.json", "/addressbooks/a/collected.json"]);
  });

  it("keeps the keys unique when the same address book is listed twice", () => {
    const keys = addressBookKeys([
      book("/addressbooks/a/collected.json"),
      book("/addressbooks/a/collected.json"),
      book("/addressbooks/a/contacts.json"),
    ]);

    expect(new Set(keys).size).toBe(3);
    expect(keys[0]).toBe("/addressbooks/a/collected.json");
  });
});
