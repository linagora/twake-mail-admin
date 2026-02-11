import { apiClient } from "@/lib/apiClient";
import { GetUsersResponseType, GetUserMailboxesResponseType } from "./types";

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
