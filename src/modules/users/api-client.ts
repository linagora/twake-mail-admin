import { apiClient } from "@/lib/apiClient";
import { RunTaskResponse } from "@/modules/common-tasks/types";
import { GetUsersResponseType, GetUserMailboxesResponseType, UserQuota, GetUserAliasesResponseType, GetUserForwardsResponseType, RestoreDeletedMessagesRequest } from "./types";

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

export const restoreDeletedMessages = async (
  username: string,
  body: RestoreDeletedMessagesRequest
): Promise<RunTaskResponse> => {
  return apiClient.post(
    `/deletedMessages/users/${encodeURIComponent(username)}?action=restore`,
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
