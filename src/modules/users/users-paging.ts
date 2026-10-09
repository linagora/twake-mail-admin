export interface UsersFilter {
  query: string;
  domain: string;
}

export interface UsersPageRequest extends UsersFilter {
  limit: number;
  anchor?: string;
}

export interface UsersPage {
  usernames: string[];
  hasNext: boolean;
}

/** Lists usernames for a request. Backends may ignore some (or all) of its parameters. */
export type UsernamesSource = (request: UsersPageRequest) => Promise<string[]>;

const domainOf = (username: string): string => username.slice(username.lastIndexOf("@") + 1);

const matchesFilter = ({ query, domain }: UsersFilter) => (username: string): boolean =>
  username.toLowerCase().startsWith(query.trim().toLowerCase())
  && (!domain || (username.includes("@") && domainOf(username).toLowerCase() === domain.toLowerCase()));

const isAfter = (anchor?: string) => (username: string): boolean => anchor === undefined || username > anchor;

/**
 * Applies the semantic of `GET /users?limit&anchor&query&domain` on a list of usernames:
 * prefix match on the username, exact domain, strictly after the anchor, sorted, capped.
 *
 * Idempotent on an already correct server answer, it makes the paging work against
 * backends ignoring these parameters (older James returning the full list,
 * `/domains/{domain}/users`).
 */
export function applyUsersRequest(usernames: string[], request: UsersPageRequest): string[] {
  return usernames
    .filter(matchesFilter(request))
    .filter(isAfter(request.anchor))
    .sort()
    .slice(0, request.limit);
}

/**
 * Fetches one page of `pageSize` users. One extra user is requested to know whether a
 * next page exists without an empty trailing page.
 */
export async function fetchUsersPage(
  source: UsernamesSource,
  filter: UsersFilter,
  pageSize: number,
  anchor?: string,
): Promise<UsersPage> {
  const request: UsersPageRequest = { ...filter, query: filter.query.trim(), limit: pageSize + 1, anchor };
  const usernames = applyUsersRequest(await source(request), request);
  return { usernames: usernames.slice(0, pageSize), hasNext: usernames.length > pageSize };
}
