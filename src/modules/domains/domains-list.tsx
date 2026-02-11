import { useMemo, useState } from "react";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getDomains } from "./api-client";
import { GetDomainsResponseType } from "./types";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

export default function DomainsList() {
  const {
    data: domainsResult,
    isLoading,
    error,
  } = useFetchData<GetDomainsResponseType>(getDomains);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!domainsResult) return [];
    const sorted = [...domainsResult].sort((a, b) => a.localeCompare(b));
    if (!search) return sorted;
    const lower = search.toLowerCase();
    return sorted.filter((d) => d.toLowerCase().includes(lower));
  }, [domainsResult, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_LIMIT));
  const paginated = filtered.slice((page - 1) * PAGE_LIMIT, page * PAGE_LIMIT);

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
        placeholder="Search domains..."
        className="mt-4 w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <p>List</p>
      {filtered.length > 0 && (
        <div className="mt-4 flex justify-between items-center">
          <button
            onClick={() => goToPage(1)}
            disabled={page <= 1}
            className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            First
          </button>
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm font-medium text-center">
            Page {page} / {totalPages} — Total: {filtered.length}
          </span>
          <button
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
          <button
            onClick={() => goToPage(totalPages)}
            disabled={page >= totalPages}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Last
          </button>
        </div>
      )}
      <div>
        {paginated.map((domain, index) => (
          <div
            key={domain}
            className="space-y-1 p-4 bg-white rounded-2 my-4 p-4 flex justify-between items-center"
          >
            <div>
              <h4 className="text-sm font-medium leading-none">
                <span className="text-gray-500 mr-2">{(page - 1) * PAGE_LIMIT + index + 1}/</span>
                <a
                  href={`/domains/domain/${encodeURIComponent(domain)}`}
                  className="text-blue-600 hover:underline"
                >
                  {domain}
                </a>
              </h4>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
