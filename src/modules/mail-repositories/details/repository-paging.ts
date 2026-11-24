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
  // Size of the whole repository read from WebAdmin, undefined while unknown (not loaded yet, or not readable)
  repositorySize?: number;
  // Number of mail keys the current page returned
  listed: number;
  filtered: boolean;
}

export const hasActiveFilter = (filters: MailFilters): boolean => Object.values(filters).some(Boolean);

// Without a known count, only the listed mails are counted
const listedPaging = ({ limit, listed }: PagingInput): RepositoryPaging => ({
  // A full page may be followed by more mails
  hasMore: listed === limit,
  total: listed,
});

const sizedPaging = ({ page, limit }: PagingInput, repositorySize: number): RepositoryPaging => ({
  hasMore: page * limit < repositorySize,
  total: repositorySize,
  totalPages: Math.max(1, Math.ceil(repositorySize / limit)),
});

export const repositoryPaging = (input: PagingInput): RepositoryPaging =>
  input.filtered || input.repositorySize === undefined ? listedPaging(input) : sizedPaging(input, input.repositorySize);

// The known size is kept in the URL, as a hint for a reload until WebAdmin answers
export const sizeParam = (repositorySize: number | undefined): Record<string, string> =>
  repositorySize === undefined ? {} : { size: repositorySize.toString() };

export const pagingLabel = (t: TFunction, page: number, paging: RepositoryPaging): string =>
  paging.totalPages === undefined
    ? `${t("common.pageOf", { page, count: paging.total })}${paging.hasMore ? "+" : ""}`
    : t("common.page", { page, totalPages: paging.totalPages, total: paging.total });

// Without a known number of pages, there is no last page to go to
export const lastPageAction = (paging: RepositoryPaging, goToPage: (page: number) => void): (() => void) | undefined => {
  const { totalPages } = paging;
  return totalPages === undefined ? undefined : () => goToPage(totalPages);
};
