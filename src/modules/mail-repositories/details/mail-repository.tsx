import { useParams, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import i18n from "i18next";
import { useJsonDialog } from "@/components/custom/json-dialog";
import { useFetchData } from "@/hooks/use-fetch-data";
import {
  downloadMailFromRepository,
  getMailRepositories,
  getMailsInRepository,
  moveSingleMail,
  removeSingleMailFromRepository,
  reprocessSingleMail,
} from "../api-client";
import { GetMailRepositoriesResponseType, MailKeysResponseType, MailRepository } from "../types";
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/apiClient";
import { toast, useToast } from "@/hooks/use-toast";
import { useTaskCreatedToast } from "@/hooks/use-task-created-toast";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { MoveHorizontal, Trash2, RefreshCw } from "lucide-react";
import { useConfirm } from "@/hooks/use-confirm";
import ConfirmTaskContent from "@/modules/common-tasks/components/confirm-task-content";
import MailFiltersPanel, { MailFilters } from "./mail-filters-panel";
import { BASIC_PAGE_LIMIT, extendedPageOf } from "./page-limits";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useTranslation } from "react-i18next";
import Header from "@/components/custom/header";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import EmptyState from "@/components/custom/empty-state";
import { PaginationControls } from "@/components/custom/pagination-controls";
import { taskTypeLabel } from "@/modules/tasks/task-summary";

// Define the types for the expected responses
interface JsonMailResponse {
  name: string;
  sender: string;
  recipients: string[];
  state: string;
  error: string;
  remoteHost: string;
  remoteAddr: string;
  lastUpdated: string | null;
}

const toastFetchMailError = (error: unknown): void => {
  toast({
    title: i18n.t("mailRepositories.fetchMailError"),
    description: <ErrorDisplayer error={error} />,
  });
};

const showMailJson = async (
  repo: string,
  mailKey: string,
  showJson: (json: JsonMailResponse) => void
): Promise<void> => {
  try {
    const response = await apiClient.get<unknown, JsonMailResponse>(
      `/mailRepositories/${encodeURIComponent(repo)}/mails/${mailKey}`,
      { headers: { Accept: "application/json" }, responseType: "json" }
    );
    showJson(response);
  } catch (error) {
    toastFetchMailError(error);
  }
};

const downloadMail = (repo: string, mailKey: string): Promise<void> =>
  downloadMailFromRepository(encodeURIComponent(repo), mailKey).catch(toastFetchMailError);

export default function MailRepositoryDetail() {
  const { t } = useTranslation();
  const jsonDialog = useJsonDialog();
  const { toast } = useToast();
  const toastTaskCreated = useTaskCreatedToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { id } = useParams();
  const breadcrumbs = useBreadcrumbs();
  const confirm = useConfirm();
  const canViewMail = useIsAllowed("GET", "/mailRepositories/{encodedPath}/mails/{mailKey}");
  const canPatchMail = useIsAllowed("PATCH", "/mailRepositories/{encodedPath}/mails/{mailKey}");
  const canDeleteMail = useIsAllowed("DELETE", "/mailRepositories/{encodedPath}/mails/{mailKey}");

  const [allRepos, setAllRepos] = useState<GetMailRepositoriesResponseType>([]);
  useEffect(() => {
    getMailRepositories().then(setAllRepos).catch(() => {});
  }, []);

  const page = Number(searchParams.get("page")) || 1;
  const size = Number(searchParams.get("size")) || 0;
  const limit = BASIC_PAGE_LIMIT;
  const offset = (page - 1) * limit;
  const totalPages = Math.max(1, Math.ceil(size / limit));
  // check if we reached the end of the list
  const hasMore = offset + limit < size;

  const activeFilters: MailFilters = {
    sender: searchParams.get("sender") || "",
    recipient: searchParams.get("recipient") || "",
    updatedBefore: searchParams.get("updatedBefore") || "",
    updatedAfter: searchParams.get("updatedAfter") || "",
    remoteAddress: searchParams.get("remoteAddress") || "",
    remoteHost: searchParams.get("remoteHost") || "",
  };

  const fetchMails = useCallback(
    () =>
      getMailsInRepository(encodeURIComponent(id!), {
        limit,
        offset,
        sender: activeFilters.sender || undefined,
        recipient: activeFilters.recipient || undefined,
        updatedBefore: activeFilters.updatedBefore || undefined,
        updatedAfter: activeFilters.updatedAfter || undefined,
        remoteAddress: activeFilters.remoteAddress || undefined,
        remoteHost: activeFilters.remoteHost || undefined,
      }),
    [
      id,
      limit,
      offset,
      activeFilters.sender,
      activeFilters.recipient,
      activeFilters.updatedBefore,
      activeFilters.updatedAfter,
      activeFilters.remoteAddress,
      activeFilters.remoteHost,
    ]
  );

  const {
    data: mailKeys,
    isLoading,
    error,
    refresh,
  } = useFetchData<MailKeysResponseType>(fetchMails);

  const buildParams = (overrides: Record<string, string> = {}): Record<string, string> => {
    const params: Record<string, string> = { page: page.toString(), size: size.toString(), ...overrides };
    if (activeFilters.sender) params.sender = activeFilters.sender;
    if (activeFilters.recipient) params.recipient = activeFilters.recipient;
    if (activeFilters.updatedBefore) params.updatedBefore = activeFilters.updatedBefore;
    if (activeFilters.updatedAfter) params.updatedAfter = activeFilters.updatedAfter;
    if (activeFilters.remoteAddress) params.remoteAddress = activeFilters.remoteAddress;
    if (activeFilters.remoteHost) params.remoteHost = activeFilters.remoteHost;
    return params;
  };

  // Handle pagination navigation
  const goToPage = (newPage: number) => {
    if (newPage < 1) return;
    setSearchParams(buildParams({ page: newPage.toString() }));
  };

  const handleApplyFilters = (newFilters: MailFilters) => {
    const params: Record<string, string> = { page: "1", size: size.toString() };
    if (newFilters.sender) params.sender = newFilters.sender;
    if (newFilters.recipient) params.recipient = newFilters.recipient;
    if (newFilters.updatedBefore) params.updatedBefore = newFilters.updatedBefore;
    if (newFilters.updatedAfter) params.updatedAfter = newFilters.updatedAfter;
    if (newFilters.remoteAddress) params.remoteAddress = newFilters.remoteAddress;
    if (newFilters.remoteHost) params.remoteHost = newFilters.remoteHost;
    setSearchParams(params);
  };

  const handleReprocessMail = async (mailKey: string) => {
    if (!id) return;
    const params = [
      { key: "queue", defaultValue: "spool", type: "input" as const },
      { key: "processor", defaultValue: "", type: "input" as const },
    ];
    const paramValues: { [key: string]: string } = {};
    await confirm({
      header: t("mailRepositories.reprocessMailHeader"),
      message: (
        <ConfirmTaskContent
          message={<p>{t("mailRepositories.reprocessMailConfirm", { mailKey })}</p>}
          command={`curl -XPATCH '/mailRepositories/${encodeURIComponent(id)}/mails/${mailKey}?action=reprocess'`}
          params={params}
          getParamValues={(key, value) => {
            paramValues[key] = typeof value === "boolean" ? value.toString() : value;
          }}
        />
      ),
      action: async () => {
        const { taskId } = await reprocessSingleMail(encodeURIComponent(id), mailKey, {
          queue: paramValues["queue"] || undefined,
          processor: paramValues["processor"] || undefined,
        });
        toastTaskCreated(taskId, t("mailRepositories.reprocessScheduled"), taskTypeLabel(t, "reprocessing-one"));
      },
    });
  };

  const handleRemoveMail = async (mailKey: string) => {
    try {
      const result = await confirm({
        header: t("mailRepositories.removeMailHeader"),
        destructive: true,
        confirmLabel: t("common.remove"),
        message: t("mailRepositories.removeMailConfirm", { mailKey, id }),
      });
      if (!result || !id) {
        return;
      }
      await removeSingleMailFromRepository(encodeURIComponent(id), mailKey);
      toast({
        title: t("mailRepositories.removeMailSuccess"),
      });
      await refresh();
    } catch (error) {
      toast({
        title: t("mailRepositories.errorRemovingMail"),
        description: <ErrorDisplayer error={error} />,
      });
    }
  };

  const handleMoveMail = async (mailKey: string) => {
    const otherRepos = allRepos.filter((r) => r.repository !== id);
    if (otherRepos.length === 0) {
      toast({ title: t("mailRepositories.noOtherRepositoriesForMail") });
      return;
    }
    let targetRepo: MailRepository = otherRepos[0];
    const confirmed = await confirm({
      header: t("mailRepositories.moveMailHeader"),
      message: (
        <div className="space-y-2 py-2">
          <p className="text-sm">
            {t("mailRepositories.moveMailConfirm", { mailKey })}
          </p>
          <select
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
    if (!confirmed || !id) return;
    try {
      await moveSingleMail(encodeURIComponent(id), mailKey, targetRepo);
      toast({ title: t("mailRepositories.mailMovedSuccess") });
      await refresh();
    } catch (err) {
      toast({
        title: t("mailRepositories.errorMovingMail"),
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  const extendedHref = (() => {
    const p = new URLSearchParams(buildParams({ page: extendedPageOf(page).toString() }));
    return `/mail-repositories/repository/${encodeURIComponent(id!)}/extended?${p.toString()}`;
  })();

  return (
    <>
    <Header headerTitle={id} headerSubTitle={t("mailRepositories.detailKind")} breadcrumb={breadcrumbs.mailRepositories()} />
    {jsonDialog.dialog}
    <div className="mt-4 p-4 bg-white rounded-2">
      <div className="flex items-center justify-end mb-4">
        <a
          href={extendedHref}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition text-sm"
        >
          {t("mailRepositories.extendedView")}
        </a>
      </div>

      <MailFiltersPanel filters={activeFilters} onApply={handleApplyFilters} />

      {isLoading && <p>{t("mailRepositories.loadingMails")}</p>}
      {error && <p className="text-red-500">{t("common.errorPrefix", { message: error })}</p>}
      <PaginationControls
        onFirst={() => goToPage(1)}
        onPrev={() => goToPage(page - 1)}
        onNext={() => goToPage(page + 1)}
        onLast={() => goToPage(Math.ceil(size / limit))}
        disabledPrev={page <= 1}
        disabledNext={!hasMore}
        label={t("common.page", { page, totalPages, total: size })}
        total={size}
      />
      {!isLoading && mailKeys?.length === 0 && <EmptyState title={t("mailRepositories.noMails")} />}
      {mailKeys && mailKeys.length > 0 && (
        <div className="mt-8">
          <ul>
            {mailKeys.map((mailKey, index) => (
              <li
                key={mailKey}
                className="flex justify-between items-center border-b pb-1"
              >
                <span className="font-medium text-gray-800">
                  <span className="text-md text-gray-500 mr-2">
                    {index + offset + 1} /
                  </span>
                  <span
                    className="text-lg font-semibold cursor-pointer"
                    onDoubleClick={() => {
                      navigator.clipboard
                        .writeText(mailKey)
                        .then(() => {
                          toast({
                            title: t("mailRepositories.copiedToClipboard"),
                            description: `${mailKey}`,
                          });
                        })
                        .catch((err) => {
                          console.error("Failed to copy text: ", err);
                        });
                    }}
                  >
                    {mailKey}
                  </span>
                </span>

                <span className="flex items-center space-x-2 text-sm text-gray-500">
                  {canViewMail && (
                    <Button
                      variant="link"
                      className="px-1 h-auto"
                      onClick={() => showMailJson(id!, mailKey, (json) => jsonDialog.show(mailKey, json))}
                    >
                      {t("common.viewJson")}
                    </Button>
                  )}
                  {canViewMail && (
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        downloadMail(id!, mailKey);
                      }}
                      className="hover:text-blue-500 hover:underline transition"
                    >
                      (MIME)
                    </a>
                  )}
                  {canPatchMail && (
                    <button
                      className="p-2 rounded-md hover:bg-gray-200"
                      onClick={() => handleReprocessMail(mailKey)}
                      title={t("mailRepositories.reprocessMailTooltip")}
                    >
                      <RefreshCw className="w-5 h-5 text-green-600" />
                    </button>
                  )}
                  {canPatchMail && (
                    <button
                      className="p-2 rounded-md hover:bg-gray-200"
                      onClick={() => handleMoveMail(mailKey)}
                      title={t("mailRepositories.moveMailTooltip")}
                    >
                      <MoveHorizontal className="w-5 h-5 text-orange-500" />
                    </button>
                  )}
                  {canDeleteMail && (
                    <button
                      className="p-2 rounded-md hover:bg-gray-200"
                      onClick={() => handleRemoveMail(mailKey)}
                      title={t("mailRepositories.deleteMailTooltip")}
                    >
                      <Trash2 className="w-5 h-5 text-red-600" />
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
    </>
  );
}
