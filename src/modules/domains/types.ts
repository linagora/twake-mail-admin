export type GetDomainsResponseType = string[];

export interface DomainAliasSource {
  source: string;
}

export type GetDomainAliasesResponseType = DomainAliasSource[];

export interface TeamMailbox {
  name: string;
  emailAddress: string;
}

export type GetTeamMailboxesResponseType = TeamMailbox[];

export interface TeamMailboxMember {
  username: string;
  role: string;
}

export type GetTeamMailboxMembersResponseType = TeamMailboxMember[];

export interface DomainContact {
  id: string;
  emailAddress: string;
  firstname?: string;
  surname?: string;
}

export type GetDomainContactsResponseType = string[];

export interface DomainQuotaValues {
  count: number | null;
  size: number | null;
}

export interface DomainQuota {
  global: DomainQuotaValues;
  domain: DomainQuotaValues;
  computed: DomainQuotaValues;
}
