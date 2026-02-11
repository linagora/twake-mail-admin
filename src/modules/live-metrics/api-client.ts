import { apiClient } from "@/lib/apiClient";

export const getMetrics = async (): Promise<string> => {
  // The interceptor returns response.data which is the raw text for /metrics
  return apiClient.get("/metrics", {
    headers: { Accept: "text/plain" },
    transformResponse: [(data: string) => data],
  });
};
