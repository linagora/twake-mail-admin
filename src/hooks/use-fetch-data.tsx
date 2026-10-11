import { APIError } from "@/lib/apiClient";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

// Data is fetched again whenever the getter or the refreshKey changes.
export function useFetchData<T>(getter: (() => Promise<T>) | null, refreshKey?: unknown) {
  const { t } = useTranslation();
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // The raw failure message is stored so that the error is translated at render time and follows language changes.
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  const fetchData = async () => {
    if (!getter) return;
    setIsLoading(true);
    setFailureMessage(null);
    try {
      const result = await getter();
      setData(result);
    } catch (error: unknown) {
      const e = error as APIError;
      setData(null);
      setFailureMessage(e.message ?? "");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!getter) return;
    fetchData();
  }, [getter, refreshKey]);

  const error = failureMessage === null ? null : t("common.fetchFailed", { message: failureMessage });

  return { data, isLoading, error, refresh: fetchData };
}
