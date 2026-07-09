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

// Domain settings (calendar)
export type UserSearchMode = "enabled" | "limited" | "disabled";
export type CalendarPublicVisibility = "read" | "private";

export interface DomainSettingsValues {
  userSearchMode: UserSearchMode | null;
  resourceSearchEnabled: boolean | null;
  defaultCalendarPublicVisibility: CalendarPublicVisibility | null;
  calendarPublicVisibilitySettingEnabled: boolean | null;
}

export interface DomainSettings extends DomainSettingsValues {
  resolved: {
    userSearchMode: UserSearchMode;
    resourceSearchEnabled: boolean;
    defaultCalendarPublicVisibility: CalendarPublicVisibility;
    calendarPublicVisibilitySettingEnabled: boolean;
  };
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

export interface TeamCalendar {
  id: string;
  domainId: string;
  domainName: string;
  name: string;
  displayName: string;
  creation: string;
  updated: string;
}

export type TeamCalendarMemberRole = "viewer" | "member" | "manager";

export interface TeamCalendarMember {
  username: string;
  role: TeamCalendarMemberRole;
  davRight: string;
}

export interface TeamCalendarShareSetEntry {
  "dav:href": string;
  "dav:read"?: boolean;
  "dav:read-write"?: boolean;
  "dav:administration"?: boolean;
}

export interface TeamCalendarShareUpdate {
  set?: TeamCalendarShareSetEntry[];
  remove?: { "dav:href": string }[];
}
