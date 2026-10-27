import axios from "axios";
import { apiClient } from "@/lib/apiClient";
import { SpaceSyncScope, TwakeSpace, TwakeSpaceBinding, bindingBody, syncSpacesQuery, teamMailboxSpacePath } from "./space";

// A 404 means no space, or a server without the Twake Space extension: both read as "not bound"
export const getTeamMailboxSpace = async (domain: string, mailbox: string): Promise<TwakeSpace | null> => {
  try {
    return await apiClient.get(teamMailboxSpacePath(domain, mailbox));
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
};

export const bindTeamMailboxSpace = async (domain: string, mailbox: string, binding: TwakeSpaceBinding): Promise<void> => {
  await apiClient.put(teamMailboxSpacePath(domain, mailbox), bindingBody(binding));
};

// Only publishes the request: the sync itself happens asynchronously, no task is created
export const requestSpacesSync = async (scope: SpaceSyncScope): Promise<void> => {
  await apiClient.post(`/spaces?${syncSpacesQuery(scope)}`);
};
