import { RegisteredUser } from "@/modules/registered-users/types";

// A shared or subscribed address book is a mirror of its owner's one, which it
// references through "openpaas:source": /addressbooks/{ownerId}/{addressBookId}.json,
// possibly prefixed by the DAV base URI. The owner is a technical user id, never an email.
export interface AddressBookSource {
  ownerId: string;
  addressBookId: string;
}

const SOURCE_PATH = /\/addressbooks\/([^/]+)\/([^/]+?)(?:\.json)?\/?$/;

function sourceHref(source: unknown): string | null {
  if (typeof source === "string") return source;
  const href = (source as { _links?: { self?: { href?: unknown } } } | null)?._links?.self?.href;
  return typeof href === "string" ? href : null;
}

export function parseAddressBookSource(source: unknown): AddressBookSource | null {
  const match = sourceHref(source)?.match(SOURCE_PATH);
  if (!match) return null;
  const [, ownerId, addressBookId] = match;
  return { ownerId: decodeURIComponent(ownerId), addressBookId: decodeURIComponent(addressBookId) };
}

export function ownerEmail(
  source: AddressBookSource | null,
  registeredUsers: RegisteredUser[] | null | undefined,
): string | null {
  if (!source) return null;
  return registeredUsers?.find((user) => user.id === source.ownerId)?.email || null;
}
