export interface User {
  username: string;
}

export type GetUsersResponseType = User[];

export interface Mailbox {
  mailboxName: string;
}

export type GetUserMailboxesResponseType = Mailbox[];

export interface QuotaValues {
  count: number | null;
  size: number | null;
}

export interface QuotaOccupation {
  size: number;
  count: number;
  ratio: {
    size: number;
    count: number;
    max: number;
  };
}

export interface UserQuota {
  global: QuotaValues | null;
  domain: QuotaValues | null;
  user: QuotaValues | null;
  computed: QuotaValues | null;
  occupation: QuotaOccupation;
}

export interface AliasSource {
  source: string;
}

export type GetUserAliasesResponseType = AliasSource[];

export interface ForwardDestination {
  mailAddress: string;
}

export type GetUserForwardsResponseType = ForwardDestination[];

export interface RestoreCriterion {
  fieldName: string;
  operator: string;
  value: string;
}

export interface RestoreDeletedMessagesRequest {
  combinator: "and";
  criteria: RestoreCriterion[];
  limit?: number;
}
