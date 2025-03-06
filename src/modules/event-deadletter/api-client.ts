import { apiClient } from "@/lib/apiClient";
import {
  ListenerGroupsResponseType,
  InsertionIdsResponseType,
  EventDetails,
  TaskResponse,
} from "./types";

/**
 * Fetches the list of mailbox listener groups.
 *
 * API: `GET /events/deadLetter/groups`
 */
export const getMailboxListenerGroups =
  async (): Promise<ListenerGroupsResponseType> => {
    const response = await apiClient.get<any, ListenerGroupsResponseType>(
      "/events/deadLetter/groups"
    );
    return response;
  };

/**
 * Fetches the list of failed event insertion IDs for a given group.
 *
 * API: `GET /events/deadLetter/groups/:group`
 */
export const getFailedEvents = async (
  group: string
): Promise<InsertionIdsResponseType> => {
  const response = await apiClient.get<any, InsertionIdsResponseType>(
    `/events/deadLetter/groups/${encodeURIComponent(group)}`
  );
  return response;
};

/**
 * Fetches details of a specific failed event by group and insertion ID.
 *
 * API: `GET /events/deadLetter/groups/:group/:insertionId`
 */
export const getEventDetails = async (
  group: string,
  insertionId: string
): Promise<EventDetails> => {
  const response = await apiClient.get<any, EventDetails>(
    `/events/deadLetter/groups/${encodeURIComponent(
      group
    )}/${encodeURIComponent(insertionId)}`
  );
  return response;
};

/**
 * Deletes a specific failed event by group and insertion ID.
 *
 * API: `DELETE /events/deadLetter/groups/:group/:insertionId`
 */
export const deleteEvent = async (
  group: string,
  insertionId: string
): Promise<void> => {
  await apiClient.delete(
    `/events/deadLetter/groups/${encodeURIComponent(
      group
    )}/${encodeURIComponent(insertionId)}`
  );
};

/**
 * Deletes all failed events for a given group.
 *
 * API: `DELETE /events/deadLetter/groups/:group`
 */
export const deleteAllEventsForGroup = async (group: string): Promise<void> => {
  await apiClient.delete(
    `/events/deadLetter/groups/${encodeURIComponent(group)}`
  );
};

/**
 * Redelivers all failed events.
 * Optionally, a limit can be provided to restrict the number of events processed.
 *
 * API: `POST /events/deadLetter?action=reDeliver[&limit=n]`
 */
export const redeliverFailedEvents = async (
  limit?: number
): Promise<TaskResponse> => {
  const queryParam = limit
    ? `?action=reDeliver&limit=${limit}`
    : "?action=reDeliver";
  const response = await apiClient.post<any, TaskResponse>(
    `/events/deadLetter${queryParam}`
  );
  return response;
};

/**
 * Redelivers all failed events for a specific group.
 * Optionally, a limit can be provided to restrict the number of events processed.
 *
 * API: `POST /events/deadLetter/groups/:group?action=reDeliver[&limit=n]`
 */
export const redeliverGroupEvents = async (
  group: string,
  options?: {
    limit?: number;
    maxRetries?: number;
    redeliver_group_events?: boolean;
  }
): Promise<TaskResponse> => {
  const queryParams = new URLSearchParams({
    action: "reDeliver",
  });

  if (options?.limit !== undefined)
    queryParams.append("limit", String(options.limit));
  if (options?.maxRetries !== undefined)
    queryParams.append("maxRetries", String(options.maxRetries));
  if (options?.redeliver_group_events !== undefined)
    queryParams.append(
      "redeliver_group_events",
      String(options.redeliver_group_events)
    );

  const response = await apiClient.post<any, TaskResponse>(
    `/events/deadLetter/groups/${encodeURIComponent(
      group
    )}?${queryParams.toString()}`
  );

  return response;
};
