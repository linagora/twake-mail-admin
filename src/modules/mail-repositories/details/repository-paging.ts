import type { TFunction } from "i18next";
import { MailFilters } from "./mail-filters-panel";

export interface RepositoryPaging {
  hasMore: boolean;
  // Mails counted by the label: the whole repository, or only the listed ones when a filter is active
  total: number;
  // Unknown with a filter active: WebAdmin gives no count of the matching mails
  totalPages?: number;
}

interface PagingInput {
  page: number;
  limit: number;
  // Size of the whole repository, passed by the repository list
  repositorySize: number;
  // Number of mail keys the current page returned
  listed: number;
  filtered: boolean;
}

export const hasActiveFilter = (filters: MailFilters): boolean => Object.values(filters).some(Boolean);

const filteredPaging = ({ limit, listed }: PagingInput): RepositoryPaging => ({
  // A full page may be followed by more matching mails
  hasMore: listed === limit,
  total: listed,
});

const unfilteredPaging = ({ page, limit, repositorySize }: PagingInput): RepositoryPaging => ({
  hasMore: page * limit < repositorySize,
  total: repositorySize,
  totalPages: Math.max(1, Math.ceil(repositorySize / limit)),
});

export const repositoryPaging = (input: PagingInput): RepositoryPaging =>
  input.filtered ? filteredPaging(input) : unfilteredPaging(input);

export const pagingLabel = (t: TFunction, page: number, paging: RepositoryPaging): string =>
  paging.totalPages === undefined
    ? `${t("common.pageOf", { page, count: paging.total })}${paging.hasMore ? "+" : ""}`
    : t("common.page", { page, totalPages: paging.totalPages, total: paging.total });

// Without a known number of pages, there is no last page to go to
export const lastPageAction = (paging: RepositoryPaging, goToPage: (page: number) => void): (() => void) | undefined => {
  const { totalPages } = paging;
  return totalPages === undefined ? undefined : () => goToPage(totalPages);
};
