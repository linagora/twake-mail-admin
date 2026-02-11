import { apiClient } from "@/lib/apiClient";
import { GetDomainsResponseType, DomainQuota, DomainQuotaValues } from "./types";

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

export const getDomainQuota = async (domain: string): Promise<DomainQuota> => {
  return apiClient.get(`/quota/domains/${encodeURIComponent(domain)}`);
};

export const updateDomainQuota = async (domain: string, quota: DomainQuotaValues): Promise<void> => {
  await apiClient.put(`/quota/domains/${encodeURIComponent(domain)}`, quota);
};
