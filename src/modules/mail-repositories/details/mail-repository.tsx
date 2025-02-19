import { useParams, useSearchParams } from "react-router";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getMailsInRepository } from "../api-client";
import { MailKeysResponseType } from "../types";
import { useCallback } from "react";
import { apiClient } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";

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
    console.error("Error fetching mail data:", error);
  }
};

export default function MailRepositoryDetail() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { id } = useParams();

  const page = Number(searchParams.get("page")) || 1;
  const size = Number(searchParams.get("size")) || 0;
  const limit = import.meta.env.VITE_PAGE_LIMIT;
  const offset = (page - 1) * limit;
  // check if we reached the end of the list
  const hasMore = offset + limit < size;

  const fetchMails = useCallback(
    () => getMailsInRepository(encodeURIComponent(id!), { limit, offset }),
    [id, limit, offset]
  );

  const {
    data: mailKeys,
    isLoading,
    error,
  } = useFetchData<MailKeysResponseType>(fetchMails);

  // Handle pagination navigation
  const goToPage = (newPage: number) => {
    if (newPage < 1) return;
    setSearchParams({ page: newPage.toString(), size: size.toString() });
  };

  return (
    <div className="mt-4 p-4 bg-white rounded-2">
      <h3 className="text-lg font-semibold">Mail Repository Details</h3>
      <p>Repository ID: {id}</p>

      {isLoading && <p>Loading mails...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}
      {/* Pagination UI */}
      <div className="mt-6 flex justify-between items-center">
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

                <span className="flex space-x-2 text-sm text-gray-500">
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
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
