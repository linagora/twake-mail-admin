import { Link } from "react-router";
import { RefreshCw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ListenerGroupsResponseType } from "./types";
import {
  getMailboxListenerGroups,
  deleteAllEventsForGroup,
  redeliverGroupEvents,
  getFailedEvents, // Import the existing function
} from "./api-client";
import SearchByEventId from "./search-by-event-id";
import { useFetchData } from "@/hooks/use-fetch-data";
import { useState, useEffect } from "react";
import { useConfirm } from "@/hooks/use-confirm";
import { useToast } from "@/hooks/use-toast";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import ConfirmTaskContent from "../common-tasks/components/confirm-task-content";

const REDELIVER_PARAM_KEYS = ["limit", "maxRetries"] as const;
type RedeliverParamKey = (typeof REDELIVER_PARAM_KEYS)[number];

const POSITIVE_INTEGER = /^[1-9]\d*$/;

// WebAdmin only accepts positive integers: anything else is rejected before being sent.
const isEmptyOrPositiveInteger = (value?: string): boolean =>
  !value?.trim() || POSITIVE_INTEGER.test(value.trim());

const toOptionalNumber = (value?: string): number | undefined =>
  value?.trim() ? Number(value.trim()) : undefined;

export default function EventListenersList() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { toast } = useToast();
  const canRedeliver = useIsAllowed("POST", "/events/deadLetter/groups/{group}");
  const canDelete = useIsAllowed("DELETE", "/events/deadLetter/groups/{group}");
  const { data: listenerGroupsResult, isLoading } =
    useFetchData<ListenerGroupsResponseType>(getMailboxListenerGroups);

  const [eventCounts, setEventCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (listenerGroupsResult) {
      const fetchCounts = async () => {
        const counts = await Promise.all(
          listenerGroupsResult.map(async (group) => {
            try {
              const events = await getFailedEvents(group);
              return { [group]: events.length };
            } catch {
              return { [group]: 0 };
            }
          })
        );

        setEventCounts(Object.assign({}, ...counts));
      };

      fetchCounts();
    }
  }, [listenerGroupsResult]);

  const handleRedeliverGroup = async (path: string) => {
    const params = REDELIVER_PARAM_KEYS.map((key) => ({ key, defaultValue: "", type: "input" as const }));
    const paramValues: Partial<Record<RedeliverParamKey, string>> = {};
    const findInvalidParam = (): RedeliverParamKey | undefined =>
      REDELIVER_PARAM_KEYS.find((key) => !isEmptyOrPositiveInteger(paramValues[key]));
    const command = `curl -XPOST /events/deadLetter/groups/${encodeURIComponent(path)}?action=reDeliver`;
    await confirm({
      header: t("eventDeadletter.redeliverGroupAction"),
      message: (
        <ConfirmTaskContent
          message={<p>{t("eventDeadletter.redeliverGroup", { path })}</p>}
          command={command}
          params={params}
          getParamValues={(key, value) => {
            paramValues[key as RedeliverParamKey] =
              typeof value === "boolean" ? value.toString() : value;
          }}
        />
      ),
      validate: () => {
        const invalidParam = findInvalidParam();
        return invalidParam ? t("eventDeadletter.invalidPositiveInteger", { key: invalidParam }) : null;
      },
      action: async () => {
        const { taskId } = await redeliverGroupEvents(path, {
          limit: toOptionalNumber(paramValues.limit),
          maxRetries: toOptionalNumber(paramValues.maxRetries),
        });
        toast({
          title: t("eventDeadletter.runTaskSuccess"),
          description: (
            <p>
              <Link className="text-blue-500 hover:underline" to={`/task/${taskId}`}>
                {t("common.taskLink", { taskId })}
              </Link>
            </p>
          ),
        });
      },
    });
  };

  const handleClearGroup = async (path: string) => {
    const result = await confirm({
      header: t("eventDeadletter.clearGroupTitle"),
      message: t("eventDeadletter.clearGroup", { path }),
    });
    if (!result) return;

    await deleteAllEventsForGroup(path);
    toast({ title: t("eventDeadletter.clearSuccess") });

    setEventCounts((prev) => ({ ...prev, [path]: 0 }));
  };

  return (
    <>
      <div>
        <SearchByEventId />
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
          </div>
        )}

        <div>
          {listenerGroupsResult?.map((group) => (
            <div
              key={group}
              className="space-y-1 p-4 bg-white rounded-2 my-4 p-4 flex justify-between items-center gap-2"
            >
              <div className="min-w-0">
                <h4 className="text-sm font-medium leading-none break-all">
                  <Link to={`/event-dead-letter/group/${group}?page=1`}>
                    {group} ({eventCounts[group] ?? t("common.loading")})
                  </Link>
                </h4>
              </div>

              <div className="flex shrink-0 gap-2">
                {canRedeliver && (
                  <button
                    className="p-2 rounded-md hover:bg-gray-200"
                    aria-label={t("eventDeadletter.redeliverGroupAction")}
                    title={t("eventDeadletter.redeliverGroupAction")}
                    onClick={() => handleRedeliverGroup(group)}
                  >
                    <RefreshCw className="w-5 h-5 text-blue-600" />
                  </button>
                )}

                {canDelete && (
                  <button
                    className="p-2 rounded-md hover:bg-gray-200"
                    aria-label={t("eventDeadletter.clearGroupAction")}
                    title={t("eventDeadletter.clearGroupAction")}
                    onClick={() => handleClearGroup(group)}
                  >
                    <Trash2 className="w-5 h-5 text-red-600" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
