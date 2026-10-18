import { UserAddressBook } from "../types";

// WebAdmin may list the same address book twice (see
// linagora/twake-calendar-side-service#1193): a key made of its href alone then
// collides, and React leaves a ghost row once the list changes (see issue
// #363). The occurrence number keeps the keys unique while staying stable for
// the first copy.
export function addressBookKeys(addressBooks: UserAddressBook[]): string[] {
  const seen = new Map<string, number>();
  return addressBooks.map((addressBook) => {
    const href = addressBook._links?.self?.href ?? "";
    const occurrence = seen.get(href) ?? 0;
    seen.set(href, occurrence + 1);
    return occurrence === 0 ? href : `${href}#${occurrence}`;
  });
}
