import { apiClient } from "@/lib/apiClient";
import { RunTaskResponse } from "@/modules/common-tasks/types";
import { GetDomainsResponseType, GetDomainAliasesResponseType, GetTeamMailboxesResponseType, GetTeamMailboxMembersResponseType, GetTeamMailboxFoldersResponseType, TeamMailboxQuota, DomainQuota, DomainQuotaValues, GetDomainContactsResponseType, DomainContact, Resource, DomainSettings, DomainSettingsValues, TeamCalendar, TeamCalendarMember, TeamCalendarShareUpdate } from "./types";
import { RateLimits } from "@/components/custom/rate-limits-section";
import { DeletedMessage, RestoreDeletedMessagesRequest } from "@/modules/users/types";

export const getDomainUsers = async (domain: string): Promise<string[]> => {
  return apiClient.get(`/domains/${encodeURIComponent(domain)}/users`);
};

export const getDomains = async (): Promise<GetDomainsResponseType> => {
  const response = await apiClient.get<any, GetDomainsResponseType>("/domains");
  return response;
};

export const createDomain = async (domain: string): Promise<void> => {
  await apiClient.put(`/domains/${encodeURIComponent(domain)}`);
};

export const deleteDomain = async (domain: string): Promise<void> => {
  await apiClient.delete(`/domains/${encodeURIComponent(domain)}`);
};

export const getDomainAliases = async (domain: string): Promise<GetDomainAliasesResponseType> => {
  return apiClient.get(`/domains/${encodeURIComponent(domain)}/aliases`);
};

export const addDomainAlias = async (domain: string, source: string): Promise<void> => {
  await apiClient.put(`/domains/${encodeURIComponent(domain)}/aliases/${encodeURIComponent(source)}`);
};

export const removeDomainAlias = async (domain: string, source: string): Promise<void> => {
  await apiClient.delete(`/domains/${encodeURIComponent(domain)}/aliases/${encodeURIComponent(source)}`);
};

export const getDomainQuota = async (domain: string): Promise<DomainQuota> => {
  return apiClient.get(`/quota/domains/${encodeURIComponent(domain)}`);
};

export const updateDomainQuota = async (domain: string, quota: DomainQuotaValues): Promise<void> => {
  await apiClient.put(`/quota/domains/${encodeURIComponent(domain)}`, quota);
};

export const getTeamMailboxes = async (domain: string): Promise<GetTeamMailboxesResponseType> => {
  return apiClient.get(`/domains/${encodeURIComponent(domain)}/team-mailboxes`);
};

export const createTeamMailbox = async (domain: string, name: string): Promise<void> => {
  await apiClient.put(`/domains/${encodeURIComponent(domain)}/team-mailboxes/${encodeURIComponent(name)}`);
};

export const deleteTeamMailbox = async (domain: string, name: string): Promise<void> => {
  await apiClient.delete(`/domains/${encodeURIComponent(domain)}/team-mailboxes/${encodeURIComponent(name)}`);
};

export const getTeamMailboxMembers = async (domain: string, mailbox: string): Promise<GetTeamMailboxMembersResponseType> => {
  return apiClient.get(`/domains/${encodeURIComponent(domain)}/team-mailboxes/${encodeURIComponent(mailbox)}/members`);
};

export const addTeamMailboxMember = async (domain: string, mailbox: string, username: string, role: string = "member"): Promise<void> => {
  await apiClient.put(`/domains/${encodeURIComponent(domain)}/team-mailboxes/${encodeURIComponent(mailbox)}/members/${encodeURIComponent(username)}?role=${encodeURIComponent(role)}`);
};

export const removeTeamMailboxMember = async (domain: string, mailbox: string, username: string): Promise<void> => {
  await apiClient.delete(`/domains/${encodeURIComponent(domain)}/team-mailboxes/${encodeURIComponent(mailbox)}/members/${encodeURIComponent(username)}`);
};

export const getTeamMailboxFolders = async (domain: string, mailbox: string): Promise<GetTeamMailboxFoldersResponseType> => {
  return apiClient.get(`/domains/${encodeURIComponent(domain)}/team-mailboxes/${encodeURIComponent(mailbox)}/mailboxes`);
};

export const createTeamMailboxFolder = async (domain: string, mailbox: string, folderName: string): Promise<void> => {
  await apiClient.put(`/domains/${encodeURIComponent(domain)}/team-mailboxes/${encodeURIComponent(mailbox)}/mailboxes/${encodeURIComponent(folderName)}`);
};

export const deleteTeamMailboxFolder = async (domain: string, mailbox: string, folderName: string): Promise<void> => {
  await apiClient.delete(`/domains/${encodeURIComponent(domain)}/team-mailboxes/${encodeURIComponent(mailbox)}/mailboxes/${encodeURIComponent(folderName)}`);
};

export const getTeamMailboxFolderMessageCount = async (domain: string, mailbox: string, folderName: string): Promise<number> => {
  return apiClient.get(`/domains/${encodeURIComponent(domain)}/team-mailboxes/${encodeURIComponent(mailbox)}/mailboxes/${encodeURIComponent(folderName)}/messageCount`);
};

export const getTeamMailboxFolderUnseenCount = async (domain: string, mailbox: string, folderName: string): Promise<number> => {
  return apiClient.get(`/domains/${encodeURIComponent(domain)}/team-mailboxes/${encodeURIComponent(mailbox)}/mailboxes/${encodeURIComponent(folderName)}/unseenMessageCount`);
};

export const getTeamMailboxFolderSubaddressing = async (domain: string, mailbox: string, folderName: string): Promise<{ enabled: boolean }> => {
  return apiClient.get(`/domains/${encodeURIComponent(domain)}/team-mailboxes/${encodeURIComponent(mailbox)}/mailboxes/${encodeURIComponent(folderName)}/subaddressing`);
};

export const setTeamMailboxFolderSubaddressing = async (domain: string, mailbox: string, folderName: string, enabled: boolean): Promise<void> => {
  await apiClient.put(
    `/domains/${encodeURIComponent(domain)}/team-mailboxes/${encodeURIComponent(mailbox)}/mailboxes/${encodeURIComponent(folderName)}/subaddressing`,
    { enabled },
    { headers: { "Content-Type": "application/json" } }
  );
};

export const getTeamMailboxFolderExtraAcl = async (domain: string, mailbox: string, folderName: string): Promise<Record<string, string>> => {
  return apiClient.get(`/domains/${encodeURIComponent(domain)}/team-mailboxes/${encodeURIComponent(mailbox)}/mailboxes/${encodeURIComponent(folderName)}/extraAcl`);
};

export const setTeamMailboxFolderExtraAclEntry = async (domain: string, mailbox: string, folderName: string, username: string, rights: string): Promise<void> => {
  await apiClient.put(
    `/domains/${encodeURIComponent(domain)}/team-mailboxes/${encodeURIComponent(mailbox)}/mailboxes/${encodeURIComponent(folderName)}/extraAcl/${encodeURIComponent(username)}`,
    rights,
    { headers: { "Content-Type": "text/plain" } }
  );
};

export const removeTeamMailboxFolderExtraAclEntry = async (domain: string, mailbox: string, folderName: string, username: string): Promise<void> => {
  await apiClient.delete(`/domains/${encodeURIComponent(domain)}/team-mailboxes/${encodeURIComponent(mailbox)}/mailboxes/${encodeURIComponent(folderName)}/extraAcl/${encodeURIComponent(username)}`);
};

export const clearTeamMailboxFolderExtraAcl = async (domain: string, mailbox: string, folderName: string): Promise<void> => {
  await apiClient.delete(`/domains/${encodeURIComponent(domain)}/team-mailboxes/${encodeURIComponent(mailbox)}/mailboxes/${encodeURIComponent(folderName)}/extraAcl`);
};

export const getTeamMailboxExtraSenders = async (domain: string, mailbox: string): Promise<string[]> => {
  return apiClient.get(`/domains/${encodeURIComponent(domain)}/team-mailboxes/${encodeURIComponent(mailbox)}/extraSenders`);
};

export const addTeamMailboxExtraSender = async (domain: string, mailbox: string, username: string): Promise<void> => {
  await apiClient.put(`/domains/${encodeURIComponent(domain)}/team-mailboxes/${encodeURIComponent(mailbox)}/extraSenders/${encodeURIComponent(username)}`);
};

export const removeTeamMailboxExtraSender = async (domain: string, mailbox: string, username: string): Promise<void> => {
  await apiClient.delete(`/domains/${encodeURIComponent(domain)}/team-mailboxes/${encodeURIComponent(mailbox)}/extraSenders/${encodeURIComponent(username)}`);
};

export const getTeamMailboxQuota = async (domain: string, mailbox: string): Promise<TeamMailboxQuota> => {
  return apiClient.get(`/domains/${encodeURIComponent(domain)}/team-mailboxes/${encodeURIComponent(mailbox)}/quota`);
};

export const updateTeamMailboxQuotaSize = async (domain: string, mailbox: string, size: number): Promise<void> => {
  await apiClient.put(
    `/domains/${encodeURIComponent(domain)}/team-mailboxes/${encodeURIComponent(mailbox)}/quota/limit/size`,
    size,
    { headers: { "Content-Type": "application/json" } }
  );
};

export const deleteTeamMailboxQuotaSize = async (domain: string, mailbox: string): Promise<void> => {
  await apiClient.delete(
    `/domains/${encodeURIComponent(domain)}/team-mailboxes/${encodeURIComponent(mailbox)}/quota/limit/size`
  );
};

export const deleteAllUsersData = async (domain: string): Promise<RunTaskResponse> => {
  return apiClient.post(`/domains/${encodeURIComponent(domain)}?action=deleteData`);
};

export const getDomainContacts = async (domain: string): Promise<GetDomainContactsResponseType> => {
  return apiClient.get(`/domains/${encodeURIComponent(domain)}/contacts`);
};

export const getDomainContact = async (domain: string, username: string): Promise<DomainContact> => {
  return apiClient.get(`/domains/${encodeURIComponent(domain)}/contacts/${encodeURIComponent(username)}`);
};

export const createDomainContact = async (
  domain: string,
  payload: { emailAddress: string; firstname?: string; surname?: string }
): Promise<{ id: string }> => {
  return apiClient.post(`/domains/${encodeURIComponent(domain)}/contacts`, payload);
};

export const updateDomainContact = async (
  domain: string,
  username: string,
  payload: { firstname?: string; surname?: string }
): Promise<void> => {
  await apiClient.put(`/domains/${encodeURIComponent(domain)}/contacts/${encodeURIComponent(username)}`, payload);
};

export const deleteDomainContact = async (domain: string, username: string): Promise<void> => {
  await apiClient.delete(`/domains/${encodeURIComponent(domain)}/contacts/${encodeURIComponent(username)}`);
};

export const getDomainRateLimits = async (domain: string): Promise<RateLimits> => {
  return apiClient.get(`/domains/${encodeURIComponent(domain)}/ratelimits`);
};

export const updateDomainRateLimits = async (domain: string, limits: RateLimits): Promise<void> => {
  await apiClient.put(`/domains/${encodeURIComponent(domain)}/ratelimits`, limits, {
    headers: { "Content-Type": "application/json" },
  });
};

export const searchTeamMailboxDeletedMessages = async (
  domain: string,
  mailbox: string,
  body: RestoreDeletedMessagesRequest
): Promise<DeletedMessage[]> => {
  const address = encodeURIComponent(`${mailbox}@${domain}`);
  return apiClient.post(`/deletedMessages/users/${address}/messages?force=true`, body);
};

export const restoreTeamMailboxDeletedMessages = async (
  domain: string,
  mailbox: string
): Promise<RunTaskResponse> => {
  const address = encodeURIComponent(`${mailbox}@${domain}`);
  return apiClient.post(`/deletedMessages/teamMailbox/${address}?action=restore`);
};

// ---------------------------------------------------------------------------
// Signature templates
// ---------------------------------------------------------------------------

export interface SignatureTemplate {
  language: string;
  textSignature: string;
  htmlSignature: string;
}

export const getDomainSignatureTemplates = async (domain: string): Promise<SignatureTemplate[]> => {
  const response: { signatures: SignatureTemplate[] } = await apiClient.get(
    `/domains/${encodeURIComponent(domain)}/signature-templates`
  );
  return response.signatures ?? [];
};

export const updateDomainSignatureTemplates = async (domain: string, signatures: SignatureTemplate[]): Promise<void> => {
  await apiClient.put(
    `/domains/${encodeURIComponent(domain)}/signature-templates`,
    { signatures },
    { headers: { "Content-Type": "application/json" } }
  );
};

export const deleteDomainSignatureTemplates = async (domain: string): Promise<void> => {
  await apiClient.delete(`/domains/${encodeURIComponent(domain)}/signature-templates`);
};

export interface ApplySignatureTemplatesResult {
  applied: number;
  skipped: number;
  error: number;
}

export const applyDomainSignatureTemplates = async (domain: string): Promise<ApplySignatureTemplatesResult> => {
  return apiClient.post(
    `/domains/${encodeURIComponent(domain)}/signature-templates?action=apply`
  );
};

// ---------------------------------------------------------------------------
// Domain settings (calendar)
// ---------------------------------------------------------------------------

export const getDomainSettings = async (domain: string): Promise<DomainSettings> => {
  return apiClient.get(`/domains/${encodeURIComponent(domain)}/settings`);
};

export const updateDomainSettings = async (domain: string, settings: DomainSettingsValues): Promise<void> => {
  await apiClient.put(`/domains/${encodeURIComponent(domain)}/settings`, settings, {
    headers: { "Content-Type": "application/json" },
  });
};

// ---------------------------------------------------------------------------
// Calendar-specific domain functions
// ---------------------------------------------------------------------------

export const getDomainAdmins = async (domain: string): Promise<string[]> => {
  return apiClient.get(`/domains/${encodeURIComponent(domain)}/admins`);
};

export const addDomainAdmin = async (domain: string, username: string): Promise<void> => {
  await apiClient.put(`/domains/${encodeURIComponent(domain)}/admins/${encodeURIComponent(username)}`);
};

export const removeDomainAdmin = async (domain: string, username: string): Promise<void> => {
  await apiClient.delete(`/domains/${encodeURIComponent(domain)}/admins/${encodeURIComponent(username)}`);
};

export const syncDomainMembers = async (domain: string): Promise<RunTaskResponse> => {
  return apiClient.post(`/addressbook/domain-members/${encodeURIComponent(domain)}?task=sync`);
};

export const provisionDomainTemplates = async (
  domain: string,
  params: { from: string; folderName?: string; overwriteExisting?: boolean; prune?: boolean; usersPerSecond?: string }
): Promise<RunTaskResponse> => {
  const query = new URLSearchParams({ action: "provision", from: params.from });
  if (params.folderName) query.set("folderName", params.folderName);
  if (params.overwriteExisting) query.set("overwriteExisting", "true");
  if (params.prune) query.set("prune", "true");
  if (params.usersPerSecond) query.set("usersPerSecond", params.usersPerSecond);
  return apiClient.post(
    `/domains/${encodeURIComponent(domain)}/templates?${query.toString()}`
  );
};

// ---------------------------------------------------------------------------
// Resource API — domain-scoped routes with fallback to legacy routes
//
// Probe result is cached for the lifetime of the page session so that we
// only pay the fallback cost once.
// ---------------------------------------------------------------------------

// null = not yet probed | 'new' = use domain-scoped API | 'old' = use legacy API
let resourceApiVersion: 'new' | 'old' | null = null;

async function withResourceApiFallback<T>(
  newApiFn: () => Promise<T>,
  oldApiFn: () => Promise<T>,
): Promise<T> {
  // Version already determined for this session — call directly, no fallback.
  if (resourceApiVersion === 'new') return newApiFn();
  if (resourceApiVersion === 'old') return oldApiFn();

  // First call: probe the new domain-scoped API.
  try {
    const result = await newApiFn();
    resourceApiVersion = 'new';
    return result;
  } catch (err: any) {
    const status: number | undefined = err?.response?.status;
    if (status !== undefined && status >= 400 && status < 500) {
      resourceApiVersion = 'old';
      return oldApiFn();
    }
    throw err;
  }
}

export const getResources = async (domain: string): Promise<Resource[]> =>
  withResourceApiFallback(
    () => apiClient.get(`/domains/${encodeURIComponent(domain)}/resources`),
    () => apiClient.get(`/resources?domain=${encodeURIComponent(domain)}`),
  );

export const getResource = async (domain: string, id: string): Promise<Resource> =>
  withResourceApiFallback(
    () => apiClient.get(`/domains/${encodeURIComponent(domain)}/resources/${encodeURIComponent(id)}`),
    () => apiClient.get(`/resources/${encodeURIComponent(id)}`),
  );

export const createResource = async (payload: {
  name: string;
  description: string;
  icon: string;
  domain: string;
  creator: string;
  administrators: { email: string }[];
}): Promise<void> => {
  const { domain, ...bodyWithoutDomain } = payload;
  return withResourceApiFallback(
    () => apiClient.post(`/domains/${encodeURIComponent(domain)}/resources`, bodyWithoutDomain),
    () => apiClient.post('/resources', payload),
  );
};

export const deleteResource = async (domain: string, id: string): Promise<void> =>
  withResourceApiFallback(
    () => apiClient.delete(`/domains/${encodeURIComponent(domain)}/resources/${encodeURIComponent(id)}`),
    () => apiClient.delete(`/resources/${encodeURIComponent(id)}`),
  );

export const updateResource = async (domain: string, id: string, payload: Partial<Resource>): Promise<void> =>
  withResourceApiFallback(
    () => apiClient.patch(`/domains/${encodeURIComponent(domain)}/resources/${encodeURIComponent(id)}`, payload),
    () => apiClient.patch(`/resources/${encodeURIComponent(id)}`, payload),
  );

export const repositionResourceWriteRights = async (domain: string): Promise<RunTaskResponse> =>
  withResourceApiFallback(
    () => apiClient.post(`/domains/${encodeURIComponent(domain)}/resources?task=repositionWriteRights`),
    () => apiClient.post(`/resources?task=repositionWriteRights`),
  );

// ---------------------------------------------------------------------------
// Team calendar API — domain-scoped routes (CALENDAR application only)
// ---------------------------------------------------------------------------

export const getTeamCalendars = async (domain: string): Promise<TeamCalendar[]> =>
  apiClient.get(`/domains/${encodeURIComponent(domain)}/team-calendars`);

export const getTeamCalendar = async (domain: string, id: string): Promise<TeamCalendar> =>
  apiClient.get(`/domains/${encodeURIComponent(domain)}/team-calendars/${encodeURIComponent(id)}`);

export const createTeamCalendar = async (
  domain: string,
  payload: { name: string; displayName: string },
): Promise<TeamCalendar> =>
  apiClient.post(`/domains/${encodeURIComponent(domain)}/team-calendars`, payload);

export const updateTeamCalendar = async (
  domain: string,
  id: string,
  payload: { displayName: string },
): Promise<void> =>
  apiClient.patch(`/domains/${encodeURIComponent(domain)}/team-calendars/${encodeURIComponent(id)}`, payload);

export const deleteTeamCalendar = async (domain: string, id: string): Promise<void> =>
  apiClient.delete(`/domains/${encodeURIComponent(domain)}/team-calendars/${encodeURIComponent(id)}`);

export const getTeamCalendarMembers = async (domain: string, id: string): Promise<TeamCalendarMember[]> =>
  apiClient.get(`/domains/${encodeURIComponent(domain)}/team-calendars/${encodeURIComponent(id)}/members`);

export const updateTeamCalendarMembers = async (
  domain: string,
  id: string,
  share: TeamCalendarShareUpdate,
): Promise<void> =>
  apiClient.post(`/domains/${encodeURIComponent(domain)}/team-calendars/${encodeURIComponent(id)}/members/invitee`, { share });
