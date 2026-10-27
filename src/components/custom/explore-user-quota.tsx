import { FormEvent, useId, useState } from "react";
import UserLink from "@/components/custom/user-link";
import { Search, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { apiClient } from "@/lib/apiClient";
import { appConfig } from "@/lib/config";
import { Button } from "@/components/ui/button";
import i18n from "i18next";
import { currentLocale } from "@/i18n/locale";
import { formatByteSize } from "@/i18n/format-size";
import { formatPercent } from "@/i18n/format-percent";
import { toErrorMessage } from "./error-message";
import { SectionToggle, useSectionOpen } from "@/components/custom/collapsible-section";
import { PaginationControls } from "@/components/custom/pagination-controls";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

// From sm: index | username | occupation size | occupation count | ratio max | computed limit.
// Below sm: index | username (the labelled figures stacked under it).
const QUOTA_GRID_COLUMNS = "grid-cols-[2rem_minmax(0,1fr)] sm:grid-cols-[2rem_minmax(0,1fr)_6rem_6rem_5rem_7rem]";

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

// The column name of a figure, shown before it when the rows are stacked below sm
function FigureLabel({ label }: { label: string }) {
  const { t } = useTranslation();
  return <span className="sm:hidden font-sans font-normal text-gray-500">{t("exploreQuota.labelled", { label })} </span>;
}

function formatSize(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes === -1) return i18n.t("quotaLimits.unlimited");
  return formatByteSize(bytes);
}

function formatCount(count: number | null): string {
  if (count === null) return "—";
  if (count === -1) return i18n.t("quotaLimits.unlimited");
  return count.toLocaleString(currentLocale());
}

interface Props {
  domain?: string;
}

interface OccupationRange {
  minRatio: number;
  maxRatio: number;
}

interface RangeErrors {
  min?: string;
  max?: string;
}

const parsePercent = (value: string): number | undefined => {
  const percent = value.trim() === "" ? NaN : Number(value);
  return Number.isFinite(percent) && percent >= 0 && percent <= 100 ? percent : undefined;
};

// WebAdmin rejects negative ratios and silently returns nothing for inverted ranges: both are flagged before sending.
const validateRange = (minPercent: string, maxPercent: string): OccupationRange | RangeErrors => {
  const min = parsePercent(minPercent);
  const max = parsePercent(maxPercent);
  if (min === undefined || max === undefined) {
    return {
      min: min === undefined ? "exploreQuota.invalidPercent" : undefined,
      max: max === undefined ? "exploreQuota.invalidPercent" : undefined,
    };
  }
  if (min > max) {
    return { max: "exploreQuota.minAboveMax" };
  }
  return { minRatio: min / 100, maxRatio: max / 100 };
};

const isValidRange = (range: OccupationRange | RangeErrors): range is OccupationRange => "minRatio" in range;

export default function ExploreUserQuota({ domain }: Props) {
  const { t } = useTranslation();
  const idPrefix = useId();
  const canSearchGlobal = useIsAllowed("GET", "/quota/users?minOccupationRatio={min}&maxOccupationRatio={max}&limit={limit}&offset={offset}");
  const canSearchDomain = useIsAllowed("GET", "/quota/users?minOccupationRatio={min}&maxOccupationRatio={max}&limit={limit}&offset={offset}&domain={domain}");
  const canSearch = domain ? canSearchDomain : canSearchGlobal;
  const [open, setOpen, openContentId] = useSectionOpen("explore-user-quota");
  const [minPercent, setMinPercent] = useState("80");
  const [maxPercent, setMaxPercent] = useState("100");
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<UserQuotaEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [rangeErrors, setRangeErrors] = useState<RangeErrors>({});

  if (!canSearch || appConfig.application !== 'MAIL') return null;

  const fetchUsers = async (targetPage: number) => {
    const range = validateRange(minPercent, maxPercent);
    if (!isValidRange(range)) {
      // The previous results no longer match the fields
      setRangeErrors(range);
      setError(null);
      setResults([]);
      setSearched(false);
      return;
    }
    const { minRatio, maxRatio } = range;

    setRangeErrors({});
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
    } catch (err: unknown) {
      const { message, details } = toErrorMessage(err);
      setError(details ? `${message} ${details}` : message);
      setResults([]);
      setSearched(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    fetchUsers(1);
  };

  const hasMore = results.length >= PAGE_LIMIT;

  return (
    <div className="mt-6">
      <SectionToggle open={open} onToggle={() => setOpen(!open)} controls={openContentId}>
        {t("exploreQuota.title")}
      </SectionToggle>

      {open && (
        <div id={openContentId} className="mt-2">
          {/* Search controls */}
          <div className="p-4 bg-gray-50 rounded-2 space-y-3">
            <form onSubmit={handleSearch} noValidate className="flex items-start gap-3 flex-wrap">
              <div>
                <label htmlFor={`${idPrefix}-min`} className="text-xs text-gray-500 font-medium">{t("exploreQuota.minOccupation")}</label>
                <input
                  id={`${idPrefix}-min`}
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={minPercent}
                  onChange={(e) => setMinPercent(e.target.value)}
                  aria-invalid={!!rangeErrors.min}
                  aria-describedby={rangeErrors.min ? `${idPrefix}-min-error` : undefined}
                  className="w-24 mt-1 block px-3 py-1.5 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 aria-invalid:border-red-500"
                />
                {rangeErrors.min && (
                  <p id={`${idPrefix}-min-error`} role="alert" className="mt-1 max-w-48 text-xs text-red-500">
                    {t(rangeErrors.min)}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor={`${idPrefix}-max`} className="text-xs text-gray-500 font-medium">{t("exploreQuota.maxOccupation")}</label>
                <input
                  id={`${idPrefix}-max`}
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={maxPercent}
                  onChange={(e) => setMaxPercent(e.target.value)}
                  aria-invalid={!!rangeErrors.max}
                  aria-describedby={rangeErrors.max ? `${idPrefix}-max-error` : undefined}
                  className="w-24 mt-1 block px-3 py-1.5 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 aria-invalid:border-red-500"
                />
                {rangeErrors.max && (
                  <p id={`${idPrefix}-max-error`} role="alert" className="mt-1 max-w-48 text-xs text-red-500">
                    {t(rangeErrors.max)}
                  </p>
                )}
              </div>
              <Button type="submit" size="sm" disabled={loading} className="mt-5">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Search className="w-4 h-4 mr-1" />}
                {t("common.search")}
              </Button>
            </form>

            {error && <p className="text-red-500 text-sm mt-2">{t("common.errorPrefix", { message: error })}</p>}

            {searched && !loading && (
              <div className="mt-3">
                {results.length === 0 ? (
                  <p className="text-sm text-gray-500">{t("exploreQuota.empty")}</p>
                ) : (
                  <>
                    {/* Legend */}
                    <div
                      data-testid="explore-quota-header"
                      className={`hidden sm:grid ${QUOTA_GRID_COLUMNS} gap-2 text-xs font-semibold text-muted-foreground px-2 pb-2 border-b mb-1`}
                    >
                      <span>#</span>
                      <span>{t("exploreQuota.username")}</span>
                      <span className="text-right">{t("exploreQuota.occupationSize")}</span>
                      <span className="text-right">{t("exploreQuota.occupationCount")}</span>
                      <span className="text-right">{t("exploreQuota.ratioMax")}</span>
                      <span className="text-right">{t("exploreQuota.computedLimit")}</span>
                    </div>

                    <div className="space-y-1">
                      {results.map((entry, index) => {
                        const globalIndex = (page - 1) * PAGE_LIMIT + index + 1;
                        const occ = entry.detail.occupation;
                        const comp = entry.detail.computed;
                        return (
                          <div
                            key={entry.username}
                            data-testid="explore-quota-row"
                            className={`grid ${QUOTA_GRID_COLUMNS} gap-x-2 gap-y-1 items-center px-2 py-2 bg-white rounded hover:bg-gray-100 transition text-sm`}
                          >
                            <span className="text-muted-foreground">{globalIndex}.</span>
                            <UserLink address={entry.username} known className="min-w-0 sm:truncate" />
                            {/* Below sm the header is hidden: the labelled figures stack under the username */}
                            <div className="col-start-2 min-w-0 flex flex-col gap-0.5 text-xs sm:contents">
                              <span className="font-mono sm:text-right">
                                <FigureLabel label={t("exploreQuota.occupationSize")} />
                                {formatSize(occ.size)}
                                <span className="text-gray-400 ml-1">({formatPercent(occ.ratio.size)})</span>
                              </span>
                              <span className="font-mono sm:text-right">
                                <FigureLabel label={t("exploreQuota.occupationCount")} />
                                {formatCount(occ.count)}
                                <span className="text-gray-400 ml-1">({formatPercent(occ.ratio.count)})</span>
                              </span>
                              <span className="font-semibold sm:text-right">
                                <FigureLabel label={t("exploreQuota.ratioMax")} />
                                {formatPercent(occ.ratio.max)}
                              </span>
                              <span className="text-gray-500 sm:text-right">
                                <FigureLabel label={t("exploreQuota.computedLimit")} />
                                {formatSize(comp.size)} / {formatCount(comp.count)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Pagination */}
                    <PaginationControls
                      onFirst={() => fetchUsers(1)}
                      onPrev={() => fetchUsers(page - 1)}
                      onNext={() => fetchUsers(page + 1)}
                      disabledPrev={page <= 1}
                      disabledNext={!hasMore}
                      label={t("exploreQuota.page", { page, count: results.length })}
                      total={results.length}
                    />
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
