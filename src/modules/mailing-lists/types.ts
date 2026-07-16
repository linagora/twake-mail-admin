export type MailingListAddresses = string[];

/** Accepted `businessCategory` values, as enforced by the webadmin route. */
export const BUSINESS_CATEGORIES = [
  "openList",
  "internalList",
  "memberRestrictedList",
  "ownerRestrictedList",
  "domainRestrictedList",
] as const;

export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number];

export interface MailingListDetail {
  mail: string;
  businessCategory?: string;
  members: string[];
  owners: string[];
}

export interface CreateMailingListRequest {
  businessCategory?: BusinessCategory;
  /** Mandatory, at least one address: a groupOfNames list cannot be empty. */
  members: string[];
  owners?: string[];
}
