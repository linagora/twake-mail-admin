import { RefreshCw, Trash2 } from "lucide-react";
import { GetMailRepositoriesResponseType, MailRepository } from "./types";
import {
  clearMailRepository,
  getMailRepositories,
  getRepositoryInfo,
  reprocessMailRepository,
} from "./api-client";
import { useFetchData } from "@/hooks/use-fetch-data";
import { useCallback, useEffect, useState } from "react";
import { useConfirm } from "@/hooks/use-confirm";
import { useToast } from "@/hooks/use-toast";
import ConfirmTaskContent from "../common-tasks/components/confirm-task-content";
import { TaskParam } from "../common-tasks/types";

export default function MailRepositoriesList() {
  const confirm = useConfirm();
  const { toast } = useToast();
  const {
    data: mailRepositoriesResult,
    isLoading,
    error: _error,
  } = useFetchData<GetMailRepositoriesResponseType>(getMailRepositories);

  const [repositoriesWithSize, setRepositoriesWithSize] = useState<
    (MailRepository & { size: number })[]
  >([]);
  const [_isLoadingInfo, setIsLoadingInfo] = useState<boolean>(false);
  const [_errorInfo, setErrorInfo] = useState<string | null>(null);

  const fetchRepositoryInfo = useCallback(async () => {
    if (!mailRepositoriesResult) return;

    setIsLoadingInfo(true);
    const updatedRepositories = await Promise.all(
      mailRepositoriesResult.map(async (repository) => {
        try {
          const repoInfo = await getRepositoryInfo(repository.path);
          return { ...repository, size: repoInfo.size };
        } catch (error) {
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

  const handleReprocessTask = async (path: string) => {
    const params = [
      { key: "queue", defaultValue: "spool", type: "input" as const }, // Target mail queue
      { key: "processor", defaultValue: "root", type: "input" as const }, // Override state of reprocessing mails
      { key: "consume", defaultValue: true, type: "checkbox" as const }, // Non-destructive reprocessing option
      { key: "limit", defaultValue: "", type: "input" as const }, // Limit count of elements
      { key: "maxRetries", defaultValue: "", type: "input" as const }, // Limit retries
    ];
    const paramValues: { [key: string]: string } = {};
    const command =
      "curl -XPATCH http://ip:port/mailRepositories/{encodedPathOfTheRepository}/mails?action=reprocess&";
    const result = await confirm({
      header: "Run Task",
      message: (
        <ConfirmTaskContent
          message={<p>Do you want to run task <b>Reprocess Mail Repository</b>?</p>}
          command={command}
          params={params}
          getParamValues={(key, value) => {
            paramValues[key] =
              typeof value === "boolean" ? value.toString() : value;
          }}
        />
      ),
    });
    if (!result) {
      return;
    }
    const { taskId } = await reprocessMailRepository(path, paramValues);
    toast({
      title: "Run Task Successfully",
      description: (
        <p>
          Task{" "}
          <a className="text-blue-500 hover:underline" href={`/task/${taskId}`}>
            {taskId}
          </a>
        </p>
      ),
    });
  };
  const handleClearTask = async (path: string) => {
    const result = await confirm({
      header: "Run Task",
      message: `Do you want to clear the mail repository: ${path}.`,
    });
    if (!result) {
      return;
    }
    const { taskId } = await clearMailRepository(path);
    toast({
      title: "Run Task Successfully",
      description: (
        <p>
          Task{" "}
          <a className="text-blue-500 hover:underline" href={`/task/${taskId}`}>
            {taskId}
          </a>
        </p>
      ),
    });
  };
  return (
    <>
      <div>
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
          </div>
        )}
        <p>List</p>
        <div>
          {repositoriesWithSize?.map((result) => (
            <div
              key={result.repository}
              className="space-y-1 p-4 bg-white rounded-2 my-4 p-4 flex justify-between items-center"
            >
              <div>
                <h4 className="text-sm font-medium leading-none">
                  <a
                    href={`/mail-repositories/repository/${result.path}?&page=1&size=${result.size}`}
                  >
                    {result.repository} ({result.size})
                  </a>
                </h4>
                <p className="text-sm text-muted-foreground">{result.path}</p>
              </div>

              <div className="flex gap-2">
                <button
                  className="p-2 rounded-md hover:bg-gray-200"
                  onClick={() => {
                    handleReprocessTask(result.path);
                  }}
                >
                  <RefreshCw className="w-5 h-5 text-blue-600" />
                </button>

                <button
                  className="p-2 rounded-md hover:bg-gray-200"
                  onClick={() => {
                    handleClearTask(result.path);
                  }}
                >
                  <Trash2 className="w-5 h-5 text-red-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
