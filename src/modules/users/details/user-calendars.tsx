import { useCallback, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { createUserCalendar, getUserCalendars } from "../api-client";
import { CreateUserCalendarPayload, GetUserCalendarsResponseType, UserCalendar } from "../types";
import { useToast } from "@/hooks/use-toast";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  username: string;
}

type CalendarCategory = "owner" | "delegated" | "subscription" | "resource";

const CATEGORY_ORDER: CalendarCategory[] = ["owner", "delegated", "subscription", "resource"];

const EMPTY_CREATE: CreateUserCalendarPayload = {
  "dav:name": "",
  "apple:color": "",
  "caldav:description": "",
};

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
  const { toast } = useToast();
  const canView = useIsAllowed("GET", "/users/{username}/calendars");
  const canCreate = useIsAllowed("POST", "/users/{username}/calendars");

  const fetchCalendars = useCallback(() => getUserCalendars(username), [username]);
  const { data, isLoading, error, refresh } = useFetchData<GetUserCalendarsResponseType>(
    canView ? fetchCalendars : null
  );

  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserCalendarPayload>({ ...EMPTY_CREATE });
  const [creating, setCreating] = useState(false);

  if (!canView) return null;

  const calendars = data?._embedded?.["dav:calendar"] ?? [];
  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: calendars.filter((c) => categorize(c) === category),
  })).filter((group) => group.items.length > 0 || (group.category === "owner" && canCreate));

  const handleCreate = async () => {
    const name = createForm["dav:name"].trim();
    if (!name) return;
    setCreating(true);
    try {
      const payload: CreateUserCalendarPayload = { "dav:name": name };
      if (createForm["apple:color"]?.trim()) payload["apple:color"] = createForm["apple:color"]!.trim();
      if (createForm["caldav:description"]?.trim()) payload["caldav:description"] = createForm["caldav:description"]!.trim();
      await createUserCalendar(username, payload);
      toast({ title: t("users.calendars.created") });
      setCreateForm({ ...EMPTY_CREATE });
      setShowCreate(false);
      await refresh();
    } catch (err) {
      toast({ title: t("users.calendars.errorCreate"), description: <ErrorDisplayer error={err} /> });
    } finally {
      setCreating(false);
    }
  };

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

          {data && calendars.length === 0 && !canCreate && (
            <p className="text-sm text-gray-500">{t("users.calendars.empty")}</p>
          )}

          {grouped.map((group) => (
            <div key={group.category}>
              <div className="flex items-center gap-2 mb-2">
                <h5 className="text-sm font-semibold text-gray-600">
                  {t(`users.calendars.categories.${group.category}`)}
                  <span className="ml-1 font-normal text-gray-400">({group.items.length})</span>
                </h5>
                {group.category === "owner" && canCreate && (
                  <button
                    onClick={() => setShowCreate(true)}
                    className="p-1 rounded-md hover:bg-gray-200 transition"
                    title={t("users.calendars.createTitle")}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="space-y-1">
                {group.items.map((calendar) => (
                  <CalendarRow key={calendarId(calendar)} calendar={calendar} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      <Dialog open={showCreate} onOpenChange={(v) => { if (!v) { setShowCreate(false); setCreateForm({ ...EMPTY_CREATE }); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("users.calendars.createTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">{t("users.calendars.name")} *</label>
              <input
                type="text"
                value={createForm["dav:name"]}
                onChange={(e) => setCreateForm((f) => ({ ...f, "dav:name": e.target.value }))}
                className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t("users.calendars.color")}</label>
              <div className="flex gap-2 mt-1 items-center">
                <input
                  type="color"
                  value={createForm["apple:color"]?.trim() || "#007fd8"}
                  onChange={(e) => setCreateForm((f) => ({ ...f, "apple:color": e.target.value }))}
                  className="h-9 w-12 cursor-pointer border rounded-md"
                />
                <input
                  type="text"
                  value={createForm["apple:color"] ?? ""}
                  onChange={(e) => setCreateForm((f) => ({ ...f, "apple:color": e.target.value }))}
                  placeholder="#007fd8"
                  className="flex-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">{t("users.calendars.description")}</label>
              <input
                type="text"
                value={createForm["caldav:description"] ?? ""}
                onChange={(e) => setCreateForm((f) => ({ ...f, "caldav:description": e.target.value }))}
                className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => { setShowCreate(false); setCreateForm({ ...EMPTY_CREATE }); }}>
                {t("common.cancel")}
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={creating || !createForm["dav:name"].trim()}
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                {t("common.create")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
