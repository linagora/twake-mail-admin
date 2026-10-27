import { NavigationType, useNavigationType, useSearchParams } from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { PaginationControls } from "@/components/custom/pagination-controls";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { PAGE_LIMIT } from "@/lib/search-pagination";
import { UsernamesSource } from "./users-paging";
import { useUsersPages } from "./use-users-pages";
import ListToolbar from "@/components/custom/list-toolbar";
import UserLink from "@/components/custom/user-link";
import { CompactList, CompactRow } from "@/components/custom/compact-list";

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
  // The search and the domain filter live in the URL, so that Back from a user page, a bookmark
  // or a link (/users?domain=example.org) restores them; the page anchor stays in memory
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearch = searchParams.get("q") ?? "";
  // The field holds its own text: the router applies a navigation asynchronously, so an input
  // bound to the URL would be rendered back with a stale value and lose a key typed in a burst.
  // The URL only mirrors the text, and is read back when it changes from outside (Back, a link)
  const [search, setSearchText] = useState(urlSearch);
  const navigationType = useNavigationType();
  useEffect(() => {
    if (navigationType !== NavigationType.Replace) setSearchText(urlSearch);
  }, [urlSearch, navigationType]);
  const selectedDomain = searchParams.get("domain") ?? "";
  // Two changes before a render (clearing the search, then picking a domain) must not undo one
  // another: each starts from the parameters the previous one wrote, not from the last render,
  // which the typed text renders before the URL changes
  const latestParams = useRef(searchParams);
  useEffect(() => {
    latestParams.current = searchParams;
  }, [searchParams]);
  const updateParam = (key: "q" | "domain", value: string, replace: boolean) => {
    const next = new URLSearchParams(latestParams.current);
    if (value) next.set(key, value); else next.delete(key);
    latestParams.current = next;
    setSearchParams(next, { replace });
  };
  // Typing replaces the history entry, a new domain pushes one
  const setSearch = (value: string) => {
    setSearchText(value);
    updateParam("q", value, true);
  };
  const setSelectedDomain = (value: string) => updateParam("domain", value, false);
  const query = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const pages = useUsersPages(source, { query, domain: domain ?? selectedDomain }, PAGE_LIMIT);
  const prefix = query.trim();
  const isEmpty = !pages.isLoading && !pages.error && pages.usernames.length === 0;
  const sortedDomainChoices = useMemo(() => [...domainChoices].sort((a, b) => a.localeCompare(b)), [domainChoices]);
  // A user whose domain was deleted stays on the server, but no mail reaches it any more
  const managedDomains = useMemo(() => new Set(domainChoices.map((d) => d.toLowerCase())), [domainChoices]);
  const isUnmanaged = (username: string) =>
    managedDomains.size > 0 && !managedDomains.has(username.slice(username.lastIndexOf("@") + 1).toLowerCase());

  return (
    <div>
      <ListToolbar search={search} onSearch={setSearch} placeholder={t("users.searchPlaceholder")} title={t("users.searchHint")}>
        {!domain && domainChoices.length > 0 && (
          <select
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            aria-label={t("common.domain")}
            className="h-10 max-w-full px-3 border rounded-md bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{t("users.allDomains")}</option>
            {sortedDomainChoices.map((choice) => (
              <option key={choice} value={choice}>{choice}</option>
            ))}
          </select>
        )}
      </ListToolbar>
      {pages.isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
          <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
          <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
        </div>
      )}
      {pages.error && <p className="text-red-500 mt-4">{t("common.errorPrefix", { message: pages.error })}</p>}

      {pages.usernames.length > 0 && (
        // WebAdmin pages the users without a total: the range of the page, or the count when it is the only one
        <PaginationControls
          onFirst={pages.first}
          onPrev={pages.previous}
          onNext={pages.next}
          disabledPrev={!pages.hasPrevious || pages.isLoading}
          disabledNext={!pages.hasNext || pages.isLoading}
          label={pages.hasPrevious || pages.hasNext
            ? t("users.countRange", { from: pages.offset + 1, to: pages.offset + pages.usernames.length })
            : t("users.countSingle", { count: pages.usernames.length })}
        />
      )}
      {isEmpty && (
        <p className="text-gray-500 mt-4">{prefix ? t("users.noMatch", { query: prefix }) : t("users.empty")}</p>
      )}
      <CompactList>
        {pages.usernames.map((username, index) => (
          <CompactRow key={username} number={pages.offset + index + 1}>
            <span className="min-w-0 break-all">
              <UserLink address={username} known />
              {isUnmanaged(username) && (
                <span
                  className="ml-2 inline-block text-xs font-normal rounded px-1.5 py-0.5 bg-gray-100 text-gray-600 whitespace-nowrap"
                  title={t("users.unmanagedDomainHint")}
                >
                  {t("users.unmanagedDomain")}
                </span>
              )}
            </span>
          </CompactRow>
        ))}
      </CompactList>
    </div>
  );
}
