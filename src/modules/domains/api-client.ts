import { apiClient } from "@/lib/apiClient";
import { GetDomainsResponseType, GetDomainAliasesResponseType, DomainQuota, DomainQuotaValues } from "./types";

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

export const getDomainAliases = async (domain: string): Promise<GetDomainAliasesResponseType> => {
  return apiClient.get(`/domains/${encodeURIComponent(domain)}/aliases`);
};

export const addDomainAlias = async (domain: string, source: string): Promise<void> => {
  await apiClient.put(`/domains/${encodeURIComponent(domain)}/aliases/${encodeURIComponent(source)}`);
};

export const removeDomainAlias = async (domain: string, source: string): Promise<void> => {
  await apiClient.delete(`/domains/${encodeURIComponent(domain)}/aliases/${encodeURIComponent(source)}`);
};

export const getDomainQuota = async (domain: string): Promise<DomainQuota> => {
  return apiClient.get(`/quota/domains/${encodeURIComponent(domain)}`);
};

export const updateDomainQuota = async (domain: string, quota: DomainQuotaValues): Promise<void> => {
  await apiClient.put(`/quota/domains/${encodeURIComponent(domain)}`, quota);
};
