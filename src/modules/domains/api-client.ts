import { apiClient } from "@/lib/apiClient";
import { GetDomainsResponseType } from "./types";

export const getDomains = async (): Promise<GetDomainsResponseType> => {
  const response = await apiClient.get<any, GetDomainsResponseType>("/domains");
  return response;
};

export const createDomain = async (domain: string): Promise<void> => {
  await apiClient.put(`/domains/${encodeURIComponent(domain)}`);
};

export const deleteDomain = async (domain: string): Promise<void> => {
  await apiClient.delete(`/domains/${encodeURIComponent(domain)}`);
};
