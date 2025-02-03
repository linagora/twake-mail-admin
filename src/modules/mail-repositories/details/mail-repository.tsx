import { useParams } from "react-router";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getMailsInRepository } from "../api-client";
import { MailKeysResponseType } from "../types";
import { useCallback } from "react";

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
        <div>
          <h4 className="text-lg font-semibold mt-4">
            Mails in this repository:
          </h4>
          <ul>
            {mailKeys.map((mailKey) => (
              <li key={mailKey}>{mailKey}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
