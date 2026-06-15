import { useCallback, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getUserCalendars } from "../api-client";
import { GetUserCalendarsResponseType, UserCalendar } from "../types";

interface Props {
  username: string;
}

type CalendarCategory = "owner" | "delegated" | "subscription" | "resource";

const CATEGORY_ORDER: CalendarCategory[] = ["owner", "delegated", "subscription", "resource"];

function categorize(calendar: UserCalendar): CalendarCategory {
  if (calendar["calendarserver:delegatedsource"]) return "delegated";

  const source = calendar["calendarserver:source"];
  if (source) {
    const principals = [
      ...(source.invite ?? []).map((i) => i.principal),
      ...(source.acl ?? []).map((a) => a.principal),
    ];
    if (principals.some((p) => p?.startsWith("principals/resources/"))) return "resource";
    return "subscription";
  }

  return "owner";
}

function calendarId(calendar: UserCalendar): string {
  const href = calendar._links?.self?.href ?? "";
  const last = href.split("/").pop() ?? "";
  return last.replace(/\.json$/, "") || href;
}

function CalendarRow({ calendar }: { calendar: UserCalendar }) {
  const name = calendar["dav:name"];
  const color = calendar["apple:color"];
  const description = calendar["caldav:description"];

  return (
    <div className="flex items-start gap-3 py-1">
      <span
        className="inline-block w-4 h-4 rounded-full border border-gray-200 flex-shrink-0 mt-0.5"
        style={{ backgroundColor: color || "#cccccc" }}
        title={color}
      />
      <div className="min-w-0">
        <p className="font-medium">{name}</p>
        {description && (
          <p className="text-xs text-gray-400">{description}</p>
        )}
      </div>
    </div>
  );
}

export default function UserCalendars({ username }: Props) {
  const { t } = useTranslation();
  const canView = useIsAllowed("GET", "/users/{username}/calendars");

  const fetchCalendars = useCallback(() => getUserCalendars(username), [username]);
  const { data, isLoading, error } = useFetchData<GetUserCalendarsResponseType>(
    canView ? fetchCalendars : null
  );

  const [open, setOpen] = useState(false);

  if (!canView) return null;

  const calendars = data?._embedded?.["dav:calendar"] ?? [];
  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: calendars.filter((c) => categorize(c) === category),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-md font-semibold hover:text-blue-600 transition"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {t("users.calendars.title")}
        {data && (
          <span className="text-sm font-normal text-gray-500">({calendars.length})</span>
        )}
      </button>

      {open && (
        <div className="mt-2 space-y-4">
          {isLoading && (
            <div className="h-[40px] rounded-2 animate-pulse bg-gray-200" />
          )}
          {error && <p className="text-red-500">Error: {error}</p>}

          {data && calendars.length === 0 && (
            <p className="text-sm text-gray-500">{t("users.calendars.empty")}</p>
          )}

          {grouped.map((group) => (
            <div key={group.category}>
              <h5 className="text-sm font-semibold text-gray-600 mb-2">
                {t(`users.calendars.categories.${group.category}`)}
                <span className="ml-1 font-normal text-gray-400">({group.items.length})</span>
              </h5>
              <div className="space-y-1">
                {group.items.map((calendar) => (
                  <CalendarRow key={calendarId(calendar)} calendar={calendar} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
