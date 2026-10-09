import { Link } from "react-router";
import { useFetchData } from "@/hooks/use-fetch-data";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { getUserPage, UserPage } from "./user-pages";
import { useCallback, useState } from "react";
import { PaginationControls } from "@/components/custom/pagination-controls";
import { useTranslation } from "react-i18next";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;
const SEARCH_DEBOUNCE_MS = 300;
const FIRST_PAGE: (string | undefined)[] = [undefined];

interface Navigation {
  query: string;
  // Anchor of every page visited so far, the current page being the last one.
  anchors: (string | undefined)[];
}

export default function UsersList() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const query = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const [navigation, setNavigation] = useState<Navigation>({ query, anchors: FIRST_PAGE });

  // A new query starts over from the first page.
  const anchors = navigation.query === query ? navigation.anchors : FIRST_PAGE;
  const anchor = anchors[anchors.length - 1];
  const page = anchors.length;

  const fetchPage = useCallback(
    () => getUserPage({ limit: PAGE_LIMIT, anchor, query }),
    [anchor, query]
  );
  const { data: userPage, isLoading, error } = useFetchData<UserPage>(fetchPage);
  const users = userPage?.users ?? [];

  const navigate = (nextAnchors: (string | undefined)[]) =>
    setNavigation({ query, anchors: nextAnchors });
  const goToFirst = () => navigate(FIRST_PAGE);
  const goToPrevious = () => navigate(anchors.slice(0, -1));
  const goToNext = () => navigate([...anchors, users[users.length - 1].username]);

  return (
    <div>
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
          <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
          <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
        </div>
      )}
      {error && <p className="text-red-500 mt-4">{t("common.errorPrefix", { message: error })}</p>}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("users.searchPlaceholder")}
        className="mt-4 w-full px-4 py-2 border rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
      />

      {(users.length > 0 || page > 1) && (
        <PaginationControls
          onFirst={goToFirst}
          onPrev={goToPrevious}
          onNext={goToNext}
          disabledPrev={isLoading || page <= 1}
          disabledNext={isLoading || !userPage?.hasNext}
          label={t("users.pageNumber", { page })}
        />
      )}
      <div>
        {users.map((user, index) => (
          <div
            key={user.username}
            className="space-y-1 p-4 bg-white rounded-2 my-4 p-4 flex justify-between items-center"
          >
            <div>
              <h4 className="text-sm font-medium leading-none">
                <span className="text-gray-500 mr-2">{(page - 1) * PAGE_LIMIT + index + 1}/</span>
                <Link
                  to={`/users/user/${encodeURIComponent(user.username)}`}
                  className="text-blue-600 hover:underline"
                >
                  {user.username}
                </Link>
              </h4>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
