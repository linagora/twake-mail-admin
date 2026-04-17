import { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import {
  getUserMappings,
  getUserMappingSources,
  deleteUserMappingSources,
  UserMappingEntry,
} from "../api-client";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";

interface Props {
  username: string;
}

const SOURCE_TYPES = ["address", "alias", "forward", "group"] as const;
type SourceType = (typeof SOURCE_TYPES)[number];

export default function UserMappings({ username }: Props) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const canView = useIsAllowed("GET", "/mappings/user/{username}");
  const canDeleteSources = useIsAllowed("DELETE", "/mappings/sources/{username}");

  const [open, setOpen] = useState(false);

  // Mappings originating from user
  const fetchMappings = useCallback(() => getUserMappings(username), [username]);
  const {
    data: mappings,
    isLoading: loadingMappings,
    error: errorMappings,
  } = useFetchData<UserMappingEntry[]>(canView ? fetchMappings : null);

  // Sources pointing to user (one per type)
  const fetchSources = useCallback(async () => {
    const results: { type: SourceType; sources: string[] }[] = [];
    for (const type of SOURCE_TYPES) {
      try {
        const sources = await getUserMappingSources(username, type);
        if (sources.length > 0) {
          results.push({ type, sources });
        }
      } catch {
        // type may not apply, skip
      }
    }
    return results;
  }, [username]);
  const {
    data: sourcesData,
    isLoading: loadingSources,
    error: errorSources,
    refresh: refreshSources,
  } = useFetchData<{ type: SourceType; sources: string[] }[]>(canView ? fetchSources : null);

  const sortedMappings = useMemo(() => {
    if (!mappings) return [];
    return [...mappings].sort((a, b) => a.type.localeCompare(b.type));
  }, [mappings]);

  if (!canView) return null;

  const handleDeleteSources = async (type: SourceType) => {
    const confirmed = await confirm({
      header: `Remove all ${type} sources`,
      message: `Remove all ${type} mappings pointing to ${username}?`,
    });
    if (!confirmed) return;
    try {
      await deleteUserMappingSources(username, type);
      toast({ title: `All ${type} sources removed successfully` });
      await refreshSources();
    } catch (err) {
      toast({
        title: `Error removing ${type} sources`,
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  const isLoading = loadingMappings || loadingSources;
  const totalCount =
    (mappings?.length ?? 0) +
    (sourcesData?.reduce((sum, s) => sum + s.sources.length, 0) ?? 0);

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-md font-semibold hover:text-blue-600 transition"
        >
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          Mappings
          {!isLoading && (
            <span className="text-sm font-normal text-gray-500">
              ({totalCount})
            </span>
          )}
        </button>
      </div>

      {open && (
        <div className="mt-2">
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            </div>
          )}
          {errorMappings && <p className="text-red-500 mt-2">Error loading mappings: {errorMappings}</p>}
          {errorSources && <p className="text-red-500 mt-2">Error loading sources: {errorSources}</p>}

          {/* Mappings originating from user */}
          {sortedMappings.length > 0 && (
            <div className="mt-2">
              <h4 className="text-sm font-semibold text-gray-600 mb-1">Mappings from this user</h4>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="text-left px-4 py-2 text-sm font-medium">#</th>
                    <th className="text-left px-4 py-2 text-sm font-medium">Type</th>
                    <th className="text-left px-4 py-2 text-sm font-medium">Destination</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMappings.map((m, index) => (
                    <tr key={`${m.type}-${m.mapping}-${index}`} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-500">{index + 1}</td>
                      <td className="px-4 py-2 text-sm">{m.type}</td>
                      <td className="px-4 py-2 text-sm">{m.mapping}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Sources pointing to user */}
          {sourcesData && sourcesData.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-gray-600 mb-1">Sources pointing to this user</h4>
              {sourcesData.map(({ type, sources }) => (
                <div key={type} className="mt-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium capitalize">{type}</span>
                    <span className="text-sm text-gray-500">({sources.length})</span>
                    {canDeleteSources && (
                      <button
                        onClick={() => handleDeleteSources(type)}
                        className="p-1 rounded-md hover:bg-red-100 text-red-500 transition"
                        title={`Remove all ${type} sources`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {sources.map((source, index) => (
                    <div
                      key={source}
                      className="space-y-1 p-3 bg-gray-50 rounded-2 my-1 flex items-center"
                    >
                      <span className="text-gray-500 mr-2 text-sm">{index + 1}/</span>
                      <span className="text-sm">{source}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {!isLoading && totalCount === 0 && (
            <p className="mt-2 text-sm text-gray-500">No mappings found.</p>
          )}
        </div>
      )}
    </div>
  );
}
