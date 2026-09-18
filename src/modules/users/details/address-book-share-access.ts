// `dav:share-access` codes of the WebDAV sharing spec, as implemented by the DAV
// server (esn-sabre): the codes travel verbatim from here down to Sabre, so they
// must match `Sabre\DAV\Sharing\Plugin` / `ESN\DAV\Sharing\Plugin` exactly.
// See esn-sabre `doc/JSON-API.md` — "Share an address book".
export type AddressBookRight = "read" | "read-write" | "administration";

export const ADDRESS_BOOK_RIGHTS: AddressBookRight[] = ["read", "read-write", "administration"];

const SHARE_ACCESS: Record<AddressBookRight, number> = {
  read: 2,
  "read-write": 3,
  administration: 5,
};

// Revoking a share is not a right: it is expressed with the "no access" code.
export const SHARE_ACCESS_NO_ACCESS = 4;

export function rightToShareAccess(right: AddressBookRight): number {
  return SHARE_ACCESS[right];
}

export function shareAccessToRight(access: number): AddressBookRight | null {
  return ADDRESS_BOOK_RIGHTS.find((right) => SHARE_ACCESS[right] === access) ?? null;
}
