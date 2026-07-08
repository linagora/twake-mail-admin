export type MailingListAddresses = string[];

export interface MailingListDetail {
  mail: string;
  businessCategory?: string;
  members: string[];
  owners: string[];
}
