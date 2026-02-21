import { apiClient } from "@/lib/apiClient";
import { RunTaskResponse } from "@/modules/common-tasks/types";
import { GetDomainsResponseType, GetDomainAliasesResponseType, GetTeamMailboxesResponseType, GetTeamMailboxMembersResponseType, GetTeamMailboxFoldersResponseType, TeamMailboxQuota, DomainQuota, DomainQuotaValues, GetDomainContactsResponseType, DomainContact } from "./types";
import { RateLimits } from "@/components/custom/rate-limits-section";

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
