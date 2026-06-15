export interface User {
  username: string;
}

export type GetUsersResponseType = User[];

export interface Mailbox {
  mailboxName: string;
  mailboxId: string;
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

export interface VacationSettings {
  enabled: boolean;
  fromDate?: string;
  toDate?: string;
  subject?: string;
  textBody?: string;
  htmlBody?: string;
}

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

export interface EmailAddress {
  name?: string;
  email: string;
}

export interface MailSearchFilter {
  text?: string;
  from?: string;
  to?: string;
  subject?: string;
  hasAttachment?: boolean;
  hasKeywords?: string[];
  inMailboxes?: string[];
  inMailboxOtherThan?: string[];
  before?: string;
  after?: string;
}

export interface MailSearchSort {
  property: "receivedAt" | "from" | "subject";
  isAscending?: boolean;
}

export interface MailSearchRequest {
  reason: string;
  filter?: MailSearchFilter;
  sort?: MailSearchSort[];
}

export interface MailSearchResult {
  id: string;
  keywords?: Record<string, boolean>;
  mailboxIds?: Record<string, boolean>;
  receivedAt?: string;
  from?: EmailAddress[];
  to?: EmailAddress[];
  hasAttachment?: boolean;
  preview?: string;
  subject?: string;
}

export interface UserLabel {
  id: string;
  displayName: string;
  keyword: string;
  color?: string;
  description?: string;
  readOnly: boolean;
}

export interface UserLabelCreatePayload {
  displayName: string;
  keyword?: string;
  color?: string;
  description?: string;
}

export interface UserLabelUpdatePayload {
  displayName: string;
  color?: string | null;
  description?: string | null;
  readOnly?: boolean;
}

export interface CalendarInvite {
  href: string;
  principal: string;
  access: number;
  comment: string | null;
  inviteStatus: number;
}

export interface CalendarAcl {
  privilege: string;
  principal: string;
  protected?: boolean;
}

export interface CalendarSource {
  _links?: { self?: { href?: string } };
  invite?: CalendarInvite[];
  acl?: CalendarAcl[];
}

export interface UserCalendar {
  _links?: { self?: { href?: string } };
  "dav:name"?: string;
  "caldav:description"?: string;
  "apple:color"?: string;
  "calendarserver:delegatedsource"?: string;
  "calendarserver:source"?: CalendarSource;
  invite?: CalendarInvite[];
  acl?: CalendarAcl[];
}

export interface GetUserCalendarsResponseType {
  _embedded?: {
    "dav:calendar"?: UserCalendar[];
  };
}

export interface CreateUserCalendarPayload {
  id?: string;
  "dav:name": string;
  "apple:color"?: string;
  "caldav:description"?: string;
}

export interface UpdateUserCalendarPayload {
  "dav:name"?: string;
  "apple:color"?: string;
  "caldav:description"?: string;
}

export interface CalendarShareSetEntry {
  "dav:href": string;
  "dav:read"?: boolean;
  "dav:read-write"?: boolean;
  "dav:administration"?: boolean;
}

export interface CalendarShareUpdate {
  set?: CalendarShareSetEntry[];
  remove?: { "dav:href": string }[];
}

export interface DeletedMessage {
  messageId: string;
  originMailboxes: string[];
  owner: string;
  deliveryDate: string;
  deletionDate: string;
  sender: string;
  recipients: string[];
  subject: string;
  hasAttachment: boolean;
  size: number;
}
