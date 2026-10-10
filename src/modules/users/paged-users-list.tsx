import { Link } from "react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PaginationControls } from "@/components/custom/pagination-controls";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { PAGE_LIMIT } from "@/lib/search-pagination";
import { UsernamesSource } from "./users-paging";
import { useUsersPages } from "./use-users-pages";

const SEARCH_DEBOUNCE_MS = 300;

interface PagedUsersListProps {
  source: UsernamesSource;
  /** Restricts the list to this domain. */
  domain?: string;
  /** Domains offered in a selector, when the list is not restricted to one domain. */
  domainChoices?: string[];
}

export function PagedUsersList({ source, domain, domainChoices = [] }: PagedUsersListProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("");
  const query = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const pages = useUsersPages(source, { query, domain: domain ?? selectedDomain }, PAGE_LIMIT);
  const prefix = query.trim();
  const isEmpty = !pages.isLoading && !pages.error && pages.usernames.length === 0;

  return (
    <div>
      {pages.isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
          <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
          <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
        </div>
      )}
      {pages.error && <p className="text-red-500 mt-4">{t("common.errorPrefix", { message: pages.error })}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("users.searchPlaceholder")}
          title={t("users.searchHint")}
          className="flex-1 min-w-48 px-4 py-2 border rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
        />
        {!domain && domainChoices.length > 0 && (
          <select
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            aria-label={t("common.domain")}
            className="max-w-full px-3 py-2 border rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{t("users.allDomains")}</option>
            {domainChoices.map((choice) => (
              <option key={choice} value={choice}>{choice}</option>
            ))}
          </select>
        )}
      </div>

      {(pages.hasPrevious || pages.hasNext) && (
        <PaginationControls
          onFirst={pages.first}
          onPrev={pages.previous}
          onNext={pages.next}
          disabledPrev={!pages.hasPrevious || pages.isLoading}
          disabledNext={!pages.hasNext || pages.isLoading}
          label={t("common.pageSimple", { page: pages.pageNumber })}
        />
      )}
      {isEmpty && (
        <p className="text-gray-500 mt-4">{prefix ? t("users.noMatch", { query: prefix }) : t("users.empty")}</p>
      )}
      <div>
        {pages.usernames.map((username, index) => (
          <div key={username} className="space-y-1 p-4 bg-white rounded-2 my-4 flex justify-between items-center">
            <h4 className="min-w-0 text-sm font-medium leading-none break-all">
              <span className="text-gray-500 mr-2">{pages.offset + index + 1}/</span>
              <Link to={`/users/user/${encodeURIComponent(username)}`} className="text-blue-600 hover:underline">
                {username}
              </Link>
            </h4>
          </div>
        ))}
      </div>
    </div>
  );
}
