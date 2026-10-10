import { useEffect, useState } from "react";
import { APIError } from "@/lib/apiClient";
import { fetchUsersPage, UsersFilter, UsersPage, UsernamesSource } from "./users-paging";

const EMPTY_PAGE: UsersPage = { usernames: [], hasNext: false };

type Anchors = (string | undefined)[];

const FIRST_PAGE: Anchors = [undefined];

interface Paging extends UsersFilter {
  source: UsernamesSource;
  anchors: Anchors;
}

const errorMessage = (error: unknown): string => {
  const e = error as APIError;
  return e.response?.data?.message ?? e.message ?? "Unknown error";
};

/**
 * Keyset pagination over `GET /users`: each page is requested with the last username of
 * the previous one as anchor. Anchors are stacked to go back. Changing the source or
 * the filter restarts from the first page.
 */
export function useUsersPages(source: UsernamesSource, filter: UsersFilter, pageSize: number) {
  const { query, domain } = filter;
  const [paging, setPaging] = useState<Paging>({ source, query, domain, anchors: FIRST_PAGE });
  const [page, setPage] = useState<UsersPage>(EMPTY_PAGE);
  // Loading from the start: the first page is fetched right after mounting.
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isCurrent = paging.source === source && paging.query === query && paging.domain === domain;
  const anchors = isCurrent ? paging.anchors : FIRST_PAGE;
  const anchor = anchors[anchors.length - 1];
  const setAnchors = (anchorsOf: (current: Anchors) => Anchors) =>
    setPaging({ source, query, domain, anchors: anchorsOf(anchors) });

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetchUsersPage(source, { query, domain }, pageSize, anchor)
      .then((result) => !cancelled && setPage(result))
      .catch((e: unknown) => {
        if (cancelled) return;
        setPage(EMPTY_PAGE);
        setError(errorMessage(e));
      })
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [source, query, domain, pageSize, anchor]);

  const lastUsername = page.usernames[page.usernames.length - 1];

  return {
    ...page,
    isLoading,
    error,
    pageNumber: anchors.length,
    offset: (anchors.length - 1) * pageSize,
    hasPrevious: anchors.length > 1,
    first: () => setAnchors(() => FIRST_PAGE),
    previous: () => setAnchors((stack) => (stack.length > 1 ? stack.slice(0, -1) : stack)),
    next: () => {
      if (page.hasNext) setAnchors((stack) => [...stack, lastUsername]);
    },
  };
}
