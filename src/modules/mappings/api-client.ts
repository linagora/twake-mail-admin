import { apiClient } from "@/lib/apiClient";
import { GetMappingsResponseType } from "./types";

export const getMappings = async (): Promise<GetMappingsResponseType> => {
  const response = await apiClient.get<any, GetMappingsResponseType>("/mappings");
  return response;
};

export const createAddressMapping = async (
  source: string,
  destination: string
): Promise<void> => {
  await apiClient.post(
    `/mappings/address/${encodeURIComponent(source)}/targets/${encodeURIComponent(destination)}`
  );
};

export const deleteAddressMapping = async (
  source: string,
  destination: string
): Promise<void> => {
  await apiClient.delete(
    `/mappings/address/${encodeURIComponent(source)}/targets/${encodeURIComponent(destination)}`
  );
};

export const deleteAliasMapping = async (
  aliasSource: string,
  userAddress: string
): Promise<void> => {
  await apiClient.delete(
    `/address/aliases/${encodeURIComponent(userAddress)}/sources/${encodeURIComponent(aliasSource)}`
  );
};

export const deleteForwardMapping = async (
  userAddress: string,
  targetAddress: string
): Promise<void> => {
  await apiClient.delete(
    `/address/forwards/${encodeURIComponent(userAddress)}/targets/${encodeURIComponent(targetAddress)}`
  );
};

export const deleteDomainMapping = async (
  sourceDomain: string,
  destinationDomain: string
): Promise<void> => {
  await apiClient.delete(
    `/domainAliases/${encodeURIComponent(destinationDomain)}/sources/${encodeURIComponent(sourceDomain)}`
  );
};

export const createRegexMapping = async (
  mappingSource: string,
  regex: string
): Promise<void> => {
  await apiClient.post(
    `/mappings/regex/${encodeURIComponent(mappingSource)}/targets/${encodeURIComponent(regex)}`
  );
};

export const deleteRegexMapping = async (
  mappingSource: string,
  regex: string
): Promise<void> => {
  await apiClient.delete(
    `/mappings/regex/${encodeURIComponent(mappingSource)}/targets/${encodeURIComponent(regex)}`
  );
};
