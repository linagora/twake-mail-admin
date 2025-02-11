import { RefreshCw, Trash2 } from "lucide-react";
import { GetMailRepositoriesResponseType, MailRepository } from "./types";
import { getMailRepositories, getRepositoryInfo } from "./api-client";
import { useFetchData } from "@/hooks/use-fetch-data";
import { useCallback, useEffect, useState } from "react";

export default function MailRepositoriesList() {
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
                  <a href={`/mail-repositories/repository/${result.path}?&page=1&size=${result.size}`}>
                    {result.repository} ({result.size})
                  </a>
                </h4>
                <p className="text-sm text-muted-foreground">{result.path}</p>
              </div>

              <div className="flex gap-2">
                <button className="p-2 rounded-md hover:bg-gray-200">
                  <RefreshCw className="w-5 h-5 text-blue-600" />
                </button>

                <button className="p-2 rounded-md hover:bg-gray-200">
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
