import { useParams } from "react-router";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getMailsInRepository } from "../api-client";
import { MailKeysResponseType } from "../types";
import { useCallback } from "react";
import { apiClient } from "@/lib/apiClient";

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

// The function that fetches the mail data
const fetchMailData = async (
  repo: string,
  mailKey: string,
  acceptType: "application/json" | "message/rfc822"
): Promise<void> => {
  const repositoryPath = encodeURIComponent(repo); // Encode repo name
  const endpoint = `/mailRepositories/${repositoryPath}/mails/${mailKey}`;

  try {
    // Get the response with the correct Accept header and response type
    const response = (await apiClient.get<MailResponse>(endpoint, {
      headers: { Accept: acceptType },
      responseType: acceptType === "message/rfc822" ? "blob" : "json", // Correct responseType based on Accept header
    })) as any;

    if (acceptType === "application/json") {
      // For JSON files, open the data in a new tab
      const jsonWindow = window.open("", "_blank"); // Open a new blank window/tab
      if (jsonWindow) {
        jsonWindow.document.write(
          "<pre>" + JSON.stringify(response, null, 2) + "</pre>"
        ); // Format and write JSON to the new window
        jsonWindow.document.close(); // Ensure the content is rendered properly
      }
    } else if (acceptType === "message/rfc822") {
      // For MIME (EML) files, handle the binary data
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${mailKey}.eml`); // Name the file as mailKey.eml
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  } catch (error) {
    console.error("Error fetching mail data:", error);
  }
};

export default function MailRepositoryDetail() {
  const { id } = useParams();

  const fetchMails = useCallback(
    () => getMailsInRepository(encodeURIComponent(id!)),
    [id]
  );

  const {
    data: mailKeys,
    isLoading,
    error,
  } = useFetchData<MailKeysResponseType>(fetchMails);

  return (
    <div className="mt-4 p-4 bg-white rounded-2">
      <h3 className="text-lg font-semibold">Mail Repository Details</h3>
      <p>Repository ID: {id}</p>

      {isLoading && <p>Loading mails...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}

      {mailKeys && (
        <div className="mt-8">
          <ul>
            {mailKeys.map((mailKey) => (
              <li
                key={mailKey}
                className="flex justify-between items-center border-b pb-1"
              >
                <span className="font-medium">{mailKey}</span>

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
