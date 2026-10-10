import { APIError } from "@/lib/apiClient";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

// Data is fetched again whenever the getter or the refreshKey changes.
export function useFetchData<T>(getter: (() => Promise<T>) | null, refreshKey?: unknown) {
  const { t } = useTranslation();
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!getter) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getter();
      setData(result);
    } catch (error: unknown) {
      const e = error as APIError;
      setError(t("common.fetchFailed", { message: e.message }));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!getter) return;
    fetchData();
  }, [getter, refreshKey]);

  return { data, isLoading, error, refresh: fetchData };
}
