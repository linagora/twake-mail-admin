import { useNavigate, useParams, useSearchParams } from "react-router";
import { useFetchData } from "@/hooks/use-fetch-data";
import { InsertionIdsResponseType } from "../types";
import { deleteAllEventsForGroup, deleteEvent, getEventDetails, getFailedEvents } from "../api-client";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { PaginationControls } from "@/components/custom/pagination-controls";
import { Copy, RefreshCw, Trash2 } from "lucide-react";
import { useConfirm } from "@/hooks/use-confirm";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { searchAndPaginate } from "@/lib/search-pagination";
import Header from "@/components/custom/header";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { Button } from "@/components/ui/button";
import CamelCaseName from "@/components/custom/camel-case-name";
import UserLink from "@/components/custom/user-link";
import { useJsonDialog } from "@/components/custom/json-dialog";
import { parseMailboxPath } from "@/lib/mailbox-path";
import { groupDisplayName } from "../group-name";
import { GroupClassName } from "../eventl-listeners-list";
import { useRedeliverGroup } from "../use-redeliver-group";

// Each listed event is fetched to be described: a page stays small
const PAGE_SIZE = 20;

/** What an event is about, read from its JSON: { "MessageContentDeletionEvent": { username, mailboxPath... } }. */
export function describeEvent(json: unknown): { type?: string; user?: string; mailbox?: string } {
  if (!json || typeof json !== "object") return {};
  const [type] = Object.keys(json);
  const body = (json as Record<string, unknown>)[type];
  if (!body || typeof body !== "object") return { type };
  const fields = body as Record<string, unknown>;
  const user = typeof fields.username === "string" ? fields.username : typeof fields.user === "string" ? fields.user : undefined;
  const path = typeof fields.mailboxPath === "string" ? fields.mailboxPath : undefined;
  const mailbox = path ? parseMailboxPath(path)?.mailbox ?? path : undefined;
  return { type, user, mailbox };
}

type Loaded = { status: "loading" } | { status: "loaded"; json: unknown } | { status: "failed" };

export default function EventListenersDetail() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { id } = useParams();
  const breadcrumbs = useBreadcrumbs();
  const confirm = useConfirm();
  const redeliverGroup = useRedeliverGroup();
  const jsonDialog = useJsonDialog();
  const canViewJson = useIsAllowed("GET", "/events/deadLetter/groups/{group}/{insertionId}");
  const canDelete = useIsAllowed("DELETE", "/events/deadLetter/groups/{group}/{insertionId}");
  const canRedeliver = useIsAllowed("POST", "/events/deadLetter/groups/{group}");
  const canClear = useIsAllowed("DELETE", "/events/deadLetter/groups/{group}");

  const requestedPage = Number(searchParams.get("page")) || 1;

  const fetchFailedEvents = useCallback(() => getFailedEvents(id!), [id]);

  const {
    data: failedEventKeys,
    isLoading,
    error,
    refresh,
  } = useFetchData<InsertionIdsResponseType>(fetchFailedEvents);

  // The API returns every insertion id of the group: the total is the size of
  // that list, and pagination happens client side.
  const total = failedEventKeys?.length ?? 0;
  const { paginated: pageEventKeys, page, totalPages, offset } =
    searchAndPaginate(failedEventKeys ?? [], "", requestedPage, (key) => [key], PAGE_SIZE);
  const hasMore = page < totalPages;

  // The events of the page, fetched in parallel to tell what each one is about
  const [events, setEvents] = useState<Record<string, Loaded>>({});
  const pageKey = pageEventKeys.join(",");
  useEffect(() => {
    if (!canViewJson || !id || !pageKey) return;
    let active = true;
    const keys = pageKey.split(",");
    keys.forEach((key) => {
      getEventDetails(id, key)
        .then((json) => { if (active) setEvents((current) => ({ ...current, [key]: { status: "loaded", json } })); })
        .catch(() => { if (active) setEvents((current) => ({ ...current, [key]: { status: "failed" } })); });
    });
    return () => { active = false; };
  }, [canViewJson, id, pageKey]);

  // Handle pagination navigation
  const goToPage = (newPage: number) => {
    if (newPage < 1) return;
    setSearchParams({ page: newPage.toString() });
  };

  const copyId = (insertionId: string) => {
    navigator.clipboard?.writeText(insertionId)
      .then(() => toast({ title: t("eventDeadletter.copiedToClipboard"), description: insertionId }))
      .catch(() => { /* the ID stays selectable */ });
  };

  const handleRemoveEvent = async (insertionId: string) => {
    try {
      const result = await confirm({
        header: t("eventDeadletter.deleteEventTitle"),
        destructive: true,
        confirmLabel: t("common.delete"),
        consequence: t("confirm.consequence.clearGroup"),
        message: t("eventDeadletter.deleteEventConfirm", { insertionId, group: id }),
      });
      if (!result || !id) {
        return;
      }
      await deleteEvent(id, insertionId);
      toast({ title: t("eventDeadletter.deleteEventSuccess") });
      await refresh();
    } catch (error) {
      toast({
        title: t("eventDeadletter.deleteEventError"),
        description: <ErrorDisplayer error={error} />,
      });
    }
  };

  const handleClearGroup = async () => {
    const result = await confirm({
      header: t("eventDeadletter.clearGroupTitle"),
      destructive: true,
      confirmLabel: t("common.delete"),
      consequence: t("confirm.consequence.clearGroup"),
      message: t("eventDeadletter.clearGroup", { path: id }),
    });
    if (!result) return;
    try {
      await deleteAllEventsForGroup(id!);
      toast({ title: t("eventDeadletter.clearSuccess") });
      navigate("/event-dead-letter");
    } catch (error) {
      toast({ title: t("eventDeadletter.clearError"), description: <ErrorDisplayer error={error} /> });
    }
  };

  const showJson = (insertionId: string, json: unknown) =>
    jsonDialog.show(describeEvent(json).type ?? insertionId, json);

  return (
    <>
    <Header
      headerTitle={<CamelCaseName name={groupDisplayName(id!)} />}
      documentTitle={groupDisplayName(id!)}
      headerSubTitle={<GroupClassName group={id!} />}
      breadcrumb={breadcrumbs.eventDeadLetter()}
    />
    {jsonDialog.dialog}
    <div className="mt-4 p-4 bg-white rounded-2">
      {(canRedeliver || canClear) && total > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {canRedeliver && (
            <Button variant="outline" onClick={() => redeliverGroup(id!)}>
              <RefreshCw className="w-4 h-4 text-blue-600" aria-hidden="true" />
              {t("eventDeadletter.redeliverAll")}
            </Button>
          )}
          {canClear && (
            <Button variant="outline" onClick={handleClearGroup} className="border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700">
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              {t("eventDeadletter.clearGroupAction")}
            </Button>
          )}
        </div>
      )}

      {isLoading && <p>{t("eventDeadletter.loadingEvents")}</p>}
      {error && <p className="text-red-500">{t("common.errorPrefix", { message: error })}</p>}
      <PaginationControls
        onFirst={() => goToPage(1)}
        onPrev={() => goToPage(page - 1)}
        onNext={() => goToPage(page + 1)}
        onLast={() => goToPage(totalPages)}
        disabledPrev={page <= 1}
        disabledNext={!hasMore}
        label={t("eventDeadletter.paginationInfo", { page, limit: PAGE_SIZE, total })}
        total={total}
      />
      {failedEventKeys && (
        <div className="mt-4">
          <ul>
            {pageEventKeys.map((failedEventKey, index) => {
              // An event not answered yet is loading, once it can be read
              const loaded: Loaded | undefined = events[failedEventKey] ?? (canViewJson ? { status: "loading" } : undefined);
              const described = loaded?.status === "loaded" ? describeEvent(loaded.json) : {};
              return (
                <li
                  key={failedEventKey}
                  className="flex justify-between items-center gap-2 border-b py-2"
                >
                  <span className="min-w-0 flex gap-2">
                    <span className="text-gray-500 shrink-0">{index + offset + 1} /</span>
                    <span className="min-w-0 flex flex-col gap-1">
                      {loaded?.status === "loading" && <span className="h-4 w-64 max-w-full rounded animate-pulse bg-gray-200" aria-hidden="true" />}
                      {loaded?.status === "failed" && <span className="text-sm text-red-600">{t("eventDeadletter.eventLoadFailed")}</span>}
                      {loaded?.status === "loaded" && (
                        <span className="text-sm font-medium text-gray-800 flex flex-wrap gap-x-2 break-all">
                          {described.type && <span>{described.type}</span>}
                          {described.user && <><span className="text-gray-400" aria-hidden="true">·</span><UserLink address={described.user} /></>}
                          {described.mailbox && <><span className="text-gray-400" aria-hidden="true">·</span><span>{described.mailbox}</span></>}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-xs text-gray-500 font-mono break-all">
                        {failedEventKey}
                        <button
                          type="button"
                          onClick={() => copyId(failedEventKey)}
                          className="shrink-0 p-0.5 rounded hover:bg-gray-200"
                          title={t("eventDeadletter.copyEventId")}
                          aria-label={t("eventDeadletter.copyEventId")}
                        >
                          <Copy className="w-3 h-3" aria-hidden="true" />
                        </button>
                      </span>
                    </span>
                  </span>

                  <span className="flex shrink-0 items-center gap-2 text-sm">
                    {canViewJson && loaded?.status === "loaded" && (
                      <Button variant="link" className="px-1" onClick={() => showJson(failedEventKey, loaded.json)}>
                        {t("common.viewJson")}
                      </Button>
                    )}
                    {canDelete && (
                      <button
                        className="p-2 rounded-md hover:bg-gray-200"
                        aria-label={t("eventDeadletter.deleteEventAction")}
                        title={t("eventDeadletter.deleteEventAction")}
                        onClick={() => handleRemoveEvent(failedEventKey)}
                      >
                        <Trash2 className="w-5 h-5 text-red-600" />
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
    </>
  );
}
