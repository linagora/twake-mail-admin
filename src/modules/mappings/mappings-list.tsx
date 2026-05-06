import { useFetchData } from "@/hooks/use-fetch-data";
import {
  getMappings,
  createAddressMapping,
  deleteAddressMapping,
  deleteAliasMapping,
  deleteForwardMapping,
  deleteDomainMapping,
  createRegexMapping,
  deleteRegexMapping,
} from "./api-client";
import { GetMappingsResponseType, FlatMapping } from "./types";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Plus, Trash2 } from "lucide-react";
import { useConfirm } from "@/hooks/use-confirm";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { PaginationControls } from "@/components/custom/pagination-controls";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

export default function MappingsList() {
  const { t } = useTranslation();
  const canAddAddress = useIsAllowed("POST", "/mappings/address/{source}/targets/{destination}");
  const canAddRegex = useIsAllowed("POST", "/mappings/regex/{source}/targets/{regex}");
  const canDelete = useIsAllowed("DELETE", "/mappings/address/{source}/targets/{destination}");

  const {
    data: mappingsResult,
    isLoading,
    error,
    refresh,
  } = useFetchData<GetMappingsResponseType>(getMappings);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [creating, setCreating] = useState(false);

  const [showCreateRegex, setShowCreateRegex] = useState(false);
  const [regexSource, setRegexSource] = useState("");
  const [regexValue, setRegexValue] = useState("");
  const [creatingRegex, setCreatingRegex] = useState(false);
  const { toast } = useToast();
  const confirm = useConfirm();

  const handleDelete = async (mapping: FlatMapping) => {
    const typeLabel = mapping.type.toLowerCase();
    const confirmed = await confirm({
      header: t("mappings.removeTitle", { type: mapping.type }),
      message: t("mappings.removeConfirm", { typeLabel, source: mapping.source, destination: mapping.destination }),
    });
    if (!confirmed) return;
    try {
      switch (mapping.type) {
        case "Address":
          await deleteAddressMapping(mapping.source, mapping.destination);
          break;
        case "Alias":
          await deleteAliasMapping(mapping.source, mapping.destination);
          break;
        case "Forward":
          await deleteForwardMapping(mapping.source, mapping.destination);
          break;
        case "Domain":
        case "DomainAlias":
          await deleteDomainMapping(mapping.source, mapping.destination);
          break;
        case "Regex":
          await deleteRegexMapping(mapping.source, mapping.destination);
          break;
        default:
          return;
      }
      toast({ title: t("mappings.removed", { type: mapping.type }) });
      await refresh();
    } catch (err) {
      toast({
        title: t("mappings.errorRemoving", { typeLabel }),
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  const handleCreateRegex = async () => {
    const src = regexSource.trim();
    const regex = regexValue.trim();
    if (!src || !regex) return;
    setCreatingRegex(true);
    try {
      await createRegexMapping(src, regex);
      toast({ title: t("mappings.regexCreated") });
      setRegexSource("");
      setRegexValue("");
      setShowCreateRegex(false);
      await refresh();
    } catch (err) {
      toast({
        title: t("mappings.errorCreatingRegex"),
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setCreatingRegex(false);
    }
  };

  const handleCreate = async () => {
    const src = source.trim();
    const dest = destination.trim();
    if (!src || !dest) return;
    setCreating(true);
    try {
      await createAddressMapping(src, dest);
      toast({ title: t("mappings.addressCreated") });
      setSource("");
      setDestination("");
      setShowCreate(false);
      await refresh();
    } catch (err) {
      toast({
        title: t("mappings.errorCreatingAddress"),
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setCreating(false);
    }
  };

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
      <div className="mt-4 flex items-center gap-2">
        {canAddAddress && (
          <button
            onClick={() => { setShowCreate(!showCreate); setShowCreateRegex(false); }}
            className="flex items-center gap-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition text-sm"
          >
            <Plus className="w-4 h-4" />
            {t("mappings.addAddress")}
          </button>
        )}
        {canAddRegex && (
          <button
            onClick={() => { setShowCreateRegex(!showCreateRegex); setShowCreate(false); }}
            className="flex items-center gap-1 px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition text-sm"
          >
            <Plus className="w-4 h-4" />
            {t("mappings.addRegex")}
          </button>
        )}
      </div>

      {showCreate && (
        <div className="mt-3 p-4 border rounded-md bg-gray-50 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder={t("mappings.sourcePlaceholder")}
              className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-400 text-sm">→</span>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder={t("mappings.destinationPlaceholder")}
              className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreate}
              disabled={creating || !source.trim() || !destination.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? t("mappings.creating") : t("common.create")}
            </button>
            <button
              onClick={() => { setShowCreate(false); setSource(""); setDestination(""); }}
              className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300 transition text-sm"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {showCreateRegex && (
        <div className="mt-3 p-4 border rounded-md bg-gray-50 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={regexSource}
              onChange={(e) => setRegexSource(e.target.value)}
              placeholder={t("mappings.mappingSourcePlaceholder")}
              className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <span className="text-gray-400 text-sm">→</span>
            <input
              type="text"
              value={regexValue}
              onChange={(e) => setRegexValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateRegex()}
              placeholder={t("mappings.regexPlaceholder")}
              className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateRegex}
              disabled={creatingRegex || !regexSource.trim() || !regexValue.trim()}
              className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creatingRegex ? t("mappings.creating") : t("common.create")}
            </button>
            <button
              onClick={() => { setShowCreateRegex(false); setRegexSource(""); setRegexValue(""); }}
              className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300 transition text-sm"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

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
        placeholder={t("mappings.searchPlaceholder")}
        className="mt-4 w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {filteredMappings.length > 0 && (
        <PaginationControls
          onFirst={() => goToPage(1)}
          onPrev={() => goToPage(page - 1)}
          onNext={() => goToPage(page + 1)}
          onLast={() => goToPage(totalPages)}
          disabledPrev={page <= 1}
          disabledNext={page >= totalPages}
          label={t("common.page", { page, totalPages, total: filteredMappings.length })}
        />
      )}
      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left px-4 py-2 text-sm font-medium">#</th>
            <th className="text-left px-4 py-2 text-sm font-medium">{t("mappings.source")}</th>
            <th className="text-left px-4 py-2 text-sm font-medium">{t("mappings.type")}</th>
            <th className="text-left px-4 py-2 text-sm font-medium">{t("mappings.destination")}</th>
            <th className="text-left px-4 py-2 text-sm font-medium">{t("mappings.action")}</th>
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
              <td className="px-4 py-2 text-sm">
                {canDelete && ["Address", "Alias", "Forward", "Domain", "DomainAlias", "Regex"].includes(mapping.type) && (
                  <button
                    onClick={() => handleDelete(mapping)}
                    className="p-1 rounded-md hover:bg-red-100 text-red-500 transition"
                    title={t("mappings.removeTitle", { type: mapping.type })}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!isLoading && filteredMappings.length === 0 && (
        <p className="mt-4 text-gray-500 text-sm">{t("mappings.empty")}</p>
      )}
    </div>
  );
}
