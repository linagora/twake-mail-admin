import { useFetchData } from "@/hooks/use-fetch-data";
import { getUsers } from "./api-client";
import { GetUsersResponseType } from "./types";
import { useMemo, useState } from "react";
import { PaginationControls } from "@/components/custom/pagination-controls";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

export default function UsersList() {
  const {
    data: usersResult,
    isLoading,
    error,
  } = useFetchData<GetUsersResponseType>(getUsers);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const filteredUsers = useMemo(() => {
    if (!usersResult) return [];
    const sorted = [...usersResult].sort((a, b) =>
      a.username.localeCompare(b.username)
    );
    if (!search) return sorted;
    const lower = search.toLowerCase();
    return sorted.filter((u) => u.username.toLowerCase().includes(lower));
  }, [usersResult, search]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_LIMIT));
  const paginatedUsers = filteredUsers.slice(
    (page - 1) * PAGE_LIMIT,
    page * PAGE_LIMIT
  );

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
      <p>List</p>
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
        {paginatedUsers.map((user, index) => (
          <div
            key={user.username}
            className="space-y-1 p-4 bg-white rounded-2 my-4 p-4 flex justify-between items-center"
          >
            <div>
              <h4 className="text-sm font-medium leading-none">
                <span className="text-gray-500 mr-2">{(page - 1) * PAGE_LIMIT + index + 1}/</span>
                <a
                  href={`/users/user/${encodeURIComponent(user.username)}`}
                  className="text-blue-600 hover:underline"
                >
                  {user.username}
                </a>
              </h4>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
