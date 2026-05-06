import { useState } from "react";
import { Link } from "react-router";
import { ChevronDown, ChevronRight, Search, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { apiClient } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

interface QuotaValues {
  count: number | null;
  size: number | null;
}

interface OccupationRatio {
  size: number;
  count: number;
  max: number;
}

interface Occupation {
  size: number;
  count: number;
  ratio: OccupationRatio;
}

interface UserQuotaDetail {
  global: QuotaValues;
  domain: QuotaValues;
  user: QuotaValues;
  computed: QuotaValues;
  occupation: Occupation;
}

interface UserQuotaEntry {
  username: string;
  detail: UserQuotaDetail;
}

function formatSize(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes === -1) return "unlimited";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatCount(count: number | null): string {
  if (count === null) return "—";
  if (count === -1) return "unlimited";
  return count.toLocaleString();
}

function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

interface Props {
  domain?: string;
}

export default function ExploreUserQuota({ domain }: Props) {
  const { t } = useTranslation();
  const canSearch = useIsAllowed("GET", "/quota/users");
  const [open, setOpen] = useState(false);
  const [minPercent, setMinPercent] = useState("80");
  const [maxPercent, setMaxPercent] = useState("100");
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<UserQuotaEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  if (!canSearch) return null;

  const fetchUsers = async (targetPage: number) => {
    const minRatio = parseFloat(minPercent) / 100;
    const maxRatio = parseFloat(maxPercent) / 100;
    if (isNaN(minRatio) || isNaN(maxRatio)) return;

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("minOccupationRatio", String(minRatio));
      params.set("maxOccupationRatio", String(maxRatio));
      params.set("limit", String(PAGE_LIMIT));
      params.set("offset", String((targetPage - 1) * PAGE_LIMIT));
      if (domain) params.set("domain", domain);

      const data: UserQuotaEntry[] = await apiClient.get(`/quota/users?${params.toString()}`);
      setResults(data);
      setPage(targetPage);
      setSearched(true);
    } catch (err: any) {
      setError(err?.message || "Failed to fetch");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => fetchUsers(1);

  const hasMore = results.length >= PAGE_LIMIT;

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-md font-semibold hover:text-blue-600 transition"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {t("exploreQuota.title")}
      </button>

      {open && (
        <div className="mt-2">
          {/* Search controls */}
          <div className="p-4 bg-gray-50 rounded-2 space-y-3">
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="text-xs text-gray-500 font-medium">{t("exploreQuota.minOccupation")}</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={minPercent}
                  onChange={(e) => setMinPercent(e.target.value)}
                  className="w-24 mt-1 block px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">{t("exploreQuota.maxOccupation")}</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={maxPercent}
                  onChange={(e) => setMaxPercent(e.target.value)}
                  className="w-24 mt-1 block px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <Button size="sm" onClick={handleSearch} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Search className="w-4 h-4 mr-1" />}
                {t("common.search")}
              </Button>
            </div>

            {error && <p className="text-red-500 text-sm mt-2">Error: {error}</p>}

            {searched && !loading && (
              <div className="mt-3">
                {results.length === 0 ? (
                  <p className="text-sm text-gray-500">{t("exploreQuota.empty")}</p>
                ) : (
                  <>
                    {/* Legend */}
                    <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-2 text-xs font-semibold text-muted-foreground px-2 pb-2 border-b mb-1">
                      <span className="w-8">#</span>
                      <span>{t("exploreQuota.username")}</span>
                      <span className="w-24 text-right">{t("exploreQuota.occupationSize")}</span>
                      <span className="w-24 text-right">{t("exploreQuota.occupationCount")}</span>
                      <span className="w-20 text-right">{t("exploreQuota.ratioMax")}</span>
                      <span className="w-28 text-right">{t("exploreQuota.computedLimit")}</span>
                    </div>

                    <div className="space-y-1">
                      {results.map((entry, index) => {
                        const globalIndex = (page - 1) * PAGE_LIMIT + index + 1;
                        const occ = entry.detail.occupation;
                        const comp = entry.detail.computed;
                        return (
                          <div
                            key={entry.username}
                            className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-2 items-center px-2 py-2 bg-white rounded hover:bg-gray-100 transition text-sm"
                          >
                            <span className="text-muted-foreground w-8">{globalIndex}.</span>
                            <Link
                              to={`/users/user/${encodeURIComponent(entry.username)}`}
                              className="text-blue-600 hover:underline truncate"
                            >
                              {entry.username}
                            </Link>
                            <span className="w-24 text-right font-mono text-xs">
                              {formatSize(occ.size)}
                              <span className="text-gray-400 ml-1">({formatPercent(occ.ratio.size)})</span>
                            </span>
                            <span className="w-24 text-right font-mono text-xs">
                              {formatCount(occ.count)}
                              <span className="text-gray-400 ml-1">({formatPercent(occ.ratio.count)})</span>
                            </span>
                            <span className="w-20 text-right font-semibold text-xs">
                              {formatPercent(occ.ratio.max)}
                            </span>
                            <span className="w-28 text-right text-xs text-gray-500">
                              {formatSize(comp.size)} / {formatCount(comp.count)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Pagination */}
                    <div className="mt-3 flex justify-between items-center">
                      <button
                        onClick={() => fetchUsers(page - 1)}
                        disabled={page <= 1 || loading}
                        className="px-3 py-1.5 bg-gray-200 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t("common.previous")}
                      </button>
                      <span className="text-xs text-gray-500">
                        {t("exploreQuota.page", { page, count: results.length })}
                      </span>
                      <button
                        onClick={() => fetchUsers(page + 1)}
                        disabled={!hasMore || loading}
                        className="px-3 py-1.5 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t("common.next")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
