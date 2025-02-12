import { APIError } from "@/lib/apiClient";
import { useEffect, useState } from "react";

export function useFetchData<T>(getter: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null); // Reset error state before a new fetch
    try {
      const result = await getter();
      setData(result);
    } catch (error: unknown) {
      const e = error as APIError; // Assuming you have APIError defined
      setError(`Failed to fetch data: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [getter]);

  return { data, isLoading, error, refresh: fetchData };
}
