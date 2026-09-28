export const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

export interface SearchPage<T> {
  filtered: T[];
  paginated: T[];
  page: number;
  totalPages: number;
  offset: number;
}

/**
 * Case-insensitive substring search over the texts returned by `searchable`,
 * followed by a slice of `pageSize` items. The requested page is clamped to the
 * available range so that a shrinking list (search, deletion) never lands on an
 * empty page.
 */
export function searchAndPaginate<T>(
  items: T[],
  search: string,
  requestedPage: number,
  searchable: (item: T) => (string | undefined | null)[],
  pageSize: number = PAGE_LIMIT,
): SearchPage<T> {
  const needle = search.trim().toLowerCase();
  const filtered = needle
    ? items.filter((item) => searchable(item).some((text) => text?.toLowerCase().includes(needle)))
    : items;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const offset = (page - 1) * pageSize;
  return { filtered, paginated: filtered.slice(offset, offset + pageSize), page, totalPages, offset };
}
