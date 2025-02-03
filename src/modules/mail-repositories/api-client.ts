import { apiClient } from "@/lib/apiClient";
import { GetMailRepositoriesResponseType, MailKeysResponseType } from "./types";

/**
 * Fetches the list of mail repositories from the James server at `/mailRepositories`.
 *
 * API: `GET http://ip:port/mailRepositories`
 * Documentation: https://james.staged.apache.org/james-project/3.9.0/servers/distributed/operate/webadmin.html#_administrating_mail_repositories
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
 * Documentation: https://james.staged.apache.org/james-project/3.9.0/servers/distributed/operate/webadmin.html#_administrating_mail_repositories
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
  options?: { limit?: number; offset?: number }
): Promise<MailKeysResponseType> => {
  const params = new URLSearchParams();

  if (options?.limit !== undefined) {
    params.append("limit", options.limit.toString());
  }
  if (options?.offset !== undefined) {
    params.append("offset", options.offset.toString());
  }

  const response = await apiClient.get<any, MailKeysResponseType>(
    `/mailRepositories/${encodedPathOfTheRepository}/mails?${params.toString()}`
  );

  return response;
};
