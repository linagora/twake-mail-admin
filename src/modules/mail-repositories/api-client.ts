import { apiClient } from "@/lib/apiClient";
import {
  GetMailRepositoriesResponseType,
  MailKeysResponseType,
  RepositoryInfo,
  MailDetail,
} from "./types";

/**
 * Fetches the list of mail repositories from the James server at `/mailRepositories`.
 *
 * API: `GET http://ip:port/mailRepositories`
 * Documentation: https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_administrating_mail_repositories
 *
 * - Returns a list of mail repositories, each with a `repository` name and its `path`.
 * - HTTP 200: Successfully retrieved the list of mail repositories.
 */
export const getMailRepositories =
  async (): Promise<GetMailRepositoriesResponseType> => {
    const response = await apiClient.get<any, GetMailRepositoriesResponseType>(
      "/mailRepositories"
    );
    return response; // Correctly accessing the `data` property
  };

/**
 * Fetches the list of mail keys contained in a specified mail repository.
 *
 * API: `GET http://ip:port/mailRepositories/{encodedPathOfTheRepository}/mails`
 * Documentation: https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_administrating_mail_repositories
 *
 * - Returns an array of mail keys for a given repository.
 * - Supports optional `limit` and `offset` query parameters.
 * - HTTP 200: Successfully retrieved the list of mail keys.
 * - HTTP 400: Invalid parameters.
 * - HTTP 404: Repository not found.
 *
 * @param encodedPathOfTheRepository - The URL-encoded path of the mail repository.
 * @param options - Optional parameters for pagination (`limit`, `offset`).
 * @returns A promise resolving to an array of mail keys.
 */
export const getMailsInRepository = async (
  encodedPathOfTheRepository: string,
  options?: {
    limit?: number;
    offset?: number;
    sender?: string;
    recipient?: string;
    updatedBefore?: string;
    updatedAfter?: string;
    remoteAddress?: string;
    remoteHost?: string;
  }
): Promise<MailKeysResponseType> => {
  const params = new URLSearchParams();

  if (options?.limit !== undefined) params.append("limit", options.limit.toString());
  if (options?.offset !== undefined) params.append("offset", options.offset.toString());
  if (options?.sender) params.append("sender", options.sender);
  if (options?.recipient) params.append("recipient", options.recipient);
  if (options?.updatedBefore) params.append("updatedBefore", options.updatedBefore);
  if (options?.updatedAfter) params.append("updatedAfter", options.updatedAfter);
  if (options?.remoteAddress) params.append("remoteAddress", options.remoteAddress);
  if (options?.remoteHost) params.append("remoteHost", options.remoteHost);

  const response = await apiClient.get<any, MailKeysResponseType>(
    `/mailRepositories/${encodedPathOfTheRepository}/mails?${params.toString()}`
  );

  return response;
};

/**
 * Fetches additional information for a specified mail repository.
 *
 * API: `GET http://ip:port/mailRepositories/{encodedPathOfTheRepository}`
 *
 * - Returns detailed information about the specified mail repository.
 * - HTTP 200: Successfully retrieved additional information for the repository.
 * - HTTP 404: Repository not found.
 *
 * @param encodedPathOfTheRepository - The URL-encoded path of the mail repository.
 * @returns A promise resolving to an object with repository details.
 */
export const getRepositoryInfo = async (
  encodedPathOfTheRepository: string
): Promise<RepositoryInfo> => {
  const response = await apiClient.get<any, RepositoryInfo>(
    `/mailRepositories/${encodedPathOfTheRepository}`
  );
  return response;
};

/**
 * Removes all mails from a specified mail repository.
 *
 * API: `DELETE http://ip:port/mailRepositories/{encodedPathOfTheRepository}/mails`
 *
 * - Schedules a task to clear all mails from the repository.
 * - HTTP 201: Task generation succeeded, returns corresponding task ID.
 * - HTTP 404: Repository not found.
 *
 * @param encodedPathOfTheRepository - The URL-encoded path of the mail repository.
 * @returns A promise resolving to the task details.
 */
export const clearMailRepository = async (
  encodedPathOfTheRepository: string
): Promise<{ taskId: string }> => {
  const response = await apiClient.delete<any, { taskId: string }>(
    `/mailRepositories/${encodedPathOfTheRepository}/mails`
  );
  return response;
};

/**
 * Reprocesses mails from a specified mail repository.
 *
 * API: `PATCH http://ip:port/mailRepositories/{encodedPathOfTheRepository}/mails?action=reprocess`
 *
 * - Reprocesses mails, optionally targeting a specific queue, processor, and other parameters.
 * - HTTP 201: Task generation succeeded, returns corresponding task ID.
 * - HTTP 404: Repository not found.
 *
 * @param encodedPathOfTheRepository - The URL-encoded path of the mail repository.
 * @param options - Optional parameters for reprocessing.
 * @returns A promise resolving to the task details.
 */
export const reprocessMailRepository = async (
  encodedPathOfTheRepository: string,
  options?: {
    queue?: string;
    processor?: string;
    consume?: boolean;
    limit?: number;
    maxRetries?: number;
    redeliver_group_events?: boolean;
  }
): Promise<{ taskId: string }> => {
  const queryParams = new URLSearchParams({
    action: "reprocess",
    processor: "root",
  });

  if (options?.queue) queryParams.append("queue", options.queue);
  if (options?.processor) queryParams.append("processor", options.processor);
  if (options?.consume !== undefined)
    queryParams.append("consume", String(options.consume));
  if (options?.limit !== undefined)
    queryParams.append("limit", String(options.limit));
  if (options?.maxRetries !== undefined)
    queryParams.append("maxRetries", String(options.maxRetries));
  if (options?.redeliver_group_events !== undefined)
    queryParams.append(
      "redeliver_group_events",
      String(options.redeliver_group_events)
    );

  const response = await apiClient.patch<any, { taskId: string }>(
    `/mailRepositories/${encodedPathOfTheRepository}/mails?${queryParams.toString()}`
  );

  return response;
};

/**
 * Removes a mail from a specified mail repository.
 *
 * API: `DELETE http://ip:port/mailRepositories/{encodedPathOfTheRepository}/mails/mailKey`
 *
 * - Schedules a task to clear a mail from the repository.
 * - HTTP 201: Task generation succeeded, returns corresponding task ID.
 * - HTTP 404: Repository not found.
 *
 * @param encodedPathOfTheRepository - The URL-encoded path of the mail repository.
 * @returns A promise resolving to the task details.
 */
export const getMailDetail = async (
  encodedPathOfTheRepository: string,
  mailKey: string
): Promise<MailDetail> => {
  return apiClient.get(
    `/mailRepositories/${encodedPathOfTheRepository}/mails/${mailKey}`,
    { headers: { Accept: "application/json" } }
  );
};

export const reprocessSingleMail = async (
  encodedPathOfTheRepository: string,
  mailKey: string,
  options?: { queue?: string; processor?: string }
): Promise<{ taskId: string }> => {
  const params = new URLSearchParams({ action: "reprocess" });
  if (options?.queue) params.set("queue", options.queue);
  if (options?.processor) params.set("processor", options.processor);
  return apiClient.patch(
    `/mailRepositories/${encodedPathOfTheRepository}/mails/${mailKey}?${params.toString()}`
  );
};

/**
 * Moves all mails from a repository to another.
 *
 * API: `PATCH http://ip:port/mailRepositories/{encodedPathOfTheRepository}/mails`
 * Body: `{"mailRepository": "/var/mail/target"}`
 *
 * - HTTP 204: Mails moved.
 * - HTTP 400: Target repository does not exist.
 */
export const moveAllMails = async (
  encodedPathOfTheRepository: string,
  targetRepository: string
): Promise<void> => {
  await apiClient.patch(
    `/mailRepositories/${encodedPathOfTheRepository}/mails`,
    { mailRepository: targetRepository }
  );
};

/**
 * Moves a single mail from a repository to another.
 *
 * API: `PATCH http://ip:port/mailRepositories/{encodedPathOfTheRepository}/mails/{mailKey}`
 * Body: `{"mailRepository": "/var/mail/target"}`
 *
 * - HTTP 204: Mail moved.
 * - HTTP 400: Target repository does not exist.
 */
export const moveSingleMail = async (
  encodedPathOfTheRepository: string,
  mailKey: string,
  targetRepository: string
): Promise<void> => {
  await apiClient.patch(
    `/mailRepositories/${encodedPathOfTheRepository}/mails/${mailKey}`,
    { mailRepository: targetRepository }
  );
};

/**
 * Creates a mail repository.
 *
 * API: `PUT http://ip:port/mailRepositories/{encodedPathOfTheRepository}?protocol={someProtocol}`
 *
 * - HTTP 204: The repository is created.
 *
 * @param encodedPathOfTheRepository - The URL-encoded path of the mail repository.
 * @param protocol - Optional protocol for the repository.
 */
export const createMailRepository = async (
  encodedPathOfTheRepository: string,
  protocol?: string
): Promise<void> => {
  const params = protocol ? `?protocol=${encodeURIComponent(protocol)}` : "";
  await apiClient.put(
    `/mailRepositories/${encodedPathOfTheRepository}${params}`
  );
};

export const removeSingleMailFromRepository = async (
  encodedPathOfTheRepository: string,
  mailKey: string,
): Promise<{ taskId: string }> => {
  const response = await apiClient.delete<any, { taskId: string }>(
    `/mailRepositories/${encodedPathOfTheRepository}/mails/${mailKey}`
  );
  return response;
};
