import { GetMailRepositoriesResponseType } from "./types";
import { getMailRepositories } from "./api-client";
import { useFetchData } from "@/hooks/use-fetch-data";

export default function MailRepositoriesList() {
  const {
    data: mailRepositoriesResult,
    isLoading,
    error: _error,
  } = useFetchData<GetMailRepositoriesResponseType>(getMailRepositories);
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
          {mailRepositoriesResult?.map((result) => (
            <div
              key={result.repository}
              className="space-y-1p-4 bg-white rounded-2 my-4 p-4"
            >
              <h4 className="text-sm font-medium leading-none">
                <a href={`/mail-repositories/repository/${result.path}`}>
                  {result.repository}
                </a>
              </h4>
              <p className="text-sm text-muted-foreground">{result.path}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
