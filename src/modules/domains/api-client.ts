import { apiClient } from "@/lib/apiClient";
import { RunTaskResponse } from "@/modules/common-tasks/types";
import { GetDomainsResponseType, GetDomainAliasesResponseType, GetTeamMailboxesResponseType, GetTeamMailboxMembersResponseType, DomainQuota, DomainQuotaValues } from "./types";

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

export const deleteAllUsersData = async (domain: string): Promise<RunTaskResponse> => {
  return apiClient.post(`/domains/${encodeURIComponent(domain)}?action=deleteData`);
};
