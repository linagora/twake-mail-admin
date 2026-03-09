import { apiClient } from "@/lib/apiClient";
import { RunTaskResponse } from "@/modules/common-tasks/types";
import { GetUsersResponseType, GetUserMailboxesResponseType, UserQuota, GetUserAliasesResponseType, GetUserForwardsResponseType, RestoreDeletedMessagesRequest, VacationSettings, DeletedMessage, MailSearchRequest, MailSearchResult } from "./types";
import { RateLimits } from "@/components/custom/rate-limits-section";
import { GetUserChannelsResponseType } from "@/modules/network-channels/types";

export const getUsers = async (): Promise<GetUsersResponseType> => {
  const response = await apiClient.get<any, GetUsersResponseType>("/users");
  return response;
};

export const getUserMailboxes = async (username: string): Promise<GetUserMailboxesResponseType> => {
  const response = await apiClient.get<any, GetUserMailboxesResponseType>(
    `/users/${encodeURIComponent(username)}/mailboxes`
  );
  return response;
};

export const createUserMailbox = async (username: string, mailboxName: string): Promise<void> => {
  await apiClient.put(
    `/users/${encodeURIComponent(username)}/mailboxes/${encodeURIComponent(mailboxName)}`
  );
};

export const deleteUserMailbox = async (username: string, mailboxName: string): Promise<void> => {
  await apiClient.delete(
    `/users/${encodeURIComponent(username)}/mailboxes/${encodeURIComponent(mailboxName)}`
  );
};

export const getMailboxMessageCount = async (username: string, mailboxName: string): Promise<number> => {
  const response = await apiClient.get<any, number>(
    `/users/${encodeURIComponent(username)}/mailboxes/${encodeURIComponent(mailboxName)}/messageCount`
  );
  return response;
};

export const getMailboxUnseenCount = async (username: string, mailboxName: string): Promise<number> => {
  const response = await apiClient.get<any, number>(
    `/users/${encodeURIComponent(username)}/mailboxes/${encodeURIComponent(mailboxName)}/unseenMessageCount`
  );
  return response;
};

export const clearMailboxContent = async (username: string, mailboxName: string): Promise<RunTaskResponse> => {
  const response = await apiClient.delete<any, RunTaskResponse>(
    `/users/${encodeURIComponent(username)}/mailboxes/${encodeURIComponent(mailboxName)}/messages`
  );
  return response;
};

export const getUserQuota = async (username: string): Promise<UserQuota> => {
  const response = await apiClient.get<any, UserQuota>(
    `/quota/users/${encodeURIComponent(username)}`
  );
  return response;
};

export const updateUserQuotaSize = async (username: string, size: number): Promise<void> => {
  await apiClient.put(
    `/quota/users/${encodeURIComponent(username)}/size`,
    size,
    { headers: { "Content-Type": "application/json" } }
  );
};

export const deleteUserQuotaSize = async (username: string): Promise<void> => {
  await apiClient.delete(
    `/quota/users/${encodeURIComponent(username)}/size`
  );
};

export const deleteAllUserMailboxes = async (username: string): Promise<void> => {
  await apiClient.delete(
    `/users/${encodeURIComponent(username)}/mailboxes`
  );
};

export const reindexUserMailboxes = async (
  username: string,
  params: { messagesPerSecond?: string; mode?: string }
): Promise<RunTaskResponse> => {
  const query = new URLSearchParams({ task: "reIndex" });
  if (params.messagesPerSecond) query.set("messagesPerSecond", params.messagesPerSecond);
  if (params.mode) query.set("mode", params.mode);
  const response = await apiClient.post<any, RunTaskResponse>(
    `/users/${encodeURIComponent(username)}/mailboxes?${query.toString()}`
  );
  return response;
};

export const subscribeAllUserMailboxes = async (
  username: string
): Promise<RunTaskResponse> => {
  const response = await apiClient.post<any, RunTaskResponse>(
    `/users/${encodeURIComponent(username)}/mailboxes?task=subscribeAll`
  );
  return response;
};

export const getUserAliases = async (username: string): Promise<GetUserAliasesResponseType> => {
  const response = await apiClient.get<any, GetUserAliasesResponseType>(
    `/address/aliases/${encodeURIComponent(username)}`
  );
  return response;
};

export const addUserAlias = async (username: string, alias: string): Promise<void> => {
  await apiClient.put(
    `/address/aliases/${encodeURIComponent(username)}/sources/${encodeURIComponent(alias)}`
  );
};

export const removeUserAlias = async (username: string, alias: string): Promise<void> => {
  await apiClient.delete(
    `/address/aliases/${encodeURIComponent(username)}/sources/${encodeURIComponent(alias)}`
  );
};

export const getUserForwards = async (username: string): Promise<GetUserForwardsResponseType> => {
  try {
    const response = await apiClient.get<any, GetUserForwardsResponseType>(
      `/address/forwards/${encodeURIComponent(username)}`
    );
    return response;
  } catch (err: any) {
    if (err?.response?.status === 404) return [];
    throw err;
  }
};

export const addUserForward = async (username: string, destination: string): Promise<void> => {
  await apiClient.put(
    `/address/forwards/${encodeURIComponent(username)}/targets/${encodeURIComponent(destination)}`
  );
};

export const removeUserForward = async (username: string, destination: string): Promise<void> => {
  await apiClient.delete(
    `/address/forwards/${encodeURIComponent(username)}/targets/${encodeURIComponent(destination)}`
  );
};

export const getUserVacation = async (username: string): Promise<VacationSettings> => {
  return apiClient.get(`/vacation/${encodeURIComponent(username)}`);
};

export const updateUserVacation = async (username: string, settings: Partial<VacationSettings>): Promise<void> => {
  await apiClient.post(`/vacation/${encodeURIComponent(username)}`, settings);
};

export const deleteUserVacation = async (username: string): Promise<void> => {
  await apiClient.delete(`/vacation/${encodeURIComponent(username)}`);
};

export interface JmapIdentityBcc {
  emailerName: string;
  mailAddress: string;
}

export interface JmapIdentityReplyTo {
  emailerName: string;
  mailAddress: string;
}

export interface JmapIdentity {
  id: string;
  name: string;
  email: string;
  mayDelete: boolean;
  textSignature: string;
  htmlSignature: string;
  sortOrder: number;
  bcc: JmapIdentityBcc[];
  replyTo: JmapIdentityReplyTo[];
}

export interface JmapIdentityCreatePayload {
  name: string;
  email: string;
  mayDelete?: boolean;
  textSignature?: string;
  htmlSignature?: string;
  sortOrder?: number;
  bcc?: { email: string; name: string }[];
  replyTo?: { email: string; name: string }[];
}

export interface JmapIdentityUpdatePayload {
  name?: string;
  textSignature?: string;
  htmlSignature?: string;
  sortOrder?: number;
  bcc?: { email: string; name: string }[];
  replyTo?: { email: string; name: string }[];
}

export const getUserIdentities = async (username: string): Promise<JmapIdentity[]> => {
  return apiClient.get(`/users/${encodeURIComponent(username)}/identities`);
};

export const createUserIdentity = async (username: string, payload: JmapIdentityCreatePayload): Promise<void> => {
  await apiClient.post(`/users/${encodeURIComponent(username)}/identities`, payload);
};

export const updateUserIdentity = async (username: string, identityId: string, payload: JmapIdentityUpdatePayload): Promise<void> => {
  await apiClient.put(`/users/${encodeURIComponent(username)}/identities/${encodeURIComponent(identityId)}`, payload);
};

export const getAllowedFromHeaders = async (username: string): Promise<string[]> => {
  return apiClient.get(`/users/${encodeURIComponent(username)}/allowedFromHeaders`);
};

export const getDelegatedUsers = async (username: string): Promise<string[]> => {
  return apiClient.get(`/users/${encodeURIComponent(username)}/authorizedUsers`);
};

export const addDelegatedUser = async (username: string, delegated: string): Promise<void> => {
  await apiClient.put(`/users/${encodeURIComponent(username)}/authorizedUsers/${encodeURIComponent(delegated)}`);
};

export const removeDelegatedUser = async (username: string, delegated: string): Promise<void> => {
  await apiClient.delete(`/users/${encodeURIComponent(username)}/authorizedUsers/${encodeURIComponent(delegated)}`);
};

export const getUserTeamMailboxes = async (username: string): Promise<{ name: string; emailAddress: string }[]> => {
  return apiClient.get(`/users/${encodeURIComponent(username)}/team-mailboxes`);
};

export const getUserChannels = async (username: string): Promise<GetUserChannelsResponseType> => {
  return apiClient.get(`/servers/channels/${encodeURIComponent(username)}`);
};

export const disconnectUserChannels = async (username: string): Promise<void> => {
  await apiClient.delete(`/servers/channels/${encodeURIComponent(username)}`);
};

export const renameUser = async (
  username: string,
  newUsername: string,
  options?: { force?: boolean; fromStep?: string }
): Promise<RunTaskResponse> => {
  const query = new URLSearchParams({ action: "rename" });
  if (options?.force) query.set("force", "");
  if (options?.fromStep) query.set("fromStep", options.fromStep);
  return apiClient.post(
    `/users/${encodeURIComponent(username)}/rename/${encodeURIComponent(newUsername)}?${query.toString()}`
  );
};

export const deleteUserData = async (
  username: string,
  fromStep?: string
): Promise<RunTaskResponse> => {
  const query = new URLSearchParams({ action: "deleteData" });
  if (fromStep) query.set("fromStep", fromStep);
  return apiClient.post(
    `/users/${encodeURIComponent(username)}?${query.toString()}`
  );
};

export const restoreDeletedMessages = async (
  username: string,
  body: RestoreDeletedMessagesRequest
): Promise<RunTaskResponse> => {
  return apiClient.post(
    `/deletedMessages/users/${encodeURIComponent(username)}?action=restore`,
    body
  );
};

export const searchDeletedMessages = async (
  username: string,
  body: RestoreDeletedMessagesRequest
): Promise<DeletedMessage[]> => {
  return apiClient.post(
    `/deletedMessages/users/${encodeURIComponent(username)}/messages`,
    body
  );
};

export const getUserRateLimits = async (username: string): Promise<RateLimits> => {
  return apiClient.get(`/users/${encodeURIComponent(username)}/ratelimits`);
};

export const updateUserRateLimits = async (username: string, limits: RateLimits): Promise<void> => {
  await apiClient.put(`/users/${encodeURIComponent(username)}/ratelimits`, limits, {
    headers: { "Content-Type": "application/json" },
  });
};

export interface UserMappingEntry {
  type: string;
  mapping: string;
}

export const getUserMappings = async (username: string): Promise<UserMappingEntry[]> => {
  return apiClient.get(`/mappings/user/${encodeURIComponent(username)}`);
};

export const getUserMappingSources = async (
  username: string,
  type: "group" | "forward" | "address" | "alias"
): Promise<string[]> => {
  return apiClient.get(`/mappings/sources/${encodeURIComponent(username)}?type=${type}`);
};

export const deleteUserMappingSources = async (
  username: string,
  type: "group" | "forward" | "address" | "alias"
): Promise<void> => {
  await apiClient.delete(`/mappings/sources/${encodeURIComponent(username)}?type=${type}`);
};

export const searchUserMails = async (
  username: string,
  body: MailSearchRequest,
  params: { limit?: number; offset?: number }
): Promise<MailSearchResult[]> => {
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.offset !== undefined) query.set("offset", String(params.offset));
  return apiClient.post(
    `/users/${encodeURIComponent(username)}/mails?${query.toString()}`,
    body
  );
};

export const recomputeFastViewProjection = async (
  username: string,
  params: { messagesPerSecond?: string }
): Promise<RunTaskResponse> => {
  const query = new URLSearchParams({ task: "recomputeFastViewProjectionItems" });
  if (params.messagesPerSecond) query.set("messagesPerSecond", params.messagesPerSecond);
  const response = await apiClient.post<any, RunTaskResponse>(
    `/users/${encodeURIComponent(username)}/mailboxes?${query.toString()}`
  );
  return response;
};
