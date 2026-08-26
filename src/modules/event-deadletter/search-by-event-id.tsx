import { useState, FormEvent } from "react";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { searchDeadLetterEventByEventId } from "./api-client";
import { useToast } from "@/hooks/use-toast";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Link } from "react-router";

export default function SearchByEventId() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const canSearch = useIsAllowed("GET", "/events/deadLetter?eventId={eventId}");
  const canNarrowByGroup = useIsAllowed(
    "GET",
    "/events/deadLetter?eventId={eventId}&group={group}"
  );

  const [eventId, setEventId] = useState("");
  const [group, setGroup] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    group: string;
    insertionId: string;
    json: Record<string, unknown>;
  } | null>(null);

  if (!canSearch) return null;

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = eventId.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setResult(null);
    try {
      const found = await searchDeadLetterEventByEventId(
        trimmed,
        canNarrowByGroup ? group : undefined
      );
      setResult(found);
    } catch (error) {
      toast({
        title: t("eventDeadletter.searchError"),
        description: <ErrorDisplayer error={error} />,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="mt-4 p-4 bg-white rounded-2">
      <h3 className="text-lg font-semibold">
        {t("eventDeadletter.searchByEventIdTitle")}
      </h3>
      <p className="text-sm text-gray-500 mb-3">
        {t("eventDeadletter.searchByEventIdSubtitle")}
      </p>

      <form onSubmit={handleSearch} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            placeholder={t("eventDeadletter.searchByEventIdPlaceholder")}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          {canNarrowByGroup && (
            <input
              type="text"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              placeholder={t("eventDeadletter.searchByGroupPlaceholder")}
              className="w-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
          <button
            type="submit"
            disabled={isLoading || !eventId.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            {t("common.search")}
          </button>
        </div>
        {canNarrowByGroup && (
          <p className="text-xs text-gray-400">
            {t("eventDeadletter.searchByGroupHint")}
          </p>
        )}
      </form>

      {isLoading && <p className="mt-3">{t("common.loading")}</p>}

      {result && (
        <div className="mt-4 space-y-2">
          <div className="text-sm">
            <span className="font-medium">{t("eventDeadletter.groupLabel")}: </span>
            {result.group ? (
              <Link
                className="text-blue-500 hover:underline"
                to={`/event-dead-letter/group/${result.group}?&page=1&size=10`}
              >
                {result.group}
              </Link>
            ) : (
              <span className="text-gray-500">{t("common.notAvailable")}</span>
            )}
          </div>
          <div className="text-sm">
            <span className="font-medium">
              {t("eventDeadletter.insertionIdLabel")}:{" "}
            </span>
            {result.insertionId || (
              <span className="text-gray-500">
                {t("common.notAvailable")}
              </span>
            )}
          </div>
          <pre className="mt-2 p-3 bg-gray-50 rounded-md overflow-auto text-xs">
            {JSON.stringify(result.json, null, 2)}
          </pre>
        </div>
      )}
    </section>
  );
}
