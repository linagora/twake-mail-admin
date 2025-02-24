import { useParams, useSearchParams } from "react-router";
import { useFetchData } from "@/hooks/use-fetch-data";
import { InsertionIdsResponseType } from "../types";
import { getFailedEvents } from "../api-client";
import { useCallback } from "react";
import { apiClient } from "@/lib/apiClient";
import { toast, useToast } from "@/hooks/use-toast";
import ErrorDisplayer from "@/components/custom/error-displayer";

interface EventResponse {
  [key: string]: any; // Represents the full JSON structure of the event
}

const fetchFailedEventJson = async (
  group: string,
  insertionId: string
): Promise<void> => {
  const endpoint = `/events/deadLetter/groups/${group}/${insertionId}`;

  try {
    const response = await apiClient.get<EventResponse>(endpoint);

    const jsonWindow = window.open("", "_blank");
    if (jsonWindow) {
      jsonWindow.document.write(
        "<pre>" + JSON.stringify(response, null, 2) + "</pre>"
      );
      jsonWindow.document.close();
    }
  } catch (error) {
    toast({
      title: "Error fetching failed event JSON",
      description: <ErrorDisplayer error={error} />,
    });
  }
};

export default function EventListenersDetail() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { id } = useParams();

  const page = Number(searchParams.get("page")) || 1;
  const size = Number(searchParams.get("size")) || 0;
  const limit = Number(import.meta.env.VITE_PAGE_LIMIT) || 200;
  const offset = (page - 1) * limit;
  // check if we reached the end of the list
  const hasMore = offset + limit < size;

  const fetchFailedEvents = useCallback(
    () => getFailedEvents(id!),
    [id, limit, offset]
  );

  const {
    data: failedEventKeys,
    isLoading,
    error,
  } = useFetchData<InsertionIdsResponseType>(fetchFailedEvents);

  // Handle pagination navigation
  const goToPage = (newPage: number) => {
    if (newPage < 1) return;
    setSearchParams({ page: newPage.toString(), size: size.toString() });
  };

  return (
    <div className="mt-4 p-4 bg-white rounded-2">
      <h3 className="text-lg font-semibold">Event Group Details</h3>
      <p>Group ID: {id}</p>

      {isLoading && <p>Loading failed events...</p>}
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
        <span className="text-sm font-medium">
          Page {page} / {limit} failed events per page / Total: {size}
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
      {failedEventKeys && (
        <div className="mt-8">
          <ul>
            {failedEventKeys.map((failedEventKey, index) => (
              <li
                key={failedEventKey}
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
                        .writeText(failedEventKey)
                        .then(() => {
                          toast({
                            title: "Event key copied to clipboard!",
                            description: `${failedEventKey}`,
                          });
                        })
                        .catch((err) => {
                          console.error("Failed to copy text: ", err);
                        });
                    }}
                  >
                    {failedEventKey}
                  </span>
                </span>

                <span className="flex space-x-2 text-sm text-gray-500">
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      fetchFailedEventJson(id!, failedEventKey);
                    }}
                    className="hover:text-blue-500 hover:underline transition"
                  >
                    (JSON)
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
