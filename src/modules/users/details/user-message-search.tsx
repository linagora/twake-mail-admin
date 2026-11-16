import { useState, useEffect, useId } from "react";
import { useParams } from "react-router";
import { ChevronDown, ChevronRight, Loader2, Paperclip, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { searchUserMails, getUserMailboxes } from "../api-client";
import { MailSearchFilter, MailSearchResult } from "../types";
import ErrorDisplayer from "@/components/custom/error-displayer";
import UnavailableFeature from "@/components/custom/unavailable-feature";
import { isMissingRoute } from "@/lib/missing-route";
import { markFeatureUnavailable, useFeatureUnavailable } from "@/lib/unavailable-features";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import Header from "@/components/custom/header";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { PaginationControls } from "@/components/custom/pagination-controls";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

const MESSAGE_SEARCH_DOC_URL =
  "https://github.com/linagora/tmail-backend/blob/master/docs/modules/ROOT/pages/tmail-backend/webadmin.adoc#user-mails-search";

const SORT_PROPERTIES = ["receivedAt", "from", "subject"] as const;

function formatAddresses(addrs?: { name?: string; email: string }[]): string {
  if (!addrs || addrs.length === 0) return "—";
  return addrs.map((a) => (a.name ? `${a.name} <${a.email}>` : a.email)).join(", ");
}

function splitTrimmed(val: string): string[] {
  return val.split(",").map((s) => s.trim()).filter(Boolean);
}

interface SortEntry {
  property: (typeof SORT_PROPERTIES)[number];
  isAscending: boolean;
}

export default function UserMessageSearch() {
  const { username } = useParams<{ username: string }>();
  const breadcrumbs = useBreadcrumbs();
  const { t } = useTranslation();
  const idPrefix = useId();
  const canSearch = useIsAllowed("POST", "/users/{username}/mails");
  const unavailable = useFeatureUnavailable("messageSearch");

  // Form state
  const [reason, setReason] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterHasAttachment, setFilterHasAttachment] = useState<"any" | "yes" | "no">("any");
  const [filterHasKeywords, setFilterHasKeywords] = useState("");
  const [filterInMailboxes, setFilterInMailboxes] = useState("");
  const [filterInMailboxOtherThan, setFilterInMailboxOtherThan] = useState("");
  const [filterBefore, setFilterBefore] = useState("");
  const [filterAfter, setFilterAfter] = useState("");
  const [sorts, setSorts] = useState<SortEntry[]>([{ property: "receivedAt", isAscending: false }]);

  // Mailbox index: id → name
  const [mailboxIndex, setMailboxIndex] = useState<Record<string, string>>({});

  useEffect(() => {
    getUserMailboxes(username!).then((mailboxes) => {
      const index: Record<string, string> = {};
      for (const m of mailboxes) index[m.mailboxId] = m.mailboxName;
      setMailboxIndex(index);
    }).catch(() => { /* non-bloquant */ });
  }, [username]);

  // Pagination & results state
  const [results, setResults] = useState<MailSearchResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const page = Math.floor(offset / PAGE_LIMIT) + 1;

  const buildRequestBody = () => {
    const filter: MailSearchFilter = {};
    if (filterText.trim()) filter.text = filterText.trim();
    if (filterFrom.trim()) filter.from = filterFrom.trim();
    if (filterTo.trim()) filter.to = filterTo.trim();
    if (filterSubject.trim()) filter.subject = filterSubject.trim();
    if (filterHasAttachment !== "any") filter.hasAttachment = filterHasAttachment === "yes";
    const keywords = splitTrimmed(filterHasKeywords);
    if (keywords.length) filter.hasKeywords = keywords;
    const inMbx = splitTrimmed(filterInMailboxes);
    if (inMbx.length) filter.inMailboxes = inMbx;
    const notInMbx = splitTrimmed(filterInMailboxOtherThan);
    if (notInMbx.length) filter.inMailboxOtherThan = notInMbx;
    if (filterBefore.trim()) filter.before = filterBefore.trim();
    if (filterAfter.trim()) filter.after = filterAfter.trim();

    return {
      reason: reason.trim(),
      filter: Object.keys(filter).length ? filter : undefined,
      sort: sorts.length
        ? sorts.map((s) => ({ property: s.property, isAscending: s.isAscending }))
        : undefined,
    };
  };

  const doSearch = async (newOffset: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await searchUserMails(username!, buildRequestBody(), {
        limit: PAGE_LIMIT,
        offset: newOffset,
      });
      setResults(data);
      setOffset(newOffset);
      setHasMore(data.length === PAGE_LIMIT);
    } catch (err) {
      if (isMissingRoute(err)) markFeatureUnavailable("messageSearch");
      else setError(err);
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  };

  if (!canSearch) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(0);
  };

  const addSort = () => {
    setSorts((prev) => [...prev, { property: "receivedAt", isAscending: false }]);
  };

  const removeSort = (idx: number) => {
    setSorts((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateSort = (idx: number, patch: Partial<SortEntry>) => {
    setSorts((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  return (
    <>
    <Header
      headerTitle={t("users.messageSearch.title")}
      documentTitle={`${t("users.messageSearch.title")} — ${username}`}
      breadcrumb={breadcrumbs.user(username!)}
    />
    {unavailable ? (
      <UnavailableFeature
        title={t("users.messageSearch.unavailableTitle")}
        text={t("users.messageSearch.unavailableText")}
        docUrl={MESSAGE_SEARCH_DOC_URL}
      />
    ) : (
    <div className="mt-4 p-4 bg-white rounded-2">

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Reason */}
        <div>
          <label htmlFor={`${idPrefix}-reason`} className="block text-sm font-medium mb-1">
            {t("users.messageSearch.reasonLabel")} <span className="text-red-500">*</span>
          </label>
          <input
            id={`${idPrefix}-reason`}
            type="text"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("users.messageSearch.reasonPlaceholder")}
            className="w-full px-4 py-2 border rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filters (collapsible) */}
        <div>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            className="flex items-center gap-2 text-sm font-medium hover:text-blue-600 transition"
          >
            {showFilters ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            {t("users.messageSearch.filters")}
          </button>

          {showFilters && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 pl-4 border-l-2 border-gray-100">
              <div>
                <label htmlFor={`${idPrefix}-text`} className="block text-xs text-gray-500 mb-1">{t("users.messageSearch.fullText")}</label>
                <input
                  id={`${idPrefix}-text`}
                  type="text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder={t("users.messageSearch.fullTextPlaceholder")}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor={`${idPrefix}-from`} className="block text-xs text-gray-500 mb-1">{t("users.messageSearch.from")}</label>
                <input
                  id={`${idPrefix}-from`}
                  type="text"
                  value={filterFrom}
                  onChange={(e) => setFilterFrom(e.target.value)}
                  placeholder={t("users.messageSearch.fromPlaceholder")}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor={`${idPrefix}-to`} className="block text-xs text-gray-500 mb-1">{t("users.messageSearch.to")}</label>
                <input
                  id={`${idPrefix}-to`}
                  type="text"
                  value={filterTo}
                  onChange={(e) => setFilterTo(e.target.value)}
                  placeholder={t("users.messageSearch.toPlaceholder")}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor={`${idPrefix}-subject`} className="block text-xs text-gray-500 mb-1">{t("users.messageSearch.subject")}</label>
                <input
                  id={`${idPrefix}-subject`}
                  type="text"
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                  placeholder={t("users.messageSearch.subjectPlaceholder")}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor={`${idPrefix}-hasAttachment`} className="block text-xs text-gray-500 mb-1">{t("users.messageSearch.hasAttachment")}</label>
                <select
                  id={`${idPrefix}-hasAttachment`}
                  value={filterHasAttachment}
                  onChange={(e) => setFilterHasAttachment(e.target.value as "any" | "yes" | "no")}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="any">{t("users.messageSearch.any")}</option>
                  <option value="yes">{t("common.yes")}</option>
                  <option value="no">{t("common.no")}</option>
                </select>
              </div>
              <div>
                <label htmlFor={`${idPrefix}-hasKeywords`} className="block text-xs text-gray-500 mb-1">
                  {t("users.messageSearch.hasKeywords")} <span className="font-normal">{t("users.messageSearch.hasKeywordsHint")}</span>
                </label>
                <input
                  id={`${idPrefix}-hasKeywords`}
                  type="text"
                  value={filterHasKeywords}
                  onChange={(e) => setFilterHasKeywords(e.target.value)}
                  placeholder={t("users.messageSearch.hasKeywordsPlaceholder")}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor={`${idPrefix}-inMailboxes`} className="block text-xs text-gray-500 mb-1">
                  {t("users.messageSearch.inMailboxes")} <span className="font-normal">{t("users.messageSearch.inMailboxesHint")}</span>
                </label>
                <input
                  id={`${idPrefix}-inMailboxes`}
                  type="text"
                  value={filterInMailboxes}
                  onChange={(e) => setFilterInMailboxes(e.target.value)}
                  placeholder={t("users.messageSearch.inMailboxesPlaceholder")}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor={`${idPrefix}-excludeMailboxes`} className="block text-xs text-gray-500 mb-1">
                  {t("users.messageSearch.excludeMailboxes")} <span className="font-normal">{t("users.messageSearch.inMailboxesHint")}</span>
                </label>
                <input
                  id={`${idPrefix}-excludeMailboxes`}
                  type="text"
                  value={filterInMailboxOtherThan}
                  onChange={(e) => setFilterInMailboxOtherThan(e.target.value)}
                  placeholder={t("users.messageSearch.excludeMailboxesPlaceholder")}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor={`${idPrefix}-receivedAfter`} className="block text-xs text-gray-500 mb-1">{t("users.messageSearch.receivedAfter")}</label>
                <input
                  id={`${idPrefix}-receivedAfter`}
                  type="text"
                  value={filterAfter}
                  onChange={(e) => setFilterAfter(e.target.value)}
                  placeholder="2024-01-01T00:00:00Z"
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor={`${idPrefix}-receivedBefore`} className="block text-xs text-gray-500 mb-1">{t("users.messageSearch.receivedBefore")}</label>
                <input
                  id={`${idPrefix}-receivedBefore`}
                  type="text"
                  value={filterBefore}
                  onChange={(e) => setFilterBefore(e.target.value)}
                  placeholder="2024-01-31T23:59:59Z"
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Sort */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium">{t("users.messageSearch.sort")}</span>
            {sorts.length < 3 && (
              <button
                type="button"
                onClick={addSort}
                className="text-xs text-blue-500 hover:underline"
              >
                {t("users.messageSearch.addSort")}
              </button>
            )}
          </div>
          <div className="space-y-2">
            {sorts.map((s, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select
                  value={s.property}
                  onChange={(e) => updateSort(idx, { property: e.target.value as SortEntry["property"] })}
                  aria-label={t("users.messageSearch.sortField")}
                  className="px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  {SORT_PROPERTIES.map((p) => (
                    <option key={p} value={p}>{t(`users.messageSearch.sortProperty.${p}`)}</option>
                  ))}
                </select>
                <select
                  value={s.isAscending ? "asc" : "desc"}
                  onChange={(e) => updateSort(idx, { isAscending: e.target.value === "asc" })}
                  aria-label={t("users.messageSearch.sortDirection")}
                  className="px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="desc">{t("users.messageSearch.descending")}</option>
                  <option value="asc">{t("users.messageSearch.ascending")}</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeSort(idx)}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  {t("users.messageSearch.removeSort")}
                </button>
              </div>
            ))}
            {sorts.length === 0 && (
              <p className="text-xs text-gray-400">{t("users.messageSearch.noSort")}</p>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={!reason.trim() || isLoading}
          className="flex items-center gap-2 px-5 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {t("common.search")}
        </button>
      </form>

      {/* Error */}
      {!!error && (
        <div className="mt-4 text-red-500 text-sm">
          <ErrorDisplayer error={error} />
        </div>
      )}

      {/* Results */}
      {results !== null && !isLoading && (
        <div className="mt-6">
          <PaginationControls
            onFirst={() => doSearch(0)}
            onPrev={() => doSearch(offset - PAGE_LIMIT)}
            onNext={() => doSearch(offset + PAGE_LIMIT)}
            disabledPrev={offset === 0}
            disabledNext={!hasMore}
            label={`${t("common.pageOf", { page, count: results.length })}${hasMore ? "+" : ""}`}
            total={results.length}
          />

          {results.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">{t("users.messageSearch.noResults")}</p>
          ) : (
            <div className="mt-3 space-y-2">
              {results.map((msg, index) => (
                <div
                  key={msg.id}
                  className="p-4 bg-gray-50 rounded-2 space-y-1"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-medium leading-snug">
                      <span className="text-gray-400 mr-2 font-normal">
                        {offset + index + 1}.
                      </span>
                      {msg.subject || <span className="text-gray-400 italic">{t("users.messageSearch.noSubject")}</span>}
                    </h4>
                    <span className="flex items-center gap-1 shrink-0">
                      {msg.hasAttachment && (
                        <Paperclip className="w-3.5 h-3.5 text-gray-400" aria-label={t("users.messageSearch.hasAttachment")} />
                      )}
                      {msg.receivedAt && (
                        <span className="text-xs text-gray-400">{msg.receivedAt}</span>
                      )}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 ml-6">
                    <span className="font-medium">{t("users.messageSearch.fromLabel")}</span> {formatAddresses(msg.from)}
                  </p>
                  <p className="text-xs text-gray-500 ml-6">
                    <span className="font-medium">{t("users.messageSearch.toLabel")}</span> {formatAddresses(msg.to)}
                  </p>

                  {msg.preview && (
                    <p className="text-xs text-gray-400 ml-6 italic line-clamp-2">{msg.preview}</p>
                  )}

                  <div className="flex flex-wrap gap-2 ml-6 mt-1">
                    {msg.keywords &&
                      Object.entries(msg.keywords)
                        .filter(([, v]) => v)
                        .map(([k]) => (
                          <span
                            key={k}
                            className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full"
                          >
                            {k}
                          </span>
                        ))}
                    {msg.mailboxIds &&
                      Object.entries(msg.mailboxIds)
                        .filter(([, v]) => v)
                        .map(([id]) => (
                          <span
                            key={id}
                            className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full flex flex-col leading-tight"
                          >
                            {mailboxIndex[id] && (
                              <span className="font-medium">{mailboxIndex[id]}</span>
                            )}
                            <span className="font-mono opacity-60">{id}</span>
                          </span>
                        ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {results.length > 0 && (
            <div className="mt-4">
              <PaginationControls
                onFirst={() => doSearch(0)}
                onPrev={() => doSearch(offset - PAGE_LIMIT)}
                onNext={() => doSearch(offset + PAGE_LIMIT)}
                disabledPrev={offset === 0}
                disabledNext={!hasMore}
                label={`${t("common.pageOf", { page, count: results.length })}${hasMore ? "+" : ""}`}
                total={results.length}
              />
            </div>
          )}
        </div>
      )}
    </div>
    )}
    </>
  );
}

