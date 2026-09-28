import { useMemo, useState } from "react";
import { PAGE_LIMIT, searchAndPaginate } from "@/lib/search-pagination";

/**
 * Client-side search and pagination for lists the API returns in full.
 * Changing the search goes back to the first page. Pass a stable `searchable`
 * (module-level function) so the result is not recomputed on every render.
 */
export function useSearchPagination<T>(
  items: T[],
  searchable: (item: T) => (string | undefined | null)[],
  pageSize: number = PAGE_LIMIT,
) {
  const [search, setSearchState] = useState("");
  const [requestedPage, setRequestedPage] = useState(1);

  const result = useMemo(
    () => searchAndPaginate(items, search, requestedPage, searchable, pageSize),
    [items, search, requestedPage, searchable, pageSize],
  );

  const setSearch = (value: string) => {
    setSearchState(value);
    setRequestedPage(1);
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > result.totalPages) return;
    setRequestedPage(page);
  };

  return { ...result, search, setSearch, goToPage };
}
