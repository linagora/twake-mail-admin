import { useCallback } from "react";
import { useSearchParams } from "react-router";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getRepositoryInfo } from "../api-client";

// The `size` of the URL, set by the repository list, is only a hint: the Health Check card, a breadcrumb
// or a bookmark open the page without it
const sizeHintOf = (searchParams: URLSearchParams): number | undefined => {
  const hint = Number(searchParams.get("size"));
  return searchParams.has("size") && Number.isInteger(hint) && hint >= 0 ? hint : undefined;
};

/**
 * Size of a mail repository, read from WebAdmin (`GET /mailRepositories/{encodedPath}`), whatever the way in.
 * Until it answers, or when it fails, the hint of the URL is used; undefined when neither is known.
 */
export const useRepositorySize = (repository: string): number | undefined => {
  const [searchParams] = useSearchParams();
  const fetchInfo = useCallback(() => getRepositoryInfo(encodeURIComponent(repository)), [repository]);
  const { data } = useFetchData(fetchInfo);
  return data?.size ?? sizeHintOf(searchParams);
};
