import { apiClient, getRaw } from "@/lib/apiClient";
import {
  ListenerGroupsResponseType,
  InsertionIdsResponseType,
  EventDetails,
  TaskResponse,
} from "./types";

export interface DeadLetterEventSearchResult {
  group: string;
  insertionId: string;
  json: Record<string, any>;
}

/**
 * Locates a dead-lettered event by its eventId.
 *
 * API: `GET /events/deadLetter?eventId={eventId}[&group={group}]`
 *
 * The optional `group` narrows the search to a single listener group, which is
 * significantly cheaper when the group holding the event is known.
 *
 * The response body is the event JSON; the response headers `X-Group` and
 * `X-Insertion-Id` identify the group / insertion the event lives in. Those
 * headers are hidden from cross-origin JavaScript unless WebAdmin lists them in
 * `Access-Control-Expose-Headers`: when they are not readable, the event is
 * looked up in the insertion lists of the candidate groups instead.
 */
export const searchDeadLetterEventByEventId = async (
  eventId: string,
  group?: string
): Promise<DeadLetterEventSearchResult> => {
  const params = new URLSearchParams({ eventId });
  const trimmedGroup = group?.trim();
  if (trimmedGroup) params.append("group", trimmedGroup);
  const response = await getRaw<any>(
    `/events/deadLetter?${params.toString()}`
  );
  const headerGroup = (response.headers["x-group"] as string) ?? "";
  const headerInsertionId =
    (response.headers["x-insertion-id"] as string) ?? "";
  const location =
    headerGroup && headerInsertionId
      ? { group: headerGroup, insertionId: headerInsertionId }
      : await locateDeadLetterEvent(eventId, headerGroup || trimmedGroup);
  return {
    group: location?.group ?? "",
    insertionId: location?.insertionId ?? "",
    json: response.data ?? {},
  };
};

interface DeadLetterEventLocation {
  group: string;
  insertionId: string;
}

/**
 * Events are serialized either flat (`{eventId, ...}`) or wrapped in their
 * type (`{"Added": {eventId, ...}}`).
 */
const eventIdOf = (event: unknown): string | undefined => {
  if (!event || typeof event !== "object") return undefined;
  const record = event as Record<string, unknown>;
  if (typeof record.eventId === "string") return record.eventId;
  return Object.values(record)
    .map((value) =>
      value && typeof value === "object"
        ? (value as Record<string, unknown>).eventId
        : undefined
    )
    .find((value): value is string => typeof value === "string");
};

const findSequentially = async <T, R>(
  items: T[],
  lookup: (item: T) => Promise<R | undefined>
): Promise<R | undefined> =>
  items.reduce<Promise<R | undefined>>(
    async (previous, item) => (await previous) ?? lookup(item),
    Promise.resolve(undefined)
  );

const locateInGroup = async (
  eventId: string,
  group: string
): Promise<DeadLetterEventLocation | undefined> => {
  const insertionIds = await getFailedEvents(group);
  return findSequentially(insertionIds, async (insertionId) =>
    eventIdOf(await getEventDetails(group, insertionId)) === eventId
      ? { group, insertionId }
      : undefined
  );
};

/**
 * Finds the group and insertion ID of a dead-lettered event by browsing the
 * insertion lists, restricted to `group` when it is known. Resolves to
 * `undefined` rather than failing, as the event itself was already found.
 */
const locateDeadLetterEvent = async (
  eventId: string,
  group?: string
): Promise<DeadLetterEventLocation | undefined> => {
  try {
    const groups = group ? [group] : await getMailboxListenerGroups();
    return await findSequentially(groups, (candidate) =>
      locateInGroup(eventId, candidate)
    );
  } catch {
    return undefined;
  }
};

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
