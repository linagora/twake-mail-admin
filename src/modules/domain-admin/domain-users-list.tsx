import { Link } from "react-router";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getDomainUsers } from "@/modules/domains/api-client";
import { useCallback, useMemo, useState } from "react";
import { useDomain } from "./domain-context";
import { PaginationControls } from "@/components/custom/pagination-controls";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

export default function DomainUsersList() {
  const domain = useDomain();

  const fetchUsers = useCallback(() => getDomainUsers(domain), [domain]);
  const { data: usersResult, isLoading, error } = useFetchData<string[]>(fetchUsers);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const filteredUsers = useMemo(() => {
    if (!usersResult) return [];
    const sorted = [...usersResult].sort((a, b) => a.localeCompare(b));
    if (!search) return sorted;
    const lower = search.toLowerCase();
    return sorted.filter((u) => u.toLowerCase().includes(lower));
  }, [usersResult, search]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_LIMIT));
  const paginatedUsers = filteredUsers.slice((page - 1) * PAGE_LIMIT, page * PAGE_LIMIT);

  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  return (
    <div>
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
          <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
          <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
        </div>
      )}
      {error && <p className="text-red-500 mt-4">Error: {error}</p>}
      <input
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        placeholder="Search users..."
        className="mt-4 w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {filteredUsers.length > 0 && (
        <PaginationControls
          onFirst={() => goToPage(1)}
          onPrev={() => goToPage(page - 1)}
          onNext={() => goToPage(page + 1)}
          onLast={() => goToPage(totalPages)}
          disabledPrev={page <= 1}
          disabledNext={page >= totalPages}
          label={`Page ${page} / ${totalPages} — Total: ${filteredUsers.length}`}
        />
      )}
      <div>
        {paginatedUsers.map((username, index) => (
          <div
            key={username}
            className="space-y-1 p-4 bg-white rounded-2 my-4 flex justify-between items-center"
          >
            <h4 className="text-sm font-medium leading-none">
              <span className="text-gray-500 mr-2">{(page - 1) * PAGE_LIMIT + index + 1}/</span>
              <Link
                to={`/users/user/${encodeURIComponent(username)}`}
                className="text-blue-600 hover:underline"
              >
                {username}
              </Link>
            </h4>
          </div>
        ))}
      </div>
    </div>
  );
}
