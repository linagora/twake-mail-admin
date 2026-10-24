import { Link } from "react-router";
import { MoveHorizontal, RefreshCw, Trash2 } from "lucide-react";
import { GetMailRepositoriesResponseType, MailRepository } from "./types";
import {
  clearMailRepository,
  getMailRepositories,
  getRepositoryInfo,
  moveAllMails,
  reprocessMailRepository,
} from "./api-client";
import { useFetchData } from "@/hooks/use-fetch-data";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useConfirm } from "@/hooks/use-confirm";
import { useToast } from "@/hooks/use-toast";
import { useTaskCreatedToast } from "@/hooks/use-task-created-toast";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import ConfirmTaskContent from "../common-tasks/components/confirm-task-content";
import { useTranslation } from "react-i18next";
import CreateMailRepositoryButton from "./create-mail-repository-button";
import ErrorDisplayer from "@/components/custom/error-displayer";
import ListToolbar from "@/components/custom/list-toolbar";
import { cn } from "@/lib/utils";
import { taskTypeLabel } from "@/modules/tasks/task-summary";

/**
 * What a standard repository holds, keyed by the last segment of its path (address-error,
 * spam, virus...); an unknown repository gets no description.
 */
const describeKey = (repository: string) => `mailRepositories.describe.${repository.split("/").pop()}`;

// The repositories holding mails first, as they are the ones to look at, then by path
const byPriority = (a: { repository: string; size: number }, b: { repository: string; size: number }) =>
  b.size - a.size || a.repository.localeCompare(b.repository);

export default function MailRepositoriesList() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { toast } = useToast();
  const toastTaskCreated = useTaskCreatedToast();
  const moveTargetId = useId();
  const canCreate = useIsAllowed("PUT", "/mailRepositories/{encodedPath}");
  const canReprocess = useIsAllowed("PATCH", "/mailRepositories/{encodedPath}/mails");
  const canMove = useIsAllowed("PATCH", "/mailRepositories/{encodedPath}/mails");
  const canClear = useIsAllowed("DELETE", "/mailRepositories/{encodedPath}/mails");
  const {
    data: mailRepositoriesResult,
    isLoading,
    refresh,
  } = useFetchData<GetMailRepositoriesResponseType>(getMailRepositories);

  const [repositoriesWithSize, setRepositoriesWithSize] = useState<
    (MailRepository & { size: number })[]
  >([]);
  const [search, setSearch] = useState("");
  const [, setIsLoadingInfo] = useState<boolean>(false);
  const [, setErrorInfo] = useState<string | null>(null);

  const fetchRepositoryInfo = useCallback(async () => {
    if (!mailRepositoriesResult) return;

    setIsLoadingInfo(true);
    const updatedRepositories = await Promise.all(
      mailRepositoriesResult.map(async (repository) => {
        try {
          const repoInfo = await getRepositoryInfo(repository.path);
          return { ...repository, size: repoInfo.size };
        } catch {
          setErrorInfo(`Failed to fetch info for ${repository.repository}`);
          return { ...repository, size: 0 }; // Handle the error case, e.g., set size to 0 or keep existing data
        }
      })
    );
    setRepositoriesWithSize(updatedRepositories);
    setIsLoadingInfo(false);
  }, [mailRepositoriesResult]);

  // Trigger the fetch when mailRepositoriesResult is available
  useEffect(() => {
    if (mailRepositoriesResult) {
      fetchRepositoryInfo();
    }
  }, [mailRepositoriesResult, fetchRepositoryInfo]);

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return repositoriesWithSize
      .filter((r) => r.repository.toLowerCase().includes(needle))
      .sort(byPriority);
  }, [repositoriesWithSize, search]);

  // A refused task (e.g. WebAdmin answering 400) is reported instead of escaping as an unhandled rejection.
  const runTask = async (startTask: () => Promise<{ taskId: string }>, name: string) => {
    try {
      toastTaskCreated((await startTask()).taskId, undefined, name);
    } catch (err) {
      toast({
        title: t("mailRepositories.runTaskError"),
        description: <ErrorDisplayer error={err} />,
        variant: "destructive",
      });
    }
  };

  const handleReprocessTask = async ({ path, repository }: MailRepository) => {
    const params = [
      { key: "queue", defaultValue: "spool", type: "input" as const }, // Target mail queue
      { key: "processor", defaultValue: "root", type: "input" as const }, // Override state of reprocessing mails
      { key: "consume", defaultValue: true, type: "checkbox" as const }, // Non-destructive reprocessing option
      { key: "limit", defaultValue: "", type: "input" as const }, // Limit count of elements
      { key: "maxRetries", defaultValue: "", type: "input" as const }, // Limit retries
    ];
    const paramValues: { [key: string]: string } = {};
    const command = `curl -XPATCH /mailRepositories/${path}/mails?action=reprocess`;
    await confirm({
      header: t("mailRepositories.reprocessAll"),
      message: (
        <ConfirmTaskContent
          message={<p>{t("mailRepositories.reprocessRepoConfirm", { path: repository })}</p>}
          command={command}
          params={params}
          getParamValues={(key, value) => {
            paramValues[key] =
              typeof value === "boolean" ? value.toString() : value;
          }}
        />
      ),
      action: async () => { toastTaskCreated((await reprocessMailRepository(path, paramValues)).taskId, undefined, taskTypeLabel(t, "reprocessing-all")); },
    });
  };
  const handleMoveAll = async (source: MailRepository) => {
    const otherRepos = repositoriesWithSize.filter((r) => r.path !== source.path);
    if (otherRepos.length === 0) {
      toast({ title: t("mailRepositories.noOtherRepositories") });
      return;
    }
    let targetRepo: MailRepository = otherRepos[0];
    const result = await confirm({
      header: t("mailRepositories.moveTitle"),
      message: (
        <div className="space-y-2 py-2">
          <label htmlFor={moveTargetId} className="block text-sm">
            {t("mailRepositories.moveConfirm", { sourcePath: source.repository })}
          </label>
          <select
            id={moveTargetId}
            className="w-full border rounded px-3 py-1.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            defaultValue={otherRepos[0].path}
            onChange={(e) => {
              targetRepo = otherRepos.find((r) => r.path === e.target.value) ?? targetRepo;
            }}
          >
            {otherRepos.map((r) => (
              <option key={r.path} value={r.path}>
                {r.repository}
              </option>
            ))}
          </select>
        </div>
      ),
    });
    if (!result) return;
    try {
      await moveAllMails(source, targetRepo);
      toast({ title: t("mailRepositories.moveDone") });
      refresh();
    } catch (err) {
      toast({
        title: t("mailRepositories.errorMoving"),
        description: <ErrorDisplayer error={err} />,
        variant: "destructive",
      });
    }
  };

  const handleClearTask = async ({ path, repository, size }: MailRepository & { size: number }) => {
    const result = await confirm({
      header: t("mailRepositories.clearAll"),
      destructive: true,
      confirmLabel: t("confirm.clear"),
      consequence: t("confirm.consequence.clearRepository", { count: size, path: repository }),
      message: t("mailRepositories.clearConfirm", { path: repository }),
    });
    if (!result) {
      return;
    }
    await runTask(() => clearMailRepository(path), t("mailRepositories.clearAll"));
  };
  return (
    <>
      <div>
        <ListToolbar search={search} onSearch={setSearch} placeholder={t("mailRepositories.filterPlaceholder")}>
          {canCreate && <CreateMailRepositoryButton onCreated={refresh} />}
        </ListToolbar>
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
          </div>
        )}
        <div>
          {shown.map((result) => (
            <div
              key={result.repository}
              className="space-y-1 p-4 bg-white rounded-2 my-4 p-4 flex justify-between items-center gap-2 transition-colors hover:bg-gray-50"
            >
              <div className="min-w-0">
                <h4 className="text-sm font-medium leading-none break-all flex flex-wrap items-center gap-2">
                  <Link
                    to={`/mail-repositories/repository/${result.path}?page=1&size=${result.size}`}
                    className="text-blue-600 hover:underline"
                  >
                    {result.repository}
                  </Link>
                  <span
                    className={cn(
                      "inline-block text-xs font-medium rounded-full px-2 py-0.5",
                      result.size > 0 ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"
                    )}
                    aria-label={t("mailRepositories.mailCount", { count: result.size })}
                  >
                    {result.size}
                  </span>
                </h4>
                {t(describeKey(result.repository), { defaultValue: "" }) && (
                  <p className="text-sm text-gray-500 mt-1">{t(describeKey(result.repository))}</p>
                )}
              </div>

              <div className="flex gap-2">
                {canReprocess && (
                  <button
                    className="p-2 rounded-md hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    // Nothing to reprocess, move or clear in an empty repository
                    disabled={result.size === 0}
                    title={result.size === 0 ? t("mailRepositories.emptyActionDisabled") : t("mailRepositories.reprocessAll")}
                    aria-label={t("mailRepositories.reprocessAll")}
                    onClick={() => {
                      handleReprocessTask(result);
                    }}
                  >
                    <RefreshCw className="w-5 h-5 text-blue-600" />
                  </button>
                )}

                {canMove && (
                  <button
                    className="p-2 rounded-md hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    // Nothing to reprocess, move or clear in an empty repository
                    disabled={result.size === 0}
                    title={result.size === 0 ? t("mailRepositories.emptyActionDisabled") : t("mailRepositories.moveAll")}
                    aria-label={t("mailRepositories.moveAll")}
                    onClick={() => {
                      handleMoveAll(result);
                    }}
                  >
                    <MoveHorizontal className="w-5 h-5 text-orange-500" />
                  </button>
                )}

                {canClear && (
                  <button
                    className="p-2 rounded-md hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    // Nothing to reprocess, move or clear in an empty repository
                    disabled={result.size === 0}
                    title={result.size === 0 ? t("mailRepositories.emptyActionDisabled") : t("mailRepositories.clearAll")}
                    aria-label={t("mailRepositories.clearAll")}
                    onClick={() => {
                      handleClearTask(result);
                    }}
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
