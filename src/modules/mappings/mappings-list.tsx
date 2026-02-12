import { useFetchData } from "@/hooks/use-fetch-data";
import { getMappings } from "./api-client";
import { GetMappingsResponseType, FlatMapping } from "./types";
import { useMemo, useState } from "react";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

export default function MappingsList() {
  const {
    data: mappingsResult,
    isLoading,
    error,
  } = useFetchData<GetMappingsResponseType>(getMappings);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const flatMappings = useMemo<FlatMapping[]>(() => {
    if (!mappingsResult) return [];
    const rows: FlatMapping[] = [];
    for (const [source, entries] of Object.entries(mappingsResult)) {
      for (const entry of entries) {
        rows.push({
          source,
          type: entry.type,
          destination: entry.mapping,
        });
      }
    }
    rows.sort((a, b) => a.source.localeCompare(b.source));
    return rows;
  }, [mappingsResult]);

  const filteredMappings = useMemo(() => {
    if (!search) return flatMappings;
    const lower = search.toLowerCase();
    return flatMappings.filter(
      (m) =>
        m.source.toLowerCase().includes(lower) ||
        m.type.toLowerCase().includes(lower) ||
        m.destination.toLowerCase().includes(lower)
    );
  }, [flatMappings, search]);

  const totalPages = Math.max(1, Math.ceil(filteredMappings.length / PAGE_LIMIT));
  const paginatedMappings = filteredMappings.slice(
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
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
        placeholder="Search by source, type or destination..."
        className="mt-4 w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {filteredMappings.length > 0 && (
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
            Page {page} / {totalPages} — Total: {filteredMappings.length}
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
      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left px-4 py-2 text-sm font-medium">#</th>
            <th className="text-left px-4 py-2 text-sm font-medium">Source</th>
            <th className="text-left px-4 py-2 text-sm font-medium">Type</th>
            <th className="text-left px-4 py-2 text-sm font-medium">Destination</th>
          </tr>
        </thead>
        <tbody>
          {paginatedMappings.map((mapping, index) => (
            <tr
              key={`${mapping.source}-${mapping.type}-${mapping.destination}-${index}`}
              className="border-b hover:bg-gray-50"
            >
              <td className="px-4 py-2 text-sm text-gray-500">
                {(page - 1) * PAGE_LIMIT + index + 1}
              </td>
              <td className="px-4 py-2 text-sm">{mapping.source}</td>
              <td className="px-4 py-2 text-sm">{mapping.type}</td>
              <td className="px-4 py-2 text-sm">{mapping.destination}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!isLoading && filteredMappings.length === 0 && (
        <p className="mt-4 text-gray-500 text-sm">No mappings found.</p>
      )}
    </div>
  );
}
