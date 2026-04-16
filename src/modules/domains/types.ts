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

export interface TeamMailboxFolder {
  mailboxName: string;
  mailboxId: string;
}

export type GetTeamMailboxFoldersResponseType = TeamMailboxFolder[];

export interface TeamMailboxQuotaValues {
  count: number | null;
  size: number | null;
}

export interface TeamMailboxQuotaOccupation {
  size: number;
  count: number;
  ratio: {
    size: number;
    count: number;
    max: number;
  };
}

export interface TeamMailboxQuota {
  global: TeamMailboxQuotaValues | null;
  domain: TeamMailboxQuotaValues | null;
  teamMailbox: TeamMailboxQuotaValues | null;
  computed: TeamMailboxQuotaValues | null;
  occupation: TeamMailboxQuotaOccupation;
}

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

// Calendar-specific types
export interface ResourceAdmin {
  email: string;
}

export interface Resource {
  id: string;
  name: string;
  deleted: boolean;
  description: string;
  icon: string;
  domain: string;
  creator: string;
  administrators: ResourceAdmin[];
}
