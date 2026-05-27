import { apiClient } from "@/lib/apiClient";

export type JmapSettingsReport = Record<string, Record<string, number>>;

export const getJmapSettingsReport = async (domain?: string): Promise<JmapSettingsReport> => {
  const query = domain ? `?domain=${encodeURIComponent(domain)}` : "";
  return apiClient.get(`/jmap/settings/reports${query}`);
};
