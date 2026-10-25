import axios from "axios";
import { toErrorMessage } from "@/components/custom/error-message";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

// WebAdmin's message and details are preferred over the generic "Request failed with status code ..." of Axios.
const toFailureMessage = (error: unknown): string => {
  const { message, details } = toErrorMessage(error);
  return details ? `${message} — ${details}` : message;
};

// Data is fetched again whenever the getter or the refreshKey changes.
export function useFetchData<T>(getter: (() => Promise<T>) | null, refreshKey?: unknown) {
  const { t } = useTranslation();
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // The raw failure message is stored so that the error is translated at render time and follows language changes.
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  // HTTP status of the failure: a 404 tells a feature the server does not offer from an error
  const [status, setStatus] = useState<number | null>(null);

  // Only the latest request is shown: an earlier one answering late (a periodic refresh sent
  // before the filters changed) does not replace its result
  const latestRequest = useRef(0);

  // A silent fetch (a periodic refresh) keeps the data and the error on screen, with no loading state
  const fetchData = async (silent = false) => {
    if (!getter) return;
    const request = ++latestRequest.current;
    if (!silent) {
      setIsLoading(true);
      setFailureMessage(null);
      setStatus(null);
    }
    try {
      const result = await getter();
      if (request !== latestRequest.current) return;
      setData(result);
      setFailureMessage(null);
      setStatus(null);
    } catch (error: unknown) {
      if (request !== latestRequest.current) return;
      setData(null);
      setFailureMessage(toFailureMessage(error));
      setStatus(axios.isAxiosError(error) ? error.response?.status ?? null : null);
    } finally {
      if (request === latestRequest.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!getter) return;
    fetchData();
  }, [getter, refreshKey]);

  const error = failureMessage === null ? null : t("common.fetchFailed", { message: failureMessage });

  return { data, isLoading, error, status, refresh: () => fetchData(), refreshSilently: () => fetchData(true) };
}
