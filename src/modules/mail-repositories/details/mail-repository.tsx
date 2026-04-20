import { useParams, useSearchParams } from "react-router";
import { useFetchData } from "@/hooks/use-fetch-data";
import {
  getMailRepositories,
  getMailsInRepository,
  moveSingleMail,
  removeSingleMailFromRepository,
  reprocessSingleMail,
} from "../api-client";
import { GetMailRepositoriesResponseType, MailKeysResponseType } from "../types";
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/apiClient";
import { toast, useToast } from "@/hooks/use-toast";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { MoveHorizontal, Trash2, RefreshCw } from "lucide-react";
import { useConfirm } from "@/hooks/use-confirm";
import ConfirmTaskContent from "@/modules/common-tasks/components/confirm-task-content";
import MailFiltersPanel, { MailFilters } from "./mail-filters-panel";
import { useIsAllowed } from "@/lib/proxy-resolver-context";

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

type MailResponse = JsonMailResponse | Blob;

const fetchMailData = async (
  repo: string,
  mailKey: string,
  acceptType: "application/json" | "message/rfc822"
): Promise<void> => {
  const repositoryPath = encodeURIComponent(repo);
  const endpoint = `/mailRepositories/${repositoryPath}/mails/${mailKey}`;

  try {
    const response = (await apiClient.get<MailResponse>(endpoint, {
      headers: { Accept: acceptType },
      responseType: acceptType === "message/rfc822" ? "blob" : "json",
    })) as any;

    if (acceptType === "application/json") {
      const jsonWindow = window.open("", "_blank");
      if (jsonWindow) {
        jsonWindow.document.write(
          "<pre>" + JSON.stringify(response, null, 2) + "</pre>"
        );
        jsonWindow.document.close();
      }
    } else if (acceptType === "message/rfc822") {
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${mailKey}.eml`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  } catch (error) {
    toast({
      title: "Error fetching failed event JSON",
      description: <ErrorDisplayer error={error} />,
    });
  }
};

export default function MailRepositoryDetail() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { id } = useParams();
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
  const limit = Number(import.meta.env.VITE_PAGE_LIMIT) || 200;
  const offset = (page - 1) * limit;
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
    const params = [
      { key: "queue", defaultValue: "spool", type: "input" as const },
      { key: "processor", defaultValue: "", type: "input" as const },
    ];
    const paramValues: { [key: string]: string } = {};
    const confirmed = await confirm({
      header: "Reprocess Mail",
      message: (
        <ConfirmTaskContent
          message={<p>Reprocess mail <b>{mailKey}</b>?</p>}
          command={`curl -XPATCH 'http://ip:port/mailRepositories/{encodedPathOfTheRepository}/mails/${mailKey}?action=reprocess&'`}
          params={params}
          getParamValues={(key, value) => {
            paramValues[key] = typeof value === "boolean" ? value.toString() : value;
          }}
        />
      ),
    });
    if (!confirmed || !id) return;
    try {
      const { taskId } = await reprocessSingleMail(encodeURIComponent(id), mailKey, {
        queue: paramValues["queue"] || undefined,
        processor: paramValues["processor"] || undefined,
      });
      toast({
        title: "Reprocess scheduled",
        description: (
          <p>
            Task{" "}
            <a className="text-blue-500 hover:underline" href={`/task/${taskId}`}>
              {taskId}
            </a>
          </p>
        ),
      });
    } catch (error) {
      toast({
        title: "Error reprocessing mail",
        description: <ErrorDisplayer error={error} />,
      });
    }
  };

  const handleRemoveMail = async (mailKey: string) => {
    try {
      const result = await confirm({
        header: "Run Task",
        message: `Do you want to clear mail ${mailKey} in the mail repository: ${id}.`,
      });
      if (!result || !id) {
        return;
      }
      await removeSingleMailFromRepository(encodeURIComponent(id), mailKey);
      toast({
        title: "Remove Mail Successfully",
      });
      await refresh();
    } catch (error) {
      toast({
        title: "Error Removing Mail",
        description: <ErrorDisplayer error={error} />,
      });
    }
  };

  const handleMoveMail = async (mailKey: string) => {
    const otherRepos = allRepos.filter((r) => r.path !== id);
    if (otherRepos.length === 0) {
      toast({ title: "No other repositories available to move this mail to" });
      return;
    }
    let targetRepo = otherRepos[0].path;
    const confirmed = await confirm({
      header: "Move Mail",
      message: (
        <div className="space-y-2 py-2">
          <p className="text-sm">
            Move mail <b>{mailKey}</b> to:
          </p>
          <select
            className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            defaultValue={otherRepos[0].path}
            onChange={(e) => {
              targetRepo = e.target.value;
            }}
          >
            {otherRepos.map((r) => (
              <option key={r.path} value={r.path}>
                {r.repository} ({r.path})
              </option>
            ))}
          </select>
        </div>
      ),
    });
    if (!confirmed || !id) return;
    try {
      await moveSingleMail(encodeURIComponent(id), mailKey, targetRepo);
      toast({ title: "Mail moved successfully" });
      await refresh();
    } catch (err) {
      toast({
        title: "Error moving mail",
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  const extendedHref = (() => {
    const p = new URLSearchParams(buildParams({ page: page.toString() }));
    return `/mail-repositories/repository/${encodeURIComponent(id!)}/extended?${p.toString()}`;
  })();

  return (
    <div className="mt-4 p-4 bg-white rounded-2">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Mail Repository Details</h3>
          <p>Repository ID: {id}</p>
        </div>
        <a
          href={extendedHref}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition text-sm"
        >
          Extended View
        </a>
      </div>

      <MailFiltersPanel filters={activeFilters} onApply={handleApplyFilters} />

      {isLoading && <p>Loading mails...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}
      {/* Pagination UI */}
      <div className="mt-6 flex justify-between items-center">
        {/** first page */}
        <button
          onClick={() => goToPage(1)}
          disabled={page <= 1}
          className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          First
        </button>
        <button
          onClick={() => goToPage(page - 1)}
          disabled={page <= 1}
          className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span className="text-sm font-medium text-center">
          Page {page} / {limit} mails per page / Total: {size}
        </span>
        <button
          disabled={!hasMore}
          onClick={() => goToPage(page + 1)}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
        {/** last page */}
        <button
          disabled={!hasMore}
          onClick={() => goToPage(Math.ceil(size / limit))}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Last
        </button>
      </div>
      {mailKeys && (
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
                            title: "Mail key copied to clipboard!",
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
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        fetchMailData(id!, mailKey, "application/json");
                      }}
                      className="hover:text-blue-500 hover:underline transition"
                    >
                      (JSON)
                    </a>
                  )}
                  {canViewMail && (
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        fetchMailData(id!, mailKey, "message/rfc822");
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
                      title="Reprocess mail"
                    >
                      <RefreshCw className="w-5 h-5 text-green-600" />
                    </button>
                  )}
                  {canPatchMail && (
                    <button
                      className="p-2 rounded-md hover:bg-gray-200"
                      onClick={() => handleMoveMail(mailKey)}
                      title="Move mail to another repository"
                    >
                      <MoveHorizontal className="w-5 h-5 text-orange-500" />
                    </button>
                  )}
                  {canDeleteMail && (
                    <button
                      className="p-2 rounded-md hover:bg-gray-200"
                      onClick={() => handleRemoveMail(mailKey)}
                      title="Delete mail"
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
  );
}
