import { CalendarAcl, UserAddressBook } from "../types";
import { RegisteredUser } from "@/modules/registered-users/types";
import { AddressBookRight, shareAccessToRight } from "./address-book-share-access";

const USER_PRINCIPAL_PREFIX = "principals/users/";
const OWNER_PRIVILEGE = "{DAV:}all";

// esn-sabre grants a sharee a cumulative set of privileges: the strongest one
// tells the share right back (see `updateAclWithShareAccess` in esn-sabre).
const PRIVILEGE_RIGHTS: { privilege: string; right: AddressBookRight }[] = [
  { privilege: "{DAV:}share", right: "administration" },
  { privilege: "{DAV:}write-content", right: "read-write" },
  { privilege: "{DAV:}read", right: "read" },
];

export interface CurrentSharee {
  // The sharee as the DAV server addresses it on update: a `mailto:` href, the
  // only form esn-sabre resolves to a principal. Null when the e-mail is unknown.
  href: string | null;
  // The e-mail address, or the technical user id when it cannot be resolved.
  label: string;
  email: string | null;
  right: AddressBookRight | null;
}

// Technical user id -> e-mail address, from the registered users list.
export function userEmailsById(registeredUsers: RegisteredUser[] | null): Record<string, string> {
  return Object.fromEntries(
    (registeredUsers ?? []).filter((u) => u.id && u.email).map((u) => [u.id, u.email])
  );
}

function mailtoSharee(email: string, right: AddressBookRight | null): CurrentSharee {
  return { href: `mailto:${email}`, label: email, email, right };
}

function inviteSharees(addressBook: UserAddressBook): CurrentSharee[] {
  return (addressBook.invite ?? [])
    .filter((i) => i.href?.startsWith("mailto:"))
    .map((i) => mailtoSharee(i.href.replace(/^mailto:/, ""), shareAccessToRight(i.access)));
}

function privilegesByUserId(acl: CalendarAcl[]): Map<string, Set<string>> {
  return acl
    .filter((a) => a.principal?.startsWith(USER_PRINCIPAL_PREFIX))
    .reduce((byId, a) => {
      const id = a.principal.slice(USER_PRINCIPAL_PREFIX.length);
      byId.set(id, (byId.get(id) ?? new Set<string>()).add(a.privilege));
      return byId;
    }, new Map<string, Set<string>>());
}

function privilegesToRight(privileges: Set<string>): AddressBookRight | null {
  return PRIVILEGE_RIGHTS.find(({ privilege }) => privileges.has(privilege))?.right ?? null;
}

function aclSharee(id: string, privileges: Set<string>, userEmails: Record<string, string>): CurrentSharee {
  const right = privilegesToRight(privileges);
  const email = userEmails[id];
  return email ? mailtoSharee(email, right) : { href: null, label: id, email: null, right };
}

// The address book listing carries no `invite` for address books: the sharees
// only show up in the ACL, as user principals next to the owner's one.
function aclSharees(addressBook: UserAddressBook, owner: string, userEmails: Record<string, string>): CurrentSharee[] {
  return [...privilegesByUserId(addressBook.acl ?? [])]
    .filter(([id, privileges]) => !privileges.has(OWNER_PRIVILEGE) && userEmails[id]?.toLowerCase() !== owner.toLowerCase())
    .map(([id, privileges]) => aclSharee(id, privileges, userEmails));
}

export function currentSharees(
  addressBook: UserAddressBook,
  owner: string,
  userEmails: Record<string, string>,
): CurrentSharee[] {
  const invited = inviteSharees(addressBook);
  const invitedEmails = new Set(invited.map((s) => s.email));
  return [
    ...invited,
    ...aclSharees(addressBook, owner, userEmails).filter((s) => !s.email || !invitedEmails.has(s.email)),
  ];
}
