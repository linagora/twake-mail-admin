import { getUsers } from "./api-client";
import { User } from "./types";

export interface UserPageRequest {
  limit: number;
  anchor?: string;
  query?: string;
}

export interface UserPage {
  users: User[];
  hasNext: boolean;
}

// Code unit ordering, as James sorts usernames with String.compareTo.
const byUsername = (a: User, b: User) =>
  a.username < b.username ? -1 : a.username > b.username ? 1 : 0;

/**
 * Builds a page out of a `GET /users` response. A recent James already sorted,
 * searched and anchored the list, so this is a no-op beyond the slice; an older
 * James ignores those parameters and returns every user, which this then
 * paginates client side.
 */
export function toUserPage(users: User[], { limit, anchor, query }: UserPageRequest): UserPage {
  const needle = query?.toLowerCase();
  const matching = users
    .filter((user) => !needle || user.username.toLowerCase().includes(needle))
    .filter((user) => !anchor || user.username > anchor)
    .sort(byUsername);
  return { users: matching.slice(0, limit), hasNext: matching.length > limit };
}

/**
 * Asks one user more than the page size so that a full last page is not
 * followed by an empty one.
 */
export const getUserPage = async (request: UserPageRequest): Promise<UserPage> => {
  const users = await getUsers({ ...request, limit: request.limit + 1 });
  return toUserPage(users, request);
};
